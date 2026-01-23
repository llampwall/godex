import { FastifyInstance } from "fastify";
import { CodexAppServerManager } from "../codex_app_server_manager.js";
import { RunManager } from "../run_manager.js";
import { Store } from "../store.js";

const DEFAULT_LIMIT = 50;
const FALLBACK_SESSION_ID = "threads";

const extractString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  return null;
};

const extractThreadId = (message: any): string | null => {
  return (
    extractString(message?.params?.threadId) ||
    extractString(message?.params?.thread_id) ||
    extractString(message?.params?.thread?.id) ||
    extractString(message?.params?.thread?.thread_id)
  );
};

const extractTurnId = (message: any): string | null => {
  return (
    extractString(message?.params?.turnId) ||
    extractString(message?.params?.turn_id) ||
    extractString(message?.params?.turn?.id) ||
    extractString(message?.params?.turn?.turn_id)
  );
};

const extractDeltaText = (message: any): string | null => {
  const delta = message?.params?.delta;
  if (!delta) return null;
  if (typeof delta === "string") return delta;
  if (typeof delta?.text === "string") return delta.text;
  if (typeof delta?.content === "string") return delta.content;
  if (typeof delta?.content?.text === "string") return delta.content.text;
  return null;
};

const extractMessageText = (message: any): string | null => {
  const params = message?.params ?? {};
  if (typeof params.text === "string") return params.text;
  if (typeof params.message?.text === "string") return params.message.text;
  if (typeof params.message?.content === "string") return params.message.content;
  if (typeof params.item?.content === "string") return params.item.content;
  if (Array.isArray(params.item?.content)) {
    const text = params.item.content
      .map((entry: any) => (typeof entry?.text === "string" ? entry.text : null))
      .filter(Boolean)
      .join("");
    if (text) return text;
  }
  return null;
};


const normalizeTimestamp = (value: unknown): string | null => {
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      const date = new Date(ms);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  return null;
};

const summarizeNotification = (message: any): string => {
  const method = message?.method ?? "notification";
  const summary = message?.params?.status || message?.params?.reason || message?.params?.state;
  if (summary) return `[${method}] ${summary}`;
  return `[${method}]`;
};

const normalizeThreadItem = (item: any, store: Store) => {
  const thread_id = item?.id ?? item?.thread_id ?? item?.threadId ?? "";
  const preview = item?.preview ?? item?.title ?? "";
  const updatedAt = item?.updatedAt ?? item?.updated_at ?? item?.updated ?? item?.modifiedAt;
  const normalizedUpdated = normalizeTimestamp(updatedAt);
  const mapping = thread_id ? store.getThreadMap(thread_id) : null;
  const title = mapping?.title_override || preview || "(untitled)";
  return {
    thread_id,
    title,
    updated_at: normalizedUpdated ?? updatedAt ?? null,
    summary: preview || undefined
  };
};

const build503 = (reply: any, appServer: CodexAppServerManager) => {
  const status = appServer.getStatus();
  return reply.code(503).send({
    ok: false,
    error: "codex app-server unavailable",
    status,
    logs: appServer.getLogLines()
  });
};

