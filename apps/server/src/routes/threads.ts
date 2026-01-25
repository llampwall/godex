import { FastifyInstance } from "fastify";
import { CodexAppServerManager } from "../codex_app_server_manager.js";
import { RunManager } from "../run_manager.js";
import { Store, ThreadMeta, WorkspaceThread } from "../store.js";

const DEFAULT_LIMIT = 50;

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

const extractThreadIdFromResponse = (result: any): string | null => {
  return (
    extractString(result?.thread_id) ||
    extractString(result?.threadId) ||
    extractString(result?.thread?.id) ||
    extractString(result?.thread?.thread_id) ||
    extractString(result?.data?.thread_id) ||
    extractString(result?.data?.thread?.id)
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

export const mergeThreadList = (
  items: any[],
  metaList: ThreadMeta[],
  links: WorkspaceThread[],
  includeArchived: boolean
) => {
  const metaMap = new Map(metaList.map((meta) => [meta.thread_id, meta]));
  const attachmentMap = buildAttachmentMap(links);
  const normalized = items
    .map((item) => {
      const threadId = item?.id ?? item?.thread_id ?? item?.threadId ?? "";
      const meta = threadId ? metaMap.get(threadId) ?? null : null;
      const attached = threadId ? attachmentMap.get(threadId) ?? [] : [];
      return normalizeThreadItem(item, meta, attached);
    })
    .filter((entry) => entry.thread_id);

  return includeArchived ? normalized : normalized.filter((entry) => !entry.archived);
};

const buildAttachmentMap = (links: WorkspaceThread[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const link of links) {
    if (!map.has(link.thread_id)) {
      map.set(link.thread_id, []);
    }
    map.get(link.thread_id)?.push(link.workspace_id);
  }
  return map;
};

const normalizeThreadItem = (item: any, meta: ThreadMeta | null, attached: string[]) => {
  const thread_id = item?.id ?? item?.thread_id ?? item?.threadId ?? "";
  const preview = item?.preview ?? item?.title ?? "";
  const updatedAt = item?.updatedAt ?? item?.updated_at ?? item?.updated ?? item?.modifiedAt;
  const normalizedUpdated = normalizeTimestamp(updatedAt);
  const title = meta?.title_override || preview || "(untitled)";
  return {
    thread_id,
    title,
    updated_at: normalizedUpdated ?? updatedAt ?? null,
    summary: preview || undefined,
    attached_workspace_ids: attached,
    pinned: meta?.pinned ?? false,
    archived: meta?.archived ?? false,
    last_seen_at: meta?.last_seen_at ?? null
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

const createThread = async (appServer: CodexAppServerManager, title?: string) => {
  const payload = title ? { title } : {};
  const attempts: Array<{ method: string; params: Record<string, unknown> }> = [
    { method: "thread/create", params: payload },
    { method: "thread/new", params: payload },
    { method: "thread/start", params: payload }
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const result = await appServer.request(attempt.method, attempt.params);
      const threadId = extractThreadIdFromResponse(result) || extractThreadIdFromResponse(result?.data);
      if (threadId) {
        return { thread_id: threadId, result };
      }
      return { thread_id: null, result };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("thread create failed");
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

    const query = req.query as {
      limit?: string;
      cursor?: string;
      offset?: string;
      q?: string;
      include_archived?: string;
      archived?: string;
    } | undefined;
    const limit = Math.max(1, Math.min(Number(query?.limit ?? DEFAULT_LIMIT), 200));
    const offset = Math.max(0, Number(query?.offset ?? 0));
    const cursor = query?.cursor || undefined;
    const search = query?.q?.trim();
    const includeArchived = query?.include_archived === "1" || query?.archived === "1";

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

    const metaList = store.listThreadMeta();
    const links = store.listWorkspaceThreads();
    const merged = mergeThreadList(data, metaList, links, includeArchived);

    return { data: merged, next_cursor: nextCursor };
  });

  app.get("/threads/meta", async () => {
    return { ok: true, meta: store.listThreadMeta() };
  });

  app.patch("/threads/:thread_id/meta", async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const body = req.body as { title_override?: string | null; pinned?: boolean; archived?: boolean };
    if (!thread_id) {
      return reply.code(400).send({ ok: false, error: "thread_id required" });
    }
    const updated = store.upsertThreadMeta({
      thread_id,
      title_override: body.title_override ?? undefined,
      pinned: body.pinned ?? undefined,
      archived: body.archived ?? undefined,
      last_seen_at: new Date().toISOString()
    });
    return { ok: true, meta: updated };
  });

  app.post("/threads/create", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }
    const body = req.body as { title?: string } | undefined;
    try {
      const created = await createThread(appServer, body?.title);
      if (created.thread_id) {
        store.upsertThreadMeta({ thread_id: created.thread_id, last_seen_at: new Date().toISOString() });
      }
      return { ok: true, thread_id: created.thread_id, raw: created.result };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err?.message ?? "thread create failed" });
    }
  });

  app.get("/threads/:thread_id", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }
    const { thread_id } = req.params as { thread_id: string };
    if (!thread_id) {
      return reply.code(400).send({ ok: false, error: "thread_id required" });
    }

    const tryRead = async () => appServer.request("thread/read", { threadId: thread_id, includeTurns: true });
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

    store.upsertThreadMeta({ thread_id, last_seen_at: new Date().toISOString() });

    const thread = result?.thread ?? result?.data?.thread ?? (result?.threadId ? result : result?.data ?? result);
    const threadUpdated = thread && typeof thread === "object"
      ? normalizeTimestamp((thread as any).updatedAt ?? (thread as any).updated_at ?? (thread as any).updated)
      : null;
    const threadPayload = thread && typeof thread === "object"
      ? { ...(thread as Record<string, unknown>), updated_at: threadUpdated ?? (thread as any).updated_at ?? null }
      : thread;

    const attachments = buildAttachmentMap(store.listWorkspaceThreads()).get(thread_id) ?? [];
    const meta = store.getThreadMeta(thread_id);

    return {
      thread: threadPayload,
      items: result?.items ?? result?.data?.items,
      turns: result?.turns ?? result?.data?.turns,
      has_more: result?.has_more ?? result?.data?.has_more,
      meta,
      attached_workspace_ids: attachments
    };
  });

  app.post("/threads/:thread_id/message", async (req, reply) => {
    if (!appServer.isReady()) {
      return build503(reply, appServer);
    }

    const { thread_id } = req.params as { thread_id: string };
    const body = req.body as { text?: string; workspace_id?: string | null };

    if (!body?.text || !body.text.trim()) {
      return reply.code(400).send({ ok: false, error: "text required" });
    }

    const workspaceId = body.workspace_id ?? null;
    if (workspaceId) {
      const workspace = store.getWorkspace(workspaceId);
      if (!workspace) {
        return reply.code(400).send({ ok: false, error: "workspace_id not found" });
      }
    }

    const run_id = runManager.startExternalRun({
      type: "codex_thread",
      workspace_id: workspaceId,
      command: "codex app-server",
      cwd: process.cwd()
    });

    store.upsertThreadMeta({
      thread_id,
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
