import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type WorkspaceStatus = "idle" | "failed" | "needs_input";
export type NotifyPolicy = "off" | "needs_input+failed" | "all";
export type RunStatus = "running" | "done";
export type RunStream = "stdout" | "stderr";

export interface Workspace {
  id: string;
  title: string;
  repo_path: string;
  status: WorkspaceStatus;
  notify_policy: NotifyPolicy;
  default_thread_id: string | null;
  test_command_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  workspace_id: string | null;
  type: string;
  command: string;
  cwd: string;
  status: RunStatus;
  exit_code: number | null;
  created_at: string;
  updated_at: string;
  last_snippet: string | null;
}

export interface RunEvent {
  run_id: string;
  seq: number;
  ts: string;
  stream: RunStream;
  chunk: string;
}

export interface ThreadMeta {
  thread_id: string;
  title_override: string | null;
  last_seen_at: string;
  pinned: boolean;
  archived: boolean;
}

export interface WorkspaceThread {
  workspace_id: string;
  thread_id: string;
  created_at: string;
}

export interface Store {
  init: () => void;
  listWorkspaces: () => Workspace[];
  getWorkspace: (id: string) => Workspace | null;
  createWorkspace: (input: { title: string; repo_path: string }) => Workspace;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => Workspace | null;
  deleteWorkspace: (id: string) => boolean;
  listRunsByWorkspace: (workspace_id: string, limit?: number) => Run[];
  getRun: (id: string) => Run | null;
  createRun: (input: Omit<Run, "created_at" | "updated_at" | "status" | "exit_code" | "last_snippet">) => Run;
  updateRun: (id: string, patch: Partial<Run>) => Run | null;
  appendRunEvent: (event: Omit<RunEvent, "seq">) => RunEvent;
  getRunEvents: (run_id: string, limit: number) => RunEvent[];
  clearRunsForWorkspace: (workspace_id: string) => number;
  markStaleRuns: () => number;
  listThreadMeta: () => ThreadMeta[];
  getThreadMeta: (thread_id: string) => ThreadMeta | null;
  upsertThreadMeta: (input: {
    thread_id: string;
    title_override?: string | null;
    last_seen_at?: string;
    pinned?: boolean;
    archived?: boolean;
  }) => ThreadMeta;
  listWorkspaceThreads: () => WorkspaceThread[];
  attachThreadToWorkspace: (workspace_id: string, thread_id: string) => WorkspaceThread;
  detachThreadFromWorkspace: (workspace_id: string, thread_id: string) => boolean;
  countWorkspaces: () => number;
  countWorkspaceThreads: () => number;
}

const now = () => new Date().toISOString();
const defaultNotifyPolicy: NotifyPolicy = "needs_input+failed";

const normalizeWorkspace = (workspace: Workspace): Workspace => {
  const notify = workspace.notify_policy || defaultNotifyPolicy;
  const status = workspace.status || "idle";
  return {
    ...workspace,
    notify_policy: notify,
    status,
    default_thread_id: workspace.default_thread_id ?? null,
    test_command_override: workspace.test_command_override ?? null
  };
};

const normalizeThreadMeta = (meta: ThreadMeta): ThreadMeta => ({
  ...meta,
  title_override: meta.title_override ?? null,
  pinned: Boolean(meta.pinned),
  archived: Boolean(meta.archived)
});

const defaultDataDir = () => resolve(process.cwd(), "..", "..", ".godex");

interface JsonData {
  workspaces: Workspace[];
  runs: Run[];
  run_events: Record<string, RunEvent[]>;
  thread_meta: ThreadMeta[];
  workspace_threads: WorkspaceThread[];
}

const emptyJsonData = (): JsonData => ({
  workspaces: [],
  runs: [],
  run_events: {},
  thread_meta: [],
  workspace_threads: []
});

