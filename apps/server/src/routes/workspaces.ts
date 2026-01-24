import { FastifyInstance } from "fastify";
import { existsSync, statSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { RunManager } from "../run_manager.js";
import { CodexAppServerManager } from "../codex_app_server_manager.js";
import { NotifyPolicy, Store } from "../store.js";
import {
  BootstrapTemplate,
  TemplateUsed,
  buildStrapArgs,
  checkRepoAvailability,
  finalizeBootstrapSuccess,
  resolveRepoRoot,
  resolveTemplateWithCodex,
  validateRepoName
} from "../bootstrap.js";

const filePilotPath = "C:\\Users\\Jordan\\AppData\\Local\\Voidstar\\FilePilot\\FPilot.exe";

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

const isNotifyPolicy = (value: unknown): value is NotifyPolicy => {
  return value === "off" || value === "needs_input+failed" || value === "all";
};

const ensureBlankSuggestion = (items: string[] | undefined) => {
  const base = Array.isArray(items) ? items : [];
  return base.includes("blank") ? base : [...base, "blank"];
};

const sendBootstrapNotify = async (input: {
  name: string;
  status: "success" | "failed";
  message?: string;
  workspace_id?: string | null;
  repo_path?: string;
  template_used?: string;
}) => {
  const url = process.env.NTFY_URL;
  const topic = process.env.NTFY_TOPIC;
  if (!url || !topic) return;
  const base = url.replace(/\/$/, "");
  const link = input.workspace_id ? `${base}/ui/w/${input.workspace_id}` : null;
  const title = `Bootstrap ${input.name} · ${input.status}`;
  const lines = [
    `name: ${input.name}`,
    `status: ${input.status}`,
    input.repo_path ? `path: ${input.repo_path}` : null,
    input.template_used ? `template: ${input.template_used}` : null,
    input.message ? `message: ${input.message}` : null,
    link ? link : null
  ].filter(Boolean);

  try {
    await fetch(`${base}/${topic}`, {
      method: "POST",
      headers: {
        Title: title,
        "Content-Type": "text/plain"
      },
      body: lines.join("\n")
    });
  } catch {
    // ignore notification errors
  }
};


const hasCodeCli = (): boolean => {
  if (process.platform !== "win32") return true;
  try {
    const result = spawnSync("where.exe", ["code"], { windowsHide: true });
    return result.status === 0;
  } catch {
    return false;
  }
};

const launchDetached = (command: string, args: string[], cwd?: string) => {
  const child = spawn(command, args, { cwd, detached: true, stdio: "ignore" });
  child.unref();
};

export const registerWorkspaceRoutes = (
  app: FastifyInstance,
  store: Store,
  runManager: RunManager,
  appServer: CodexAppServerManager
) => {
  app.get("/workspaces", async () => {
    const workspaces = store.listWorkspaces();
    const workspacesWithActivity = workspaces.map((workspace) => {
      const runs = store.listRunsByWorkspace(workspace.id, 1);
      const lastRun = runs[0];
      return {
        ...workspace,
        last_activity_at: lastRun?.updated_at ?? lastRun?.created_at ?? null
      };
    });
    return { ok: true, workspaces: workspacesWithActivity };
  });

  app.post("/workspaces", async (req, reply) => {
    const body = req.body as { repo_path?: string; title?: string };
    if (!body?.repo_path || !body.repo_path.trim()) {
      return reply.code(400).send({ ok: false, error: "repo_path required" });
    }
    const repoPath = normalizeRepoPath(body.repo_path);
    if (!ensureDirectory(repoPath)) {
      return reply.code(400).send({ ok: false, error: "repo_path must be an existing directory" });
    }
    const title = body.title?.trim() || repoPath;
    const workspace = store.createWorkspace({ title, repo_path: repoPath });
    return { ok: true, workspace };
  });

  app.post("/workspaces/bootstrap", async (req, reply) => {
    const body = req.body as {
      name?: string;
      path?: string;
      template?: BootstrapTemplate;
      description?: string;
      start?: boolean;
    };

    const name = body?.name?.trim() ?? "";
    const nameCheck = validateRepoName(name);
    if (!nameCheck.ok) {
      return reply.code(400).send({ ok: false, error: nameCheck.error ?? "invalid name" });
    }

    const root = resolveRepoRoot(body?.path ?? null);
    if (!root) {
      return reply.code(400).send({ ok: false, error: "repo root not found" });
    }

    let templateUsed: TemplateUsed;
    const template = body?.template ?? "auto";

    if (template === "auto") {
      if (!body?.description || !body.description.trim()) {
        return reply.code(400).send({ ok: false, error: "description required for auto" });
      }
      let decision: Awaited<ReturnType<typeof resolveTemplateWithCodex>>;
      try {
        decision = await resolveTemplateWithCodex(name, body.description.trim());
      } catch (err: any) {
        return reply.code(409).send({
          ok: false,
          error: "ambiguous_template",
          suggestions: ensureBlankSuggestion(["mono", "service", "web", "python"]),
          message: err?.message ?? "Template selection failed"
        });
      }
      if (decision.confidence === "high") {
        templateUsed = decision.template_used;
      } else if (decision.confidence === "medium") {
        return reply.code(409).send({
          ok: false,
          error: "template_suggestion",
          suggested: decision.template_used,
          suggestions: ensureBlankSuggestion(decision.alternatives ?? []),
          reasoning: decision.reasoning ?? "Suggested template based on description."
        });
      } else {
        return reply.code(409).send({
          ok: false,
          error: "ambiguous_template",
          suggestions: ensureBlankSuggestion(decision.alternatives ?? ["mono", "service", "web", "python"]),
          message: decision.reasoning ?? "No matching template found. Please pick one of the suggestions."
        });
      }
    } else if (template === "mono" || template === "service" || template === "web" || template === "python" || template === "blank") {
      templateUsed = template;
    } else {
      return reply.code(400).send({ ok: false, error: "invalid template" });
    }

    const availability = checkRepoAvailability(root, name);
    if (!availability.ok) {
      return reply.code(409).send({ ok: false, error: "repo_exists", repo_path: availability.repo_path });
    }
    const repoPath = availability.repo_path;

    if (templateUsed === "blank") {
      const run_id = runManager.startExternalRun({
        type: "bootstrap",
        workspace_id: null,
        command: "blank repo init",
        cwd: root
      });

      const finalizeFailure = (message: string, code = 1) => {
        store.updateRun(run_id, { meta: { repo_path: repoPath, template_used: templateUsed } });
        runManager.finalizeExternalRun(run_id, code, message);

        void sendBootstrapNotify({ name, status: "failed", message, repo_path: repoPath, template_used: templateUsed });
      };

      try {
        mkdirSync(repoPath, { recursive: false });
        runManager.appendExternalEvent(run_id, "stdout", `created folder: ${repoPath}\n`);
      } catch (err: any) {
        finalizeFailure(`failed to create folder: ${err?.message ?? "unknown error"}`);
        return {
          ok: true,
          run_id,
          workspace_id: null,
          thread_id: null,
          repo_path: repoPath,
          template_used: templateUsed
        };
      }

      const child = spawn("git", ["init"], { cwd: repoPath, windowsHide: true });

      child.stdout?.on("data", (chunk: Buffer) => {
        runManager.appendExternalEvent(run_id, "stdout", chunk.toString());
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        runManager.appendExternalEvent(run_id, "stderr", chunk.toString());
      });

      child.on("error", (err: any) => {
        finalizeFailure(`git init failed to start: ${err?.message ?? "unknown error"}`);
      });

      child.on("close", async (code) => {
        const exitCode = typeof code === "number" ? code : 1;
        if (exitCode !== 0) {
          finalizeFailure(`git init exited with code ${exitCode}`, exitCode);
          return;
        }

        try {
          if (!appServer.isReady()) {
            finalizeFailure("codex app-server unavailable", 1);
            return;
          }
          const result = await finalizeBootstrapSuccess(store, appServer, {
            name,
            repo_path: repoPath,
            template_used: templateUsed,
            set_default_thread: true
          });
          store.updateRun(run_id, {
            meta: {
              workspace_id: result.workspace_id,
              thread_id: result.thread_id,
              repo_path: repoPath,
              template_used: templateUsed
            }
          });
          void sendBootstrapNotify({ name, status: "success", workspace_id: result.workspace_id, repo_path: repoPath, template_used: templateUsed });
          runManager.finalizeExternalRun(run_id, 0);
        } catch (err: any) {
          finalizeFailure(`bootstrap finalize failed: ${err?.message ?? "unknown error"}`, 1);
        }
      });

      return {
        ok: true,
        run_id,
        workspace_id: null,
        thread_id: null,
        repo_path: repoPath,
        template_used: templateUsed
      };
    }

    const args = buildStrapArgs(name, templateUsed, root, body?.start);
    const commandLabel = `strap ${args.join(" ")}`;

    const run_id = runManager.startExternalRun({
      type: "bootstrap",
      workspace_id: null,
      command: commandLabel,
      cwd: root
    });

    const child = spawn("strap", args, { cwd: root, windowsHide: true });

    child.stdout?.on("data", (chunk: Buffer) => {
      runManager.appendExternalEvent(run_id, "stdout", chunk.toString());
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      runManager.appendExternalEvent(run_id, "stderr", chunk.toString());
    });

    const finalizeFailure = (message: string, code = 1) => {
      store.updateRun(run_id, { meta: { repo_path: repoPath, template_used: templateUsed } });
      runManager.finalizeExternalRun(run_id, code, message);
    
      void sendBootstrapNotify({ name, status: "failed", message, repo_path: repoPath, template_used: templateUsed });
    };

    child.on("error", (err: any) => {
      finalizeFailure(`strap failed to start: ${err?.message ?? "unknown error"}`);
    });

    child.on("close", async (code) => {
      const exitCode = typeof code === "number" ? code : 1;
      if (exitCode !== 0) {
        finalizeFailure(`strap exited with code ${exitCode}`, exitCode);
        return;
      }

      try {
        if (!appServer.isReady()) {
          finalizeFailure("codex app-server unavailable", 1);
          return;
        }
        const result = await finalizeBootstrapSuccess(store, appServer, {
          name,
          repo_path: repoPath,
          template_used: templateUsed,
          set_default_thread: true
        });
        store.updateRun(run_id, {
          meta: {
            workspace_id: result.workspace_id,
            thread_id: result.thread_id,
            repo_path: repoPath,
            template_used: templateUsed
          }
        });
        void sendBootstrapNotify({ name, status: "success", workspace_id: result.workspace_id, repo_path: repoPath, template_used: templateUsed });
        runManager.finalizeExternalRun(run_id, 0);
      } catch (err: any) {
        finalizeFailure(`bootstrap finalize failed: ${err?.message ?? "unknown error"}`, 1);
      }
    });

    return {
      ok: true,
      run_id,
      workspace_id: null,
      thread_id: null,
      repo_path: repoPath,
      template_used: templateUsed
    };
  });

  app.get("/workspaces/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    const runs = store.listRunsByWorkspace(id);
    const links = store.listWorkspaceThreads().filter((entry) => entry.workspace_id === id);
    return { ok: true, workspace, runs, linked_thread_ids: links.map((entry) => entry.thread_id) };
  });

  app.patch("/workspaces/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      title?: string;
      notify_policy?: string;
      default_thread_id?: string | null;
      test_command_override?: string | null;
    };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }

    const patch: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const trimmed = body.title.trim();
      if (trimmed) patch.title = trimmed;
    }

    if (body.notify_policy !== undefined) {
      if (!isNotifyPolicy(body.notify_policy)) {
        return reply.code(400).send({ ok: false, error: "invalid notify_policy" });
      }
      patch.notify_policy = body.notify_policy;
    }

    if (body.default_thread_id !== undefined) {
      const value = typeof body.default_thread_id === "string" && body.default_thread_id.trim()
        ? body.default_thread_id.trim()
        : null;
      patch.default_thread_id = value;
    }

    if (body.test_command_override !== undefined) {
      const value = typeof body.test_command_override === "string" && body.test_command_override.trim()
        ? body.test_command_override.trim()
        : null;
      patch.test_command_override = value;
    }

    const updated = store.updateWorkspace(id, patch);
    return { ok: true, workspace: updated };
  });

  app.delete("/workspaces/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = store.deleteWorkspace(id);
    if (!deleted) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    return { ok: true, deleted: true };
  });

  app.post("/workspaces/:id/runs/clear", async (req, reply) => {
    const { id } = req.params as { id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    const cleared = store.clearRunsForWorkspace(id);
    return { ok: true, cleared };
  });

  app.post("/workspaces/:id/message", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    if (!body?.text || !body.text.trim()) {
      return reply.code(400).send({ ok: false, error: "text required" });
    }
    const { command, args } = buildCodexArgs(body.text.trim());
    const run_id = await runManager.startRun({
      type: "message",
      workspace_id: id,
      command,
      args,
      cwd: workspace.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/workspaces/:id/git/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    const run_id = await runManager.startRun({
      type: "git_status",
      workspace_id: id,
      command: "git",
      args: ["status"],
      cwd: workspace.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/workspaces/:id/git/diff", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { staged?: boolean };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    const args = body?.staged ? ["diff", "--staged"] : ["diff"];
    const run_id = await runManager.startRun({
      type: "git_diff",
      workspace_id: id,
      command: "git",
      args,
      cwd: workspace.repo_path
    });
    return { ok: true, run_id };
  });

  app.post("/workspaces/:id/test", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { command?: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }

    let testCommand = parseTestCommand(body?.command);
    if (!testCommand) {
      testCommand = parseTestCommand(workspace.test_command_override ?? undefined) ?? autoDetectTestCommand(workspace.repo_path);
    }
    if (!testCommand) {
      return reply.code(400).send({ ok: false, error: "no supported test command detected" });
    }

    const run_id = await runManager.startRun({
      type: "test",
      workspace_id: id,
      command: testCommand.command,
      args: testCommand.args,
      cwd: workspace.repo_path
    });

    return { ok: true, run_id };
  });

  app.post("/workspaces/:id/threads", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { thread_id?: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    if (!body?.thread_id || !body.thread_id.trim()) {
      return reply.code(400).send({ ok: false, error: "thread_id required" });
    }
    const link = store.attachThreadToWorkspace(id, body.thread_id.trim());
    return { ok: true, link };
  });

  app.delete("/workspaces/:id/threads/:thread_id", async (req, reply) => {
    const { id, thread_id } = req.params as { id: string; thread_id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    const removed = store.detachThreadFromWorkspace(id, thread_id);
    if (workspace.default_thread_id === thread_id) {
      store.updateWorkspace(id, { default_thread_id: null });
    }
    return { ok: true, removed };
  });

  app.post("/workspaces/:id/open-folder", async (req, reply) => {
    const { id } = req.params as { id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    if (!existsSync(filePilotPath)) {
      return reply.code(400).send({ ok: false, error: "FilePilot not found" });
    }
    try {
      launchDetached(filePilotPath, [workspace.repo_path]);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err?.message ?? "failed to open folder" });
    }
  });

  app.post("/workspaces/:id/open-code", async (req, reply) => {
    const { id } = req.params as { id: string };
    const workspace = store.getWorkspace(id);
    if (!workspace) {
      return reply.code(404).send({ ok: false, error: "workspace not found" });
    }
    if (!hasCodeCli()) {
      return reply.code(400).send({ ok: false, error: "VS Code CLI not found (install code on PATH)" });
    }
    try {
      launchDetached("code", ["."], workspace.repo_path);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err?.message ?? "failed to open VS Code" });
    }
  });
};
