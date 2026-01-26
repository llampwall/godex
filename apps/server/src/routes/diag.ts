import { FastifyInstance } from "fastify";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
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


  app.post("/diag/restart", async (_req, reply) => {
    if (process.platform !== "win32") {
      return reply.code(400).send({ ok: false, error: "restart is only supported on Windows" });
    }
    const repoRoot = resolve(process.cwd(), "..", "..");
    const logDir = resolve(repoRoot, ".godex");
    mkdirSync(logDir, { recursive: true });
    const logPath = resolve(logDir, "restart.log");
    appendFileSync(logPath, `[${new Date().toISOString()}] restart requested\n`);
    const wherePnpm = await runCommand("where.exe", ["pnpm.cmd"], { shell: false });
    const wherePm2 = await runCommand("where.exe", ["pm2.cmd"], { shell: false });
    const pickFirstPath = (value: string) =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => Boolean(line));
    const pnpmPath = pickFirstPath(wherePnpm.stdout);
    const pm2Path = pickFirstPath(wherePm2.stdout);
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] pnpm where ok=${wherePnpm.ok} code=${wherePnpm.code ?? "null"} stdout=${truncate(wherePnpm.stdout.trim())} stderr=${truncate(wherePnpm.stderr.trim())}\n`
    );
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] pm2 where ok=${wherePm2.ok} code=${wherePm2.code ?? "null"} stdout=${truncate(wherePm2.stdout.trim())} stderr=${truncate(wherePm2.stderr.trim())}\n`
    );
    if (!pnpmPath || !pm2Path) {
      return reply.code(500).send({
        ok: false,
        error: "pnpm.cmd or pm2.cmd not found on PATH; check restart.log for details"
      });
    }
    appendFileSync(logPath, `[${new Date().toISOString()}] pnpm build starting (shell)\n`);
    const buildResult = await runCommand(pnpmPath, ["build"], { cwd: repoRoot, shell: true });
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] pnpm build ok=${buildResult.ok} code=${buildResult.code ?? "null"}\n` +
        `stdout:\n${truncate(buildResult.stdout, 20000)}\n` +
        `stderr:\n${truncate(buildResult.stderr, 20000)}\n`
    );
    if (!buildResult.ok) {
      return reply.code(500).send({ ok: false, error: "pnpm build failed; see restart.log" });
    }

    appendFileSync(logPath, `[${new Date().toISOString()}] pm2 restart starting (shell)\n`);
    const restartResult = await runCommand(pm2Path, ["restart", "godex-ui-rewrite"], { cwd: repoRoot, shell: true });
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] pm2 restart ok=${restartResult.ok} code=${restartResult.code ?? "null"}\n` +
        `stdout:\n${truncate(restartResult.stdout, 20000)}\n` +
        `stderr:\n${truncate(restartResult.stderr, 20000)}\n`
    );
    if (!restartResult.ok) {
      return reply.code(500).send({ ok: false, error: "pm2 restart failed; see restart.log" });
    }

    reply.send({ ok: true, log: "restart.log" });
  });
};
