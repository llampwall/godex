import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type SessionStatus = "idle" | "failed" | "needs_input";
export type NotifyMode = "off" | "needs_input_failed" | "all";
export type RunStatus = "running" | "done";
export type RunStream = "stdout" | "stderr";

export interface Session {
  id: string;
  title: string;
  repo_path: string;
  status: SessionStatus;
  notify_mode: NotifyMode;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  session_id: string;
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

export interface Store {
  init: () => void;
  listSessions: () => Session[];
  getSession: (id: string) => Session | null;
  createSession: (input: { title: string; repo_path: string }) => Session;
  updateSession: (id: string, patch: Partial<Session>) => Session | null;
  listRunsBySession: (session_id: string, limit?: number) => Run[];
  getRun: (id: string) => Run | null;
  createRun: (input: Omit<Run, "created_at" | "updated_at" | "status" | "exit_code" | "last_snippet">) => Run;
  updateRun: (id: string, patch: Partial<Run>) => Run | null;
  appendRunEvent: (event: Omit<RunEvent, "seq">) => RunEvent;
  getRunEvents: (run_id: string, limit: number) => RunEvent[];
  clearRunsForSession: (session_id: string) => number;
  markStaleRuns: () => number;
}

const now = () => new Date().toISOString();
const defaultNotifyMode: NotifyMode = "needs_input_failed";

const normalizeSession = (session: Session): Session => {
  if (!session.notify_mode) {
    return { ...session, notify_mode: defaultNotifyMode };
  }
  return session;
};

const defaultDataDir = () => resolve(process.cwd(), "..", "..", ".godex");

interface JsonData {
  sessions: Session[];
  runs: Run[];
  run_events: Record<string, RunEvent[]>;
}

const loadJson = (filePath: string): JsonData => {
  if (!existsSync(filePath)) {
    return { sessions: [], runs: [], run_events: {} };
  }
  const raw = readFileSync(filePath, "utf8");
  try {
    const data = JSON.parse(raw) as JsonData;
    return {
      sessions: data.sessions ?? [],
      runs: data.runs ?? [],
      run_events: data.run_events ?? {}
    };
  } catch {
    return { sessions: [], runs: [], run_events: {} };
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
      saveJson(filePath, { sessions: [], runs: [], run_events: {} });
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
    listSessions: () => loadJson(filePath).sessions.map(normalizeSession),
    getSession: (id) => {
      const session = loadJson(filePath).sessions.find((s) => s.id === id);
      return session ? normalizeSession(session) : null;
    },
    createSession: ({ title, repo_path }) =>
      withData((data) => {
        const ts = now();
        const session: Session = {
          id: randomUUID(),
          title,
          repo_path,
          status: "idle",
          notify_mode: defaultNotifyMode,
          created_at: ts,
          updated_at: ts
        };
        data.sessions.push(session);
        return session;
      }),
    updateSession: (id, patch) =>
      withData((data) => {
        const session = data.sessions.find((s) => s.id === id);
        if (!session) return null;
        Object.assign(session, patch, { updated_at: now() });
        return normalizeSession(session);
      }),
    listRunsBySession: (session_id, limit = 10) => {
      const runs = loadJson(filePath).runs.filter((r) => r.session_id === session_id);
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
    clearRunsForSession: (session_id) =>
      withData((data) => {
        const runIds = new Set(data.runs.filter((r) => r.session_id === session_id).map((r) => r.id));
        const before = data.runs.length;
        data.runs = data.runs.filter((r) => r.session_id !== session_id);
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
      })
  };
};

const createSqliteStore = (dataDir: string, dbPath: string): Store => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);

  const init = () => {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        status TEXT NOT NULL,
        notify_mode TEXT DEFAULT 'needs_input_failed',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        command TEXT NOT NULL,
        cwd TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_snippet TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
      CREATE TABLE IF NOT EXISTS run_events (
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT NOT NULL,
        stream TEXT NOT NULL,
        chunk TEXT NOT NULL,
        PRIMARY KEY(run_id, seq)
      );
    `);
    try {
      db.exec("ALTER TABLE sessions ADD COLUMN notify_mode TEXT DEFAULT 'needs_input_failed'");
    } catch {
      // ignore if already exists
    }
  };

  return {
    init,
    listSessions: () => db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all().map(normalizeSession),
    getSession: (id) => {
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) ?? null;
      return session ? normalizeSession(session) : null;
    },
    createSession: ({ title, repo_path }) => {
      const ts = now();
      const session: Session = {
        id: randomUUID(),
        title,
        repo_path,
        status: "idle",
        notify_mode: defaultNotifyMode,
        created_at: ts,
        updated_at: ts
      };
      db.prepare(
        "INSERT INTO sessions (id, title, repo_path, status, notify_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        session.id,
        session.title,
        session.repo_path,
        session.status,
        session.notify_mode,
        session.created_at,
        session.updated_at
      );
      return session;
    },
    updateSession: (id, patch) => {
      const existing = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
      if (!existing) return null;
      const updated = normalizeSession({ ...existing, ...patch, updated_at: now() } as Session);
      db.prepare(
        "UPDATE sessions SET title = ?, repo_path = ?, status = ?, notify_mode = ?, updated_at = ? WHERE id = ?"
      ).run(updated.title, updated.repo_path, updated.status, updated.notify_mode, updated.updated_at, id);
      return updated;
    },
    listRunsBySession: (session_id, limit = 10) =>
      db.prepare("SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC LIMIT ?").all(session_id, limit),
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
        "INSERT INTO runs (id, session_id, type, command, cwd, status, exit_code, created_at, updated_at, last_snippet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        run.id,
        run.session_id,
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
    clearRunsForSession: (session_id) => {
      const info = db.prepare("DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE session_id = ?)").run(session_id);
      const infoRuns = db.prepare("DELETE FROM runs WHERE session_id = ?").run(session_id);
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
        .reverse()
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
