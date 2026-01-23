import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
}

type AppServerMessage = {
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message?: string; data?: unknown };
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type StatusState = "starting" | "ready" | "error" | "stopped";

type StatusSnapshot = {
  state: StatusState;
  pid: number | null;
  last_error: string | null;
  restarting: boolean;
};

type NotificationHandler = (message: AppServerMessage) => void;

export type CodexSpawnSpec = {
  command: string;
  args: string[];
  options: {
    cwd: string;
    stdio: ["pipe", "pipe", "pipe"];
    env: NodeJS.ProcessEnv;
    shell: boolean;
    windowsHide: boolean;
  };
};

const nowIso = () => new Date().toISOString();

const safeStringify = (input: unknown) => {
  try {
    return JSON.stringify(input);
  } catch {
    return "<non-serializable>";
  }
};

const resolveCodexBinary = (): string => {
  const override = process.env.CODEX_BIN;
  if (override && override.trim()) {
    return override.trim();
  }
  return "codex";
};

export const buildCodexSpawnSpec = (cwd: string): CodexSpawnSpec => {
  const command = resolveCodexBinary();
  return {
    command,
    args: ["app-server"],
    options: {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      shell: process.platform === "win32" ? true : false,
      windowsHide: process.platform === "win32"
    }
  };
};

export const buildCodexCommandSpec = (cwd: string, args: string[]): CodexSpawnSpec => {
  const command = resolveCodexBinary();
  return {
    command,
    args,
    options: {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      shell: process.platform === "win32" ? true : false,
      windowsHide: process.platform === "win32"
    }
  };
};

export class CodexAppServerManager {
  private logger?: Logger;
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending: Map<string | number, PendingRequest> = new Map();
  private subscribers: Set<NotificationHandler> = new Set();
  private status: StatusSnapshot = { state: "stopped", pid: null, last_error: null, restarting: false };
  private logLines: string[] = [];
  private requestId = 0;
  private restartAttempts = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private initializing = false;
  private cwd: string;

  constructor(logger?: Logger) {
    this.logger = logger;
    this.cwd = process.env.GODEX_APP_SERVER_CWD
      ? resolve(process.env.GODEX_APP_SERVER_CWD)
      : process.cwd();
  }

  getStatus(): StatusSnapshot {
    return { ...this.status };
  }

  getLogLines(): string[] {
    return [...this.logLines];
  }

  isReady(): boolean {
    return this.status.state === "ready";
  }

  getCwd(): string {
    return this.cwd;
  }

  getSpawnSpec(): CodexSpawnSpec {
    return buildCodexSpawnSpec(this.cwd);
  }

  subscribe(handler: NotificationHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  start() {
    if (this.child || this.initializing) return;
    this.initializing = true;
    this.spawnProcess();
  }

  async request(method: string, params?: unknown, timeoutMs = 60000): Promise<any> {
    if (!this.child || !this.isReady()) {
      throw new Error("codex app-server not ready");
    }
    return this.sendRequest(method, params, timeoutMs);
  }

  notify(method: string, params?: unknown) {
    if (!this.child) return;
    const payload: AppServerMessage = { method, params };
    this.child.stdin.write(`${safeStringify(payload)}\n`);
  }

  private sendRequest(method: string, params?: unknown, timeoutMs = 60000): Promise<any> {
    if (!this.child) {
      return Promise.reject(new Error("codex app-server not running"));
    }
    const id = `${Date.now()}-${this.requestId++}`;
    const payload: AppServerMessage = { id, method, params };
    const line = safeStringify(payload);
    this.child.stdin.write(`${line}\n`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex app-server request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  private spawnProcess() {
    this.status = { state: "starting", pid: null, last_error: null, restarting: this.status.restarting };
    const spec = buildCodexSpawnSpec(this.cwd);
    this.appendLog(`spawn: ${spec.command} ${spec.args.join(" ")} (cwd=${this.cwd}) shell=${spec.options.shell}`);
    this.logger?.info({ command: spec.command, shell: spec.options.shell }, "app-server spawn");

    const child = spawn(spec.command, spec.args, spec.options);

    this.child = child;
    this.status.pid = child.pid ?? null;

    const stdoutRl = createInterface({ input: child.stdout });
    stdoutRl.on("line", (line) => this.handleStdoutLine(line));

    const stderrRl = createInterface({ input: child.stderr });
    stderrRl.on("line", (line) => this.appendLog(`stderr: ${line}`));

    child.on("error", (err) => {
      this.status.state = "error";
      this.status.last_error = err?.message ?? "process error";
      this.appendLog(`process error: ${this.status.last_error}`);
    });

    child.on("close", (code) => {
      this.appendLog(`process exit (${code ?? "unknown"})`);
      this.child = null;
      this.status.pid = null;
      this.status.state = "error";
      this.status.last_error = `process exited (${code ?? "unknown"})`;
      this.rejectAllPending(new Error("codex app-server exited"));
      this.scheduleRestart();
    });

    void this.initialize();
  }

  private async initialize() {
    try {
      const result = await this.requestInitialize();
      this.appendLog(`initialized: ${safeStringify(result)}`);
      this.status.state = "ready";
      this.status.last_error = null;
      this.restartAttempts = 0;
    } catch (err: any) {
      const message = err?.message ?? "initialize failed";
      this.status.state = "error";
      this.status.last_error = message;
      this.appendLog(`initialize error: ${message}`);
      this.scheduleRestart();
    } finally {
      this.initializing = false;
    }
  }

  private async requestInitialize() {
    const initPayload = {
      clientInfo: {
        name: "godex",
        title: "godex",
        version: "0.1.0"
      }
    };
    const result = await this.sendRequest("initialize", initPayload, 20000);
    this.notify("initialized", {});
    return result;
  }

  private scheduleRestart() {
    if (this.restartTimer) return;
    this.status.restarting = true;
    const backoff = Math.min(30000, 1000 * Math.pow(2, this.restartAttempts));
    this.restartAttempts += 1;
    this.appendLog(`restart scheduled in ${backoff}ms`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.status.restarting = false;
      this.initializing = false;
      if (!this.child) {
        this.spawnProcess();
      }
    }, backoff);
  }

  private handleStdoutLine(line: string) {
    if (!line.trim()) return;
    this.appendLog(`stdout: ${line}`);

    let message: AppServerMessage | null = null;
    try {
      message = JSON.parse(line) as AppServerMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const pending = this.pending.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.error) {
          const err = new Error(message.error.message ?? "codex app-server error");
          (err as any).code = message.error.code;
          (err as any).data = message.error.data;
          pending.reject(err);
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.appendLog(`unexpected request from server: ${message.method}`);
      this.respondError(message.id, -32601, "client does not support server requests");
      this.emitNotification(message);
      return;
    }

    if (message.method) {
      this.emitNotification(message);
    }
  }

  private respondError(id: string | number, code: number, message: string) {
    if (!this.child) return;
    const payload: AppServerMessage = { id, error: { code, message } };
    this.child.stdin.write(`${safeStringify(payload)}\n`);
  }

  private emitNotification(message: AppServerMessage) {
    for (const handler of this.subscribers) {
      handler(message);
    }
  }

  private rejectAllPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private appendLog(line: string) {
    const entry = `[${nowIso()}] ${line}`;
    this.logLines.push(entry);
    if (this.logLines.length > 200) {
      this.logLines.splice(0, this.logLines.length - 200);
    }
    this.logger?.debug?.({ line }, "app-server");
  }
}