export const migrateJsonData = (raw: any): JsonData => {
  const workspaces: Workspace[] = Array.isArray(raw?.workspaces)
    ? raw.workspaces
    : Array.isArray(raw?.sessions)
      ? raw.sessions.map((session: any) => {
        const notifyMode = session?.notify_mode;
        const notify_policy = notifyMode === "needs_input_failed" ? "needs_input+failed" : notifyMode;
        return normalizeWorkspace({
          id: String(session.id),
          title: String(session.title ?? session.repo_path ?? "workspace"),
          repo_path: String(session.repo_path ?? ""),
          status: (session.status as WorkspaceStatus) ?? "idle",
          notify_policy: (notify_policy as NotifyPolicy) ?? defaultNotifyPolicy,
          default_thread_id: null,
          test_command_override: null,
          created_at: String(session.created_at ?? now()),
          updated_at: String(session.updated_at ?? now())
        });
      })
      : [];

  const runs: Run[] = Array.isArray(raw?.runs)
    ? raw.runs.map((run: any) => {
      const { session_id, ...rest } = run ?? {};
      return {
        ...rest,
        workspace_id: run?.workspace_id ?? session_id ?? null
      };
    })
    : [];

  const run_events = raw?.run_events ?? {};

  const threadMeta: ThreadMeta[] = Array.isArray(raw?.thread_meta)
    ? raw.thread_meta.map((meta: ThreadMeta) => normalizeThreadMeta(meta))
    : [];

  const workspaceThreads: WorkspaceThread[] = Array.isArray(raw?.workspace_threads)
    ? raw.workspace_threads
    : [];

  if (Array.isArray(raw?.threads_map)) {
    for (const entry of raw.threads_map) {
      const existing = threadMeta.find((meta) => meta.thread_id === entry.thread_id);
      if (!existing) {
        threadMeta.push(
          normalizeThreadMeta({
            thread_id: String(entry.thread_id),
            title_override: entry.title_override ?? null,
            last_seen_at: entry.last_seen_at ?? now(),
            pinned: false,
            archived: false
          })
        );
      }
      if (entry.repo_session_id) {
        const mapped: WorkspaceThread = {
          workspace_id: String(entry.repo_session_id),
          thread_id: String(entry.thread_id),
          created_at: entry.last_seen_at ?? now()
        };
        if (!workspaceThreads.find((link) => link.workspace_id === mapped.workspace_id && link.thread_id === mapped.thread_id)) {
          workspaceThreads.push(mapped);
        }
      }
    }
  }

  return {
    workspaces,
    runs,
    run_events,
    thread_meta: threadMeta,
    workspace_threads: workspaceThreads
  };
};

const loadJson = (filePath: string): JsonData => {
  if (!existsSync(filePath)) {
    return emptyJsonData();
  }
  const raw = readFileSync(filePath, "utf8");
  try {
    const data = JSON.parse(raw);
    return migrateJsonData(data);
  } catch {
    return emptyJsonData();
  }
};

