import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, migrateJsonData } from "../src/store";
import { mergeThreadList } from "../src/routes/threads";

const makeTempDir = () => {
  const base = mkdtempSync(join(tmpdir(), "godex-test-"));
  mkdirSync(base, { recursive: true });
  return base;
};

describe("workspace migration", () => {
  it("migrates sessions to workspaces with thread mappings", () => {
    const raw = {
      sessions: [
        {
          id: "s-1",
          title: "Demo",
          repo_path: "C:\\repo",
          status: "idle",
          notify_mode: "needs_input_failed",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z"
        }
      ],
      runs: [
        {
          id: "r-1",
          session_id: "s-1",
          type: "test",
          command: "pnpm test",
          cwd: "C:\\repo",
          status: "done",
          exit_code: 0,
          created_at: "2025-01-02T00:00:00.000Z",
          updated_at: "2025-01-02T00:00:00.000Z",
          last_snippet: null
        }
      ],
      threads_map: [
        {
          thread_id: "t-1",
          repo_session_id: "s-1",
          title_override: "Thread A",
          last_seen_at: "2025-01-03T00:00:00.000Z"
        }
      ],
      run_events: {}
    };

    const migrated = migrateJsonData(raw);
    expect(migrated.workspaces).toHaveLength(1);
    expect(migrated.workspaces[0].id).toBe("s-1");
    expect(migrated.workspaces[0].notify_policy).toBe("needs_input+failed");
    expect(migrated.runs[0].workspace_id).toBe("s-1");
    expect((migrated.runs[0] as any).session_id).toBeUndefined();
    expect(migrated.thread_meta).toHaveLength(1);
    expect(migrated.thread_meta[0].thread_id).toBe("t-1");
    expect(migrated.workspace_threads).toHaveLength(1);
    expect(migrated.workspace_threads[0].workspace_id).toBe("s-1");
  });
});

describe("workspace thread attachments", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDir();
    process.env.GODEX_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.GODEX_DATA_DIR;
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // sqlite keeps a handle open on windows; ignore cleanup failures
    }
  });

  it("persists attach/detach mappings", () => {
    const { store } = createStore();
    const workspace = store.createWorkspace({ title: "Demo", repo_path: process.cwd() });
    store.attachThreadToWorkspace(workspace.id, "thread-1");

    const { store: storeReloaded } = createStore();
    expect(storeReloaded.listWorkspaceThreads()).toHaveLength(1);

    storeReloaded.detachThreadFromWorkspace(workspace.id, "thread-1");
    const { store: storeReloadedAgain } = createStore();
    expect(storeReloadedAgain.listWorkspaceThreads()).toHaveLength(0);
  });
});

describe("thread list merge", () => {
  it("merges remote threads with local meta and attachments", () => {
    const items = [
      { id: "t-1", preview: "hello", updated_at: "2025-01-04T00:00:00.000Z" },
      { id: "t-2", preview: "archived", updated_at: "2025-01-05T00:00:00.000Z" }
    ];
    const meta = [
      { thread_id: "t-1", title_override: "Custom", last_seen_at: "2025-01-05T00:00:00.000Z", pinned: false, archived: false },
      { thread_id: "t-2", title_override: null, last_seen_at: "2025-01-05T00:00:00.000Z", pinned: false, archived: true }
    ];
    const links = [
      { workspace_id: "w-1", thread_id: "t-1", created_at: "2025-01-05T00:00:00.000Z" }
    ];

    const merged = mergeThreadList(items, meta as any, links as any, false);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Custom");
    expect(merged[0].attached_workspace_ids).toEqual(["w-1"]);

    const mergedWithArchived = mergeThreadList(items, meta as any, links as any, true);
    expect(mergedWithArchived).toHaveLength(2);
  });
});
