import { FastifyInstance } from "fastify";
import { spawn } from "node:child_process";
import { CodexAppServerManager, buildCodexCommandSpec } from "../codex_app_server_manager.js";

const truncate = (value: string, max = 2000) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

const runCommand = (command: string, args: string[], options?: { shell?: boolean; cwd?: string }) =>
  new Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string; error?: string }>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    try {
      const child = spawn(command, args, {
        shell: options?.shell ?? false,
        cwd: options?.cwd,
        windowsHide: process.platform === "win32"
      });
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, code: null, stdout, stderr, error: err?.message ?? "spawn error" });
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        resolve({ ok: code === 0, code: code ?? null, stdout, stderr });
      });
    } catch (err: any) {
      resolve({ ok: false, code: null, stdout, stderr, error: err?.message ?? "spawn error" });
    }
  });

export const registerDiagRoutes = (app: FastifyInstance, appServer: CodexAppServerManager) => {
  app.get("/diag/codex", async (_req, reply) => {
    const spec = buildCodexCommandSpec(appServer.getCwd(), ["--version"]);
    const pathValue = truncate(process.env.PATH ?? "", 2000);

    const whereResult = process.platform === "win32"
      ? await runCommand("where.exe", ["codex"], { shell: false })
      : await runCommand("which", ["codex"], { shell: false });

    const versionResult = await runCommand(spec.command, spec.args, {
      shell: spec.options.shell,
      cwd: spec.options.cwd
    });

    const status = appServer.getStatus();

    return reply.send({
      ok: true,
      platform: process.platform,
      cwd: appServer.getCwd(),
      spawn: {
        command: spec.command,
        args: spec.args,
        shell: spec.options.shell
      },
      env: {
        PATH: pathValue
      },
      where: whereResult,
      codex_version: versionResult,
      app_server: status
    });
  });
};
