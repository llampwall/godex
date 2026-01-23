import { randomUUID } from "node:crypto";
import { Store, RunStream, SessionStatus, NotifyMode } from "./store.js";

const dynamicImport = (specifier: string) => {
  if (process.env.VITEST) {
    return import(specifier);
  }
  const importer = new Function("specifier", "return import(specifier)");
  return importer(specifier) as Promise<any>;
};

const loadExeca = async () => {
  const mod = (await dynamicImport("execa")) as { execa: typeof import("execa").execa };
  return mod.execa;
};

const fallbackStrip = (input: string) => {
  return input
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\\u001b\[[0-9;]*m/g, "")
    .replace(/\\x1b\[[0-9;]*m/g, "");
};

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
}

const loadStripAnsi = async (logger?: Logger) => {
  try {
    const mod = (await dynamicImport("strip-ansi")) as { default: (input: string) => string };
    return mod.default;
  } catch (err) {
    logger?.error({ error: err }, "strip-ansi failed, using fallback");
    return fallbackStrip;
  }
};

export interface RunStartInput {
  type: string;
  session_id: string;
  command: string;
  args?: string[];
  cwd: string;
}

export interface RunEventPayload {
  run_id: string;
  ts: string;
  stream: RunStream;
  chunk: string;
  seq: number;
}

export interface FinalEventPayload {
  run_id: string;
  ts: string;
  exit_code: number | null;
}

type Subscriber = (event: { type: "chunk"; data: RunEventPayload } | { type: "final"; data: FinalEventPayload }) => void;

const now = () => new Date().toISOString();

const needsInputPatterns = ["i need", "confirm", "choose", "unable to proceed"];
const messageNoisePatterns = [
  /^openai codex/i,
  /^-+$/i,
  /^workdir:/i,
  /^model:/i,
  /^provider:/i,
  /^approval:/i,
  /^sandbox:/i,
  /^reasoning/i,
  /^session id:/i,
  /^config:/i,
  /^mcp:/i,
  /^mcp\s+startup/i,
  /^mcp\s+.*starting/i,
  /^mcp\s+.*ready/i,
  /^mcp\s+.*failed/i
];

const filterMessageNoise = (text: string): string => {
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !messageNoisePatterns.some((pattern) => pattern.test(trimmed));
  });
  return filtered.join("\n");
};

const detectNeedsInput = (text: string) => {
  const lines = text.split(/\r?\n/);
  let mode: "user" | "assistant" = "assistant";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower === "user") {
      mode = "user";
      continue;
    }
    if (lower === "thinking" || lower === "assistant" || lower === "codex") {
      mode = "assistant";
      continue;
    }
    if (mode === "user") continue;
    if (needsInputPatterns.some((pattern) => lower.includes(pattern))) {
      return true;
    }
  }
  return false;
};

const collapseWhitespace = (input: string) => input.replace(/\s+/g, " ").trim();

const buildSummary = (
  events: { chunk: string }[],
  status: SessionStatus,
  stripAnsi: (input: string) => string
) => {
  const lines = events
    .flatMap((event) => event.chunk.split(/\r?\n/))
    .map((line) => collapseWhitespace(stripAnsi(line)))
    .filter((line) => line.length > 0);

  if (!lines.length) return "";

  if (status === "failed") {
    const errorLine = [...lines].reverse().find((line) => /(error|failed|exception)/i.test(line));
    if (errorLine) return errorLine;
  }

  return lines[lines.length - 1];
};

const truncateSummary = (input: string, max = 160) => {
  if (input.length <= max) return input;
  return input.slice(0, max - 3) + "...";
};

const shouldNotify = (mode: NotifyMode, status: SessionStatus, durationSec: number) => {
  if (mode === "off") return false;
  if (status === "failed" || status === "needs_input") return true;
  if (status === "idle") return mode === "all" && durationSec >= 30;
  return false;
};

export class RunManager {
  private store: Store;
  private logger?: Logger;
  private subscribers: Map<string, Set<Subscriber>> = new Map();
  private activeRuns: Set<string> = new Set();

  constructor(store: Store, logger?: Logger) {
    this.store = store;
    this.logger = logger;
  }

  getActiveRunsCount(): number {
    return this.activeRuns.size;
  }

  subscribe(run_id: string, handler: Subscriber): () => void {
    if (!this.subscribers.has(run_id)) {
      this.subscribers.set(run_id, new Set());
    }
    this.subscribers.get(run_id)?.add(handler);
    return () => {
      this.subscribers.get(run_id)?.delete(handler);
    };
  }

  private broadcast(event: { type: "chunk"; data: RunEventPayload } | { type: "final"; data: FinalEventPayload }) {
    const subs = this.subscribers.get(event.data.run_id);
    if (!subs) return;
    for (const handler of subs) {
      handler(event);
    }
  }

