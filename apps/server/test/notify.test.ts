import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunManager } from "../src/run_manager";
import type { NotifyMode, Run, RunEvent, Session, Store } from "../src/store";

const now = () => new Date().toISOString();

const createMemoryStore = (): Store => {
  const sessions = new Map<string, Session>();
  const runs = new Map<string, Run>();
  const runEvents = new Map<string, RunEvent[]>();

  return {
    init: () => {},
    listSessions: () => Array.from(sessions.values()),
    getSession: (id) => sessions.get(id) ?? null,
    createSession: ({ title, repo_path }) => {
      const ts = now();
      const session: Session = {
        id: `session-${sessions.size + 1}`,
        title,
        repo_path,
        status: "idle",
        notify_mode: "needs_input_failed",
        created_at: ts,
        updated_at: ts
      };
      sessions.set(session.id, session);
      return session;
    },
    updateSession: (id, patch) => {
      const existing = sessions.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updated_at: now() } as Session;
      if (!updated.notify_mode) updated.notify_mode = "needs_input_failed";
      sessions.set(id, updated);
      return updated;
    },
    listRunsBySession: (session_id) => Array.from(runs.values()).filter((run) => run.session_id === session_id),
    getRun: (id) => runs.get(id) ?? null,
    createRun: (input) => {
      const ts = now();
      const run: Run = {
        ...input,
        status: "running",
        exit_code: null,
        created_at: ts,
        updated_at: ts,
        last_snippet: null
      };
      runs.set(run.id, run);
      return run;
    },
    updateRun: (id, patch) => {
      const existing = runs.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updated_at: now() } as Run;
      runs.set(id, updated);
      return updated;
    },
    appendRunEvent: (event) => {
      const events = runEvents.get(event.run_id) ?? [];
      const runEvent: RunEvent = { ...event, seq: events.length + 1 };
      events.push(runEvent);
      runEvents.set(event.run_id, events);
      return runEvent;
    },
    getRunEvents: (run_id, limit) => {
      const events = runEvents.get(run_id) ?? [];
      return events.slice(Math.max(0, events.length - limit));
    },
    clearRunsForSession: () => 0,
    markStaleRuns: () => 0
  };
};

const waitForRun = async (store: Store, manager: RunManager, runId: string) => {
  const existing = store.getRun(runId);
  if (existing?.status === "done") return;
  await new Promise<void>((resolve) => {
    const unsubscribe = manager.subscribe(runId, (event) => {
      if (event.type === "final") {
        unsubscribe();
        resolve();
      }
    });
  });
};

describe("notifications", () => {
  const tokenEnv = "test-token";

  beforeEach(() => {
    process.env.NTFY_URL = "https://ntfy.sh";
    process.env.NTFY_TOPIC = "godex-test";
    process.env.CODEX_RELAY_TOKEN = tokenEnv;
  });

  afterEach(() => {
    delete process.env.NTFY_URL;
    delete process.env.NTFY_TOPIC;
    delete process.env.CODEX_RELAY_TOKEN;
    vi.restoreAllMocks();
  });

  it("notifies on failed when mode allows", async () => {
    const store = createMemoryStore();
    const manager = new RunManager(store);
    const session = store.createSession({ title: "demo", repo_path: process.cwd() });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    const runId = await manager.startRun({
      type: "test",
      session_id: session.id,
      command: process.execPath,
      args: ["-e", "console.error('Something failed'); process.exit(1)"] ,
      cwd: process.cwd()
    });

    await waitForRun(store, manager, runId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("https://ntfy.sh/");
    expect(String(call[1]?.body ?? "")).toContain("Something failed");
  });

  it("notifies on long done when mode is all", async () => {
    const store = createMemoryStore();
    const manager = new RunManager(store);
    const session = store.createSession({ title: "demo", repo_path: process.cwd() });
    store.updateSession(session.id, { notify_mode: "all" as NotifyMode });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    let call = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      call += 1;
      return call === 1 ? 0 : 121000;
    });

    const runId = await manager.startRun({
      type: "test",
      session_id: session.id,
      command: process.execPath,
      args: ["-e", "console.log('ok')"],
      cwd: process.cwd()
    });

    await waitForRun(store, manager, runId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
