import { FastifyInstance } from "fastify";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { RunManager } from "../run_manager.js";
import { Store } from "../store.js";

const normalizeRepoPath = (input: string): string => {
  return resolve(input.trim());
};

const ensureDirectory = (path: string): boolean => {
  if (!existsSync(path)) return false;
  const stats = statSync(path);
  return stats.isDirectory();
};

const buildCodexArgs = (prompt: string): { command: string; args: string[] } => {
  const fullAccess = process.env.CODEX_FULL_ACCESS === "1" || process.env.CODEX_FULL_ACCESS === "true";
  if (fullAccess) {
    return { command: "codex", args: ["--dangerously-bypass-approvals-and-sandbox", "exec", prompt] };
  }
  return { command: "codex", args: ["-a", "never", "-s", "workspace-write", "exec", prompt] };
};

const parseTestCommand = (command?: string): { command: string; args: string[] } | null => {
  if (command) {
    const trimmed = command.trim();
    if (trimmed === "pnpm test") return { command: "pnpm", args: ["test"] };
    if (trimmed === "npm test") return { command: "npm", args: ["test"] };
    if (trimmed === "pytest") return { command: "pytest", args: [] };
    if (trimmed === "python -m pytest") return { command: "python", args: ["-m", "pytest"] };
    return null;
  }
  return null;
};

const autoDetectTestCommand = (repoPath: string): { command: string; args: string[] } | null => {
  if (existsSync(resolve(repoPath, "pnpm-lock.yaml")) || existsSync(resolve(repoPath, "package.json"))) {
    if (existsSync(resolve(repoPath, "pnpm-lock.yaml"))) {
      return { command: "pnpm", args: ["test"] };
    }
    return { command: "npm", args: ["test"] };
  }
  if (existsSync(resolve(repoPath, "pyproject.toml"))) {
    return { command: "python", args: ["-m", "pytest"] };
  }
  return null;
};

export const registerSessionRoutes = (app: FastifyInstance, store: Store, runManager: RunManager) => {
  app.get("/sessions", async () => {
    return { ok: true, sessions: store.listSessions() };
  });

  app.post("/sessions", async (req, reply) => {
    const body = req.body as { repo_path?: string; title?: string };
    if (!body?.repo_path || !body.repo_path.trim()) {
      return reply.code(400).send({ ok: false, error: "repo_path required" });
    }
    const repoPath = normalizeRepoPath(body.repo_path);
    if (!ensureDirectory(repoPath)) {
      return reply.code(400).send({ ok: false, error: "repo_path must be an existing directory" });
    }
    const title = body.title?.trim() || repoPath;
    const session = store.createSession({ title, repo_path: repoPath });
    return { ok: true, session };
  });

  app.get("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }
    const runs = store.listRunsBySession(id);
    return { ok: true, session, runs };
  });

  app.post("/sessions/:id/runs/clear", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }
    const cleared = store.clearRunsForSession(id);
    return { ok: true, cleared };
  });

  app.post("/sessions/:id/message", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string; mode?: string };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }
    if (!body?.text || !body.text.trim()) {
      return reply.code(400).send({ ok: false, error: "text required" });
    }
    const { command, args } = buildCodexArgs(body.text.trim());
    const run_id = await runManager.startRun({
      type: "message",
      session_id: id,
      command,
      args,
      cwd: session.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/sessions/:id/git/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }
    const run_id = await runManager.startRun({
      type: "git_status",
      session_id: id,
      command: "git",
      args: ["status"],
      cwd: session.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/sessions/:id/git/diff", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { staged?: boolean };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }
    const args = body?.staged ? ["diff", "--staged"] : ["diff"];
    const run_id = await runManager.startRun({
      type: "git_diff",
      session_id: id,
      command: "git",
      args,
      cwd: session.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/sessions/:id/test", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { command?: string };
    const session = store.getSession(id);
    if (!session) {
      return reply.code(404).send({ ok: false, error: "session not found" });
    }

    let testCommand = parseTestCommand(body?.command);
    if (!testCommand) {
      testCommand = autoDetectTestCommand(session.repo_path);
    }
    if (!testCommand) {
      return reply.code(400).send({ ok: false, error: "no supported test command detected" });
    }

    const run_id = await runManager.startRun({
      type: "test",
      session_id: id,
      command: testCommand.command,
      args: testCommand.args,
      cwd: session.repo_path
    });

    return { ok: true, run_id };
  });
};