  private async maybeNotify(session_id: string, status: SessionStatus, summary: string) {
    const url = process.env.NTFY_URL;
    const topic = process.env.NTFY_TOPIC;
    if (!url || !topic) return;
    const session = this.store.getSession(session_id);
    if (!session) return;

    const base = url.replace(/\/$/, "");
    const link = `${base}/ui/s/${session.id}`;
    const title = `${session.title} · ${status}`;
    const body = `session: ${session.title}\nstatus: ${status}\nsummary: ${summary || "(none)"}\n${link}`;

    try {
      await fetch(`${base}/${topic}`, {
        method: "POST",
        headers: {
          Title: title,
          "Content-Type": "text/plain"
        },
        body
      });
    } catch {
      // ignore notification errors
    }
  }

  async startRun(input: RunStartInput): Promise<string> {
    const run_id = randomUUID();
    const args = input.args ?? [];
    const fullCommand = [input.command, ...args].join(" ");

    this.store.createRun({
      id: run_id,
      session_id: input.session_id,
      type: input.type,
      command: fullCommand,
      cwd: input.cwd
    });

    this.activeRuns.add(run_id);
    this.logger?.info({ run_id, type: input.type, cwd: input.cwd, command: fullCommand }, "run started");

    let needsInput = false;
    let lastSnippet: string | null = null;
    let finished = false;

    const startMs = Date.now();

    const finalize = (exit_code: number | null, errorMessage?: string) => {
      if (finished) return;
      finished = true;
      this.store.updateRun(run_id, { status: "done", exit_code, last_snippet: lastSnippet });
      this.activeRuns.delete(run_id);

      let sessionStatus: SessionStatus = "idle";
      if (exit_code !== 0) {
        sessionStatus = "failed";
      } else if (needsInput) {
        sessionStatus = "needs_input";
      }

      const prevSession = this.store.getSession(input.session_id);
      const prevStatus = prevSession?.status ?? "idle";
      const notifyMode = prevSession?.notify_mode ?? "needs_input_failed";
      this.store.updateSession(input.session_id, { status: sessionStatus });

      if (errorMessage) {
        const ts = now();
        const event = this.store.appendRunEvent({
          run_id,
          ts,
          stream: "stderr",
          chunk: errorMessage
        });
        this.broadcast({ type: "chunk", data: { ...event } });
      }

      const finalEvent: FinalEventPayload = {
        run_id,
        ts: now(),
        exit_code
      };
      this.broadcast({ type: "final", data: finalEvent });

      const durationSec = Math.round((Date.now() - startMs) / 1000);
      const events = this.store.getRunEvents(run_id, 200);
      const stripSummary = stripAnsi ?? fallbackStrip;
      const summary = truncateSummary(buildSummary(events, sessionStatus, stripSummary));

      const transitioned = prevStatus !== sessionStatus;
      if ((transitioned || sessionStatus === "idle") && shouldNotify(notifyMode as NotifyMode, sessionStatus, durationSec)) {
        void this.maybeNotify(input.session_id, sessionStatus, summary);
      }

      this.logger?.info({ run_id, exit_code, sessionStatus }, "run finished");
    };

    let execa: typeof import("execa").execa | undefined;
    let stripAnsi: ((input: string) => string) | undefined;

    try {
      [execa, stripAnsi] = await Promise.all([loadExeca(), loadStripAnsi(this.logger)]);
    } catch (err: any) {
      const message = `Failed to load dependencies: ${err?.message ?? "unknown error"}`;
      this.logger?.error({ run_id, error: err }, "run dependency load failed");
      finalize(127, message);
      return run_id;
    }

    let child;
    try {
      child = execa(input.command, args, {
        cwd: input.cwd,
        reject: false,
        stdout: "pipe",
        stderr: "pipe"
      });
    } catch (err: any) {
      const message = `Failed to start command: ${err?.message ?? "unknown error"}`;
      this.logger?.error({ run_id, error: err }, "run failed to start");
      finalize(127, message);
      return run_id;
    }

    const handleChunk = (stream: RunStream, chunk: Buffer) => {
      let text = chunk.toString();
      if (!text) return;
      const clean = stripAnsi ? stripAnsi(text) : fallbackStrip(text);
      text = fallbackStrip(clean);
      if (input.type === "message") {
        text = filterMessageNoise(text);
      }
      if (!text.trim()) return;

      const ts = now();
      const event = this.store.appendRunEvent({
        run_id,
        ts,
        stream,
        chunk: text
      });
      lastSnippet = text.slice(-200);
      if (!needsInput) {
        needsInput = input.type === "message"
          ? detectNeedsInput(text)
          : needsInputPatterns.some((pattern) => text.toLowerCase().includes(pattern));
      }
      this.store.updateRun(run_id, { last_snippet: lastSnippet });
      this.broadcast({ type: "chunk", data: { ...event } });
    };

    child.stdout?.on("data", (chunk: Buffer) => handleChunk("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer) => handleChunk("stderr", chunk));

    child.on("error", (err: any) => {
      const message = `Process error: ${err?.message ?? "unknown error"}`;
      this.logger?.error({ run_id, error: err }, "run process error");
      finalize(1, message);
    });

    child.on("close", (code) => {
      const exit_code = typeof code === "number" ? code : null;
      finalize(exit_code ?? 0);
    });

    return run_id;
  }
}
