import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunManager } from "../src/run_manager";
import type { NotifyPolicy, Run, RunEvent, Workspace, Store, ThreadMeta, WorkspaceThread } from "../src/store";

const now = () => new Date().toISOString();

const createMemoryStore = (): Store => {
  const workspaces = new Map<string, Workspace>();
  const runs = new Map<string, Run>();
  const runEvents = new Map<string, RunEvent[]>();
  const threadMeta = new Map<string, ThreadMeta>();
  const workspaceThreads: WorkspaceThread[] = [];

  return {
    init: () => {},
    listWorkspaces: () => Array.from(workspaces.values()),
    getWorkspace: (id) => workspaces.get(id) ?? null,
    createWorkspace: ({ title, repo_path }) => {
      const ts = now();
      const workspace: Workspace = {
        id: `workspace-${workspaces.size + 1}`,
        title,
        repo_path,
        status: "idle",
        notify_policy: "needs_input+failed",
        default_thread_id: null,
        test_command_override: null,
        created_at: ts,
        updated_at: ts
      };
      workspaces.set(workspace.id, workspace);
      return workspace;
    },
    updateWorkspace: (id, patch) => {
      const existing = workspaces.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updated_at: now() } as Workspace;
      if (!updated.notify_policy) updated.notify_policy = "needs_input+failed";
      workspaces.set(id, updated);
      return updated;
    },
    deleteWorkspace: (id) => workspaces.delete(id),
    listRunsByWorkspace: (workspace_id) => Array.from(runs.values()).filter((run) => run.workspace_id === workspace_id),
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
    clearRunsForWorkspace: () => 0,
    markStaleRuns: () => 0,
    listThreadMeta: () => Array.from(threadMeta.values()),
    getThreadMeta: (thread_id) => threadMeta.get(thread_id) ?? null,
    upsertThreadMeta: (input) => {
      const existing = threadMeta.get(input.thread_id);
      const updated: ThreadMeta = {
        thread_id: input.thread_id,
        title_override: input.title_override ?? existing?.title_override ?? null,
        last_seen_at: input.last_seen_at ?? now(),
        pinned: input.pinned ?? existing?.pinned ?? false,
        archived: input.archived ?? existing?.archived ?? false
      };
      threadMeta.set(input.thread_id, updated);
      return updated;
    },
    listWorkspaceThreads: () => workspaceThreads,
    attachThreadToWorkspace: (workspace_id, thread_id) => {
      const entry = { workspace_id, thread_id, created_at: now() };
      workspaceThreads.push(entry);
      return entry;
    },
    detachThreadFromWorkspace: (workspace_id, thread_id) => {
      const before = workspaceThreads.length;
      for (let i = workspaceThreads.length - 1; i >= 0; i -= 1) {
        const entry = workspaceThreads[i];
        if (entry.workspace_id === workspace_id && entry.thread_id === thread_id) {
          workspaceThreads.splice(i, 1);
        }
      }
      return before !== workspaceThreads.length;
    },
    countWorkspaces: () => workspaces.size,
    countWorkspaceThreads: () => workspaceThreads.length
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
    const workspace = store.createWorkspace({ title: "demo", repo_path: process.cwd() });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    const runId = await manager.startRun({
      type: "test",
      workspace_id: workspace.id,
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
    const workspace = store.createWorkspace({ title: "demo", repo_path: process.cwd() });
    store.updateWorkspace(workspace.id, { notify_policy: "all" as NotifyPolicy });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    let call = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      call += 1;
      return call === 1 ? 0 : 121000;
    });

    const runId = await manager.startRun({
      type: "test",
      workspace_id: workspace.id,
      command: process.execPath,
      args: ["-e", "console.log('ok')"],
      cwd: process.cwd()
    });

    await waitForRun(store, manager, runId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