export const registerThreadRoutes = (
  app: FastifyInstance,
  store: Store,
  runManager: RunManager,
  appServer: CodexAppServerManager
) => {
  let threadSearchSupported: boolean | null = null;
  let threadReadSupported: boolean | null = null;

  app.get("/threads", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }

    const query = req.query as { limit?: string; cursor?: string; offset?: string; q?: string } | undefined;
    const limit = Math.max(1, Math.min(Number(query?.limit ?? DEFAULT_LIMIT), 200));
    const offset = Math.max(0, Number(query?.offset ?? 0));
    const cursor = query?.cursor || undefined;
    const search = query?.q?.trim();

    const fetchList = async (cursorValue?: string, useSearch?: boolean) => {
      const params: Record<string, unknown> = { limit };
      if (cursorValue) params.cursor = cursorValue;
      if (useSearch && search) params.query = search;
      return appServer.request("thread/list", params);
    };

    let result: any;
    if (search && threadSearchSupported !== false) {
      try {
        result = await fetchList(cursor, true);
        threadSearchSupported = true;
      } catch (err) {
        threadSearchSupported = false;
        result = await fetchList(cursor, false);
      }
    } else {
      result = await fetchList(cursor, threadSearchSupported === true);
    }

    const rawItems = result?.threads ?? result?.items ?? result?.data ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];

    let data: any[] = [];
    let nextCursor: string | null = result?.nextCursor ?? result?.next_cursor ?? null;

    if (offset > 0) {
      let skipped = 0;
      let cursorValue = cursor;
      let pageItems = items;

      while (skipped < offset && pageItems.length > 0) {
        for (const item of pageItems) {
          if (skipped < offset) {
            skipped += 1;
            continue;
          }
          if (data.length < limit) {
            data.push(item);
          }
        }

        if (data.length >= limit) {
          nextCursor = null;
          break;
        }

        if (!nextCursor) break;
        const nextPage = await fetchList(nextCursor, threadSearchSupported === true);
        nextCursor = nextPage?.nextCursor ?? nextPage?.next_cursor ?? null;
        pageItems = Array.isArray(nextPage?.threads ?? nextPage?.items ?? nextPage?.data)
          ? (nextPage?.threads ?? nextPage?.items ?? nextPage?.data)
          : [];
      }
    } else {
      data = items.slice(0, limit);
    }

    if (search && threadSearchSupported === false) {
      data = data.filter((item) => {
        const preview = String(item?.preview ?? "").toLowerCase();
        const title = String(item?.title ?? "").toLowerCase();
        const q = search.toLowerCase();
        return preview.includes(q) || title.includes(q);
      });
    }

    const normalized = data.map((item) => normalizeThreadItem(item, store)).filter((entry) => entry.thread_id);
    return { data: normalized, next_cursor: nextCursor };
  });

  app.get("/threads/:thread_id", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }
    const { thread_id } = req.params as { thread_id: string };
    if (!thread_id) {
      return reply.code(400).send({ ok: false, error: "thread_id required" });
    }

    const tryRead = async () => appServer.request("thread/read", { threadId: thread_id });
    const tryResume = async () => appServer.request("thread/resume", { threadId: thread_id });

    let result: any;
    if (threadReadSupported !== false) {
      try {
        result = await tryRead();
        threadReadSupported = true;
      } catch (err) {
        threadReadSupported = false;
        result = await tryResume();
      }
    } else {
      result = await tryResume();
    }

    store.upsertThreadMap({ thread_id, last_seen_at: new Date().toISOString() });

    const thread = result?.thread ?? result?.data?.thread ?? (result?.threadId ? result : result?.data ?? result);
    const threadUpdated = thread && typeof thread === "object"
      ? normalizeTimestamp((thread as any).updatedAt ?? (thread as any).updated_at ?? (thread as any).updated)
      : null;
    const threadPayload = thread && typeof thread === "object"
      ? { ...(thread as Record<string, unknown>), updated_at: threadUpdated ?? (thread as any).updated_at ?? null }
      : thread;

    return {
      thread: threadPayload,
      items: result?.items ?? result?.data?.items,
      turns: result?.turns ?? result?.data?.turns,
      has_more: result?.has_more ?? result?.data?.has_more
    };
  });

  app.post("/threads/:thread_id/message", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }

    const { thread_id } = req.params as { thread_id: string };
    const body = req.body as { text?: string; repo_session_id?: string };

    if (!body?.text || !body.text.trim()) {
      return reply.code(400).send({ ok: false, error: "text required" });
    }

    let sessionId = body.repo_session_id ?? FALLBACK_SESSION_ID;
    if (body.repo_session_id) {
      const session = store.getSession(body.repo_session_id);
      if (!session) {
        return reply.code(400).send({ ok: false, error: "repo_session_id not found" });
      }
      sessionId = session.id;
    }

    const run_id = runManager.startExternalRun({
      type: "codex_thread",
      session_id: sessionId,
      command: "codex app-server",
      cwd: process.cwd()
    });

    store.upsertThreadMap({
      thread_id,
      repo_session_id: body.repo_session_id ?? null,
      last_seen_at: new Date().toISOString()
    });

    let currentTurnId: string | null = null;
    let completed = false;

    const unsubscribe = appServer.subscribe((message) => {
      const turnId = extractTurnId(message);
      const messageThreadId = extractThreadId(message);

      if (currentTurnId && turnId && turnId !== currentTurnId) {
        return;
      }

      if (!currentTurnId && turnId) {
        currentTurnId = turnId;
      }

      if (messageThreadId && messageThreadId !== thread_id) {
        return;
      }

      const deltaText = extractDeltaText(message) || extractMessageText(message);
      if (deltaText) {
        runManager.appendExternalEvent(run_id, "stdout", deltaText);
      } else {
        runManager.appendExternalEvent(run_id, "stderr", summarizeNotification(message));
      }

      if (message.method === "turn/completed") {
        if (completed) return;
        completed = true;
        const status = message?.params?.status ?? message?.params?.turn?.status;
        const exitCode = status === "failed" ? 1 : 0;
        runManager.finalizeExternalRun(run_id, exitCode);
        unsubscribe();
      }
    });

    try {
      await appServer.request("thread/resume", { threadId: thread_id });
      const result = await appServer.request("turn/start", {
        threadId: thread_id,
        input: [{ type: "text", text: body.text.trim() }],
        approvalPolicy: "never"
      });
      const returnedTurnId = extractTurnId(result) || extractTurnId({ params: result?.turn ?? result?.data?.turn });
      if (returnedTurnId) {
        currentTurnId = returnedTurnId;
      }
    } catch (err: any) {
      unsubscribe();
      const message = err?.message ?? "turn start failed";
      runManager.appendExternalEvent(run_id, "stderr", message);
      runManager.finalizeExternalRun(run_id, 1, message);
    }

    return { run_id };
  });
};