const saveJson = (filePath: string, data: JsonData) => {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const createJsonStore = (dataDir: string): Store => {
  const filePath = resolve(dataDir, "data.json");

  const ensure = () => {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    if (!existsSync(filePath)) {
      saveJson(filePath, emptyJsonData());
    } else {
      const migrated = loadJson(filePath);
      saveJson(filePath, migrated);
    }
  };

  const withData = <T>(fn: (data: JsonData) => T): T => {
    const data = loadJson(filePath);
    const result = fn(data);
    saveJson(filePath, data);
    return result;
  };

  return {
    init: ensure,
    listWorkspaces: () => loadJson(filePath).workspaces.map(normalizeWorkspace),
    getWorkspace: (id) => {
      const workspace = loadJson(filePath).workspaces.find((s) => s.id === id);
      return workspace ? normalizeWorkspace(workspace) : null;
    },
    createWorkspace: ({ title, repo_path }) =>
      withData((data) => {
        const ts = now();
        const workspace: Workspace = normalizeWorkspace({
          id: randomUUID(),
          title,
          repo_path,
          status: "idle",
          notify_policy: defaultNotifyPolicy,
          default_thread_id: null,
          test_command_override: null,
          created_at: ts,
          updated_at: ts
        });
        data.workspaces.push(workspace);
        return workspace;
      }),
    updateWorkspace: (id, patch) =>
      withData((data) => {
        const workspace = data.workspaces.find((s) => s.id === id);
        if (!workspace) return null;
        Object.assign(workspace, patch, { updated_at: now() });
        return normalizeWorkspace(workspace);
      }),

    deleteWorkspace: (id) =>
      withData((data) => {
        const before = data.workspaces.length;
        data.workspaces = data.workspaces.filter((workspace) => workspace.id !== id);
        if (before === data.workspaces.length) return false;
        const runIds = new Set(data.runs.filter((run) => run.workspace_id === id).map((run) => run.id));
        data.runs = data.runs.filter((run) => run.workspace_id !== id);
        for (const runId of runIds) {
          delete data.run_events[runId];
        }
        data.workspace_threads = data.workspace_threads.filter((entry) => entry.workspace_id !== id);
        return true;
      }),
    listRunsByWorkspace: (workspace_id, limit = 10) => {
      const runs = loadJson(filePath).runs.filter((r) => r.workspace_id === workspace_id);
      runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return runs.slice(0, limit);
    },
    getRun: (id) => loadJson(filePath).runs.find((r) => r.id === id) ?? null,
    createRun: (input) =>
      withData((data) => {
        const ts = now();
        const run: Run = {
          ...input,
          status: "running",
          exit_code: null,
          created_at: ts,
          updated_at: ts,
          last_snippet: null
        };
        data.runs.push(run);
        return run;
      }),
    updateRun: (id, patch) =>
      withData((data) => {
        const run = data.runs.find((r) => r.id === id);
        if (!run) return null;
        Object.assign(run, patch, { updated_at: now() });
        return run;
      }),
    appendRunEvent: (event) =>
      withData((data) => {
        const seq = (data.run_events[event.run_id]?.length ?? 0) + 1;
        const runEvent: RunEvent = { ...event, seq };
        if (!data.run_events[event.run_id]) {
          data.run_events[event.run_id] = [];
        }
        data.run_events[event.run_id].push(runEvent);
        return runEvent;
      }),
    getRunEvents: (run_id, limit) => {
      const events = loadJson(filePath).run_events[run_id] ?? [];
      return events.slice(Math.max(0, events.length - limit));
    },
    clearRunsForWorkspace: (workspace_id) =>
      withData((data) => {
        const runIds = new Set(data.runs.filter((r) => r.workspace_id === workspace_id).map((r) => r.id));
        const before = data.runs.length;
        data.runs = data.runs.filter((r) => r.workspace_id !== workspace_id);
        for (const id of runIds) {
          delete data.run_events[id];
        }
        return before - data.runs.length;
      }),
    markStaleRuns: () =>
      withData((data) => {
        let count = 0;
        const ts = now();
        for (const run of data.runs) {
          if (run.status === "running") {
            run.status = "done";
            run.exit_code = -1;
            run.updated_at = ts;
            count += 1;
          }
        }
        return count;
      }),
    listThreadMeta: () => loadJson(filePath).thread_meta.map(normalizeThreadMeta),
    getThreadMeta: (thread_id) => {
      const meta = loadJson(filePath).thread_meta.find((entry) => entry.thread_id === thread_id) ?? null;
      return meta ? normalizeThreadMeta(meta) : null;
    },
    upsertThreadMeta: (input) =>
      withData((data) => {
        if (!data.thread_meta) {
          data.thread_meta = [];
        }
        const existing = data.thread_meta.find((entry) => entry.thread_id === input.thread_id) ?? null;
        const updated: ThreadMeta = normalizeThreadMeta({
          thread_id: input.thread_id,
          title_override: input.title_override ?? existing?.title_override ?? null,
          last_seen_at: input.last_seen_at ?? now(),
          pinned: input.pinned ?? existing?.pinned ?? false,
          archived: input.archived ?? existing?.archived ?? false
        });
        if (existing) {
          Object.assign(existing, updated);
          return existing;
        }
        data.thread_meta.push(updated);
        return updated;
      }),
    listWorkspaceThreads: () => loadJson(filePath).workspace_threads ?? [],
    attachThreadToWorkspace: (workspace_id, thread_id) =>
      withData((data) => {
        const created_at = now();
        const existing = data.workspace_threads.find((entry) => entry.workspace_id === workspace_id && entry.thread_id === thread_id);
        if (existing) return existing;
        const entry: WorkspaceThread = { workspace_id, thread_id, created_at };
        data.workspace_threads.push(entry);
        return entry;
      }),
    detachThreadFromWorkspace: (workspace_id, thread_id) =>
      withData((data) => {
        const before = data.workspace_threads.length;
        data.workspace_threads = data.workspace_threads.filter(
          (entry) => !(entry.workspace_id === workspace_id && entry.thread_id === thread_id)
        );
        return before !== data.workspace_threads.length;
      }),
    countWorkspaces: () => loadJson(filePath).workspaces.length,
    countWorkspaceThreads: () => loadJson(filePath).workspace_threads.length
  };
};

const createSqliteStore = (dataDir: string, dbPath: string): Store => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);

  const tableExists = (name: string): boolean => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
    return Boolean(row);
  };

  const columnExists = (table: string, column: string): boolean => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === column);
  };

  const init = () => {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    db.exec("PRAGMA foreign_keys = OFF");

    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        status TEXT NOT NULL,
        notify_policy TEXT DEFAULT 'needs_input+failed',
        default_thread_id TEXT,
        test_command_override TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        type TEXT NOT NULL,
        command TEXT NOT NULL,
        cwd TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_snippet TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
      );
      CREATE TABLE IF NOT EXISTS run_events (
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT NOT NULL,
        stream TEXT NOT NULL,
        chunk TEXT NOT NULL,
        PRIMARY KEY(run_id, seq)
      );
      CREATE TABLE IF NOT EXISTS thread_meta (
        thread_id TEXT PRIMARY KEY,
        title_override TEXT,
        last_seen_at TEXT NOT NULL,
        pinned INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS workspace_threads (
        workspace_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, thread_id),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
      );
    `);

    if (tableExists("sessions")) {
      const hasWorkspaceRows = db.prepare("SELECT COUNT(*) as count FROM workspaces").get() as { count: number };
      if ((hasWorkspaceRows?.count ?? 0) === 0) {
        db.prepare(
          "INSERT INTO workspaces (id, title, repo_path, status, notify_policy, default_thread_id, test_command_override, created_at, updated_at) " +
            "SELECT id, title, repo_path, status, " +
            "CASE WHEN notify_mode = 'needs_input_failed' THEN 'needs_input+failed' ELSE COALESCE(notify_mode, 'needs_input+failed') END, " +
            "NULL, NULL, created_at, updated_at FROM sessions"
        ).run();
      }
      db.exec("DROP TABLE sessions");
    }

    if (tableExists("runs") && columnExists("runs", "session_id")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS runs_new (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          type TEXT NOT NULL,
          command TEXT NOT NULL,
          cwd TEXT NOT NULL,
          status TEXT NOT NULL,
          exit_code INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_snippet TEXT,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        );
      `);
      db.prepare(
        "INSERT INTO runs_new (id, workspace_id, type, command, cwd, status, exit_code, created_at, updated_at, last_snippet) " +
          "SELECT id, session_id, type, command, cwd, status, exit_code, created_at, updated_at, last_snippet FROM runs"
      ).run();
      db.exec("DROP TABLE runs");
      db.exec("ALTER TABLE runs_new RENAME TO runs");
    }

    if (tableExists("threads_map")) {
      db.prepare(
        "INSERT INTO thread_meta (thread_id, title_override, last_seen_at, pinned, archived) " +
          "SELECT thread_id, title_override, last_seen_at, 0, 0 FROM threads_map " +
          "ON CONFLICT(thread_id) DO UPDATE SET title_override = excluded.title_override, last_seen_at = excluded.last_seen_at"
      ).run();
      db.prepare(
        "INSERT OR IGNORE INTO workspace_threads (workspace_id, thread_id, created_at) " +
          "SELECT repo_session_id, thread_id, last_seen_at FROM threads_map WHERE repo_session_id IS NOT NULL"
      ).run();
      db.exec("DROP TABLE threads_map");
    }

    db.exec("PRAGMA foreign_keys = ON");
  };

  return {
    init,
    listWorkspaces: () => db.prepare("SELECT * FROM workspaces ORDER BY created_at DESC").all().map(normalizeWorkspace),
    getWorkspace: (id) => {
      const workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) ?? null;
      return workspace ? normalizeWorkspace(workspace) : null;
    },
    createWorkspace: ({ title, repo_path }) => {
      const ts = now();
      const workspace: Workspace = normalizeWorkspace({
        id: randomUUID(),
        title,
        repo_path,
        status: "idle",
        notify_policy: defaultNotifyPolicy,
        default_thread_id: null,
        test_command_override: null,
        created_at: ts,
        updated_at: ts
      });
      db.prepare(
        "INSERT INTO workspaces (id, title, repo_path, status, notify_policy, default_thread_id, test_command_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        workspace.id,
        workspace.title,
        workspace.repo_path,
        workspace.status,
        workspace.notify_policy,
        workspace.default_thread_id,
        workspace.test_command_override,
        workspace.created_at,
        workspace.updated_at
      );
      return workspace;
    },
    updateWorkspace: (id, patch) => {
      const existing = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id);
      if (!existing) return null;
      const updated = normalizeWorkspace({ ...existing, ...patch, updated_at: now() } as Workspace);
      db.prepare(
        "UPDATE workspaces SET title = ?, repo_path = ?, status = ?, notify_policy = ?, default_thread_id = ?, test_command_override = ?, updated_at = ? WHERE id = ?"
      ).run(
        updated.title,
        updated.repo_path,
        updated.status,
        updated.notify_policy,
        updated.default_thread_id,
        updated.test_command_override,
        updated.updated_at,
        id
      );
      return updated;
    },

    deleteWorkspace: (id) => {
      db.prepare("DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE workspace_id = ?)").run(id);
      db.prepare("DELETE FROM runs WHERE workspace_id = ?").run(id);
      db.prepare("DELETE FROM workspace_threads WHERE workspace_id = ?").run(id);
      const info = db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
      return (info.changes ?? 0) > 0;
    },
    listRunsByWorkspace: (workspace_id, limit = 10) =>
      db.prepare("SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(workspace_id, limit),
    getRun: (id) => db.prepare("SELECT * FROM runs WHERE id = ?").get(id) ?? null,
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
      db.prepare(
        "INSERT INTO runs (id, workspace_id, type, command, cwd, status, exit_code, created_at, updated_at, last_snippet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        run.id,
        run.workspace_id,
        run.type,
        run.command,
        run.cwd,
        run.status,
        run.exit_code,
        run.created_at,
        run.updated_at,
        run.last_snippet
      );
      return run;
    },
    updateRun: (id, patch) => {
      const existing = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updated_at: now() } as Run;
      db.prepare(
        "UPDATE runs SET type = ?, command = ?, cwd = ?, status = ?, exit_code = ?, updated_at = ?, last_snippet = ? WHERE id = ?"
      ).run(
        updated.type,
        updated.command,
        updated.cwd,
        updated.status,
        updated.exit_code,
        updated.updated_at,
        updated.last_snippet,
        id
      );
      return updated;
    },
    clearRunsForWorkspace: (workspace_id) => {
      const info = db.prepare("DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE workspace_id = ?)").run(workspace_id);
      const infoRuns = db.prepare("DELETE FROM runs WHERE workspace_id = ?").run(workspace_id);
      return infoRuns.changes ?? info.changes ?? 0;
    },
    markStaleRuns: () => {
      const info = db.prepare("UPDATE runs SET status = ?, exit_code = ?, updated_at = ? WHERE status = ?").run(
        "done",
        -1,
        now(),
        "running"
      );
      return info.changes ?? 0;
    },
    appendRunEvent: (event) => {
      const row = db
        .prepare("SELECT MAX(seq) as seq FROM run_events WHERE run_id = ?")
        .get(event.run_id) as { seq: number | null };
      const seq = (row?.seq ?? 0) + 1;
      const runEvent: RunEvent = { ...event, seq };
      db.prepare(
        "INSERT INTO run_events (run_id, seq, ts, stream, chunk) VALUES (?, ?, ?, ?, ?)"
      ).run(runEvent.run_id, runEvent.seq, runEvent.ts, runEvent.stream, runEvent.chunk);
      return runEvent;
    },
    getRunEvents: (run_id, limit) =>
      db
        .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY seq DESC LIMIT ?")
        .all(run_id, limit)
        .reverse(),
    listThreadMeta: () => db.prepare("SELECT * FROM thread_meta").all().map(normalizeThreadMeta),
    getThreadMeta: (thread_id) => {
      const meta = db.prepare("SELECT * FROM thread_meta WHERE thread_id = ?").get(thread_id) ?? null;
      return meta ? normalizeThreadMeta(meta) : null;
    },
    upsertThreadMeta: (input) => {
      const existing = db.prepare("SELECT * FROM thread_meta WHERE thread_id = ?").get(input.thread_id) as ThreadMeta | undefined;
      const updated: ThreadMeta = normalizeThreadMeta({
        thread_id: input.thread_id,
        title_override: input.title_override ?? existing?.title_override ?? null,
        last_seen_at: input.last_seen_at ?? now(),
        pinned: input.pinned ?? existing?.pinned ?? false,
        archived: input.archived ?? existing?.archived ?? false
      });
      db.prepare(
        "INSERT INTO thread_meta (thread_id, title_override, last_seen_at, pinned, archived) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(thread_id) DO UPDATE SET title_override = excluded.title_override, last_seen_at = excluded.last_seen_at, pinned = excluded.pinned, archived = excluded.archived"
      ).run(updated.thread_id, updated.title_override, updated.last_seen_at, updated.pinned ? 1 : 0, updated.archived ? 1 : 0);
      return updated;
    },
    listWorkspaceThreads: () => db.prepare("SELECT * FROM workspace_threads").all() as WorkspaceThread[],
    attachThreadToWorkspace: (workspace_id, thread_id) => {
      const created_at = now();
      db.prepare(
        "INSERT OR IGNORE INTO workspace_threads (workspace_id, thread_id, created_at) VALUES (?, ?, ?)"
      ).run(workspace_id, thread_id, created_at);
      return { workspace_id, thread_id, created_at };
    },
    detachThreadFromWorkspace: (workspace_id, thread_id) => {
      const info = db.prepare("DELETE FROM workspace_threads WHERE workspace_id = ? AND thread_id = ?").run(workspace_id, thread_id);
      return (info.changes ?? 0) > 0;
    },
    countWorkspaces: () => {
      const row = db.prepare("SELECT COUNT(*) as count FROM workspaces").get() as { count: number };
      return row?.count ?? 0;
    },
    countWorkspaceThreads: () => {
      const row = db.prepare("SELECT COUNT(*) as count FROM workspace_threads").get() as { count: number };
      return row?.count ?? 0;
    }
  };
};

export const createStore = (): { store: Store; backend: "sqlite" | "json" } => {
  const dataDir = process.env.GODEX_DATA_DIR ? resolve(process.env.GODEX_DATA_DIR) : defaultDataDir();
  const dbPath = resolve(dataDir, "godex.sqlite");

  try {
    const store = createSqliteStore(dataDir, dbPath);
    store.init();
    return { store, backend: "sqlite" };
  } catch (err) {
    const store = createJsonStore(dataDir);
    store.init();
    return { store, backend: "json" };
  }
};
