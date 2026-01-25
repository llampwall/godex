import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { authGuard } from "./auth.js";
import { createStore } from "./store.js";
import { RunManager } from "./run_manager.js";
import { CodexAppServerManager } from "./codex_app_server_manager.js";
import { registerRunRoutes } from "./routes/runs.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";
import { resolveDefaultRepoRoot } from "./bootstrap.js";
import { registerThreadRoutes } from "./routes/threads.js";
import { registerDiagRoutes } from "./routes/diag.js";

dotenv.config({ path: resolve(process.cwd(), "..", "..", ".env") });

export const buildServer = () => {
  const app = Fastify({ logger: true });

  const { store, backend } = createStore();
  const runManager = new RunManager(store, app.log);
  const appServer = new CodexAppServerManager(app.log);
  appServer.start();

  const staleCount = store.markStaleRuns();
  if (staleCount > 0) {
    app.log.info({ staleCount }, "marked stale runs as done");
  }

  const uiHost = process.env.UI_HOST && process.env.UI_HOST.trim() ? process.env.UI_HOST : "0.0.0.0";
  const uiPort = Number(process.env.UI_PORT ?? 7777);

  app.register(cors, {
    origin: [
      `http://central-command:${uiPort}`,
      `http://localhost:${uiPort}`,
      `http://127.0.0.1:${uiPort}`,
      `http://${uiHost}:${uiPort}`
    ],
    credentials: true
  });

  app.addHook("onRequest", authGuard);

  app.get("/health", async () => ({
    ok: true,
    ts: new Date().toISOString(),
    backend,
    pid: process.pid,
    uptime: process.uptime(),
    active_runs: runManager.getActiveRunsCount(),
    workspace_count: store.countWorkspaces(),
    linked_threads_count: store.countWorkspaceThreads(),
    app_server_state: appServer.getStatus(),
    default_repo_root: resolveDefaultRepoRoot()
  }));

  registerWorkspaceRoutes(app, store, runManager, appServer);
  registerRunRoutes(app, store, runManager);
  registerThreadRoutes(app, store, runManager, appServer);
  registerDiagRoutes(app, appServer);

  const uiDist = resolve(process.cwd(), "..", "ui", "dist");
  const uiIndexPath = resolve(uiDist, "index.html");
  const uiLogoPath = resolve(uiDist, "godex.png");
  let uiIndexHtml: string | null = null;
  let uiLogo: Buffer | null = null;
  const uiRootFiles = new Map<string, string>();

  if (existsSync(uiIndexPath)) {
    uiIndexHtml = readFileSync(uiIndexPath, "utf8");
  }
  if (existsSync(uiLogoPath)) {
    uiLogo = readFileSync(uiLogoPath);
  }

  if (existsSync(uiDist)) {
    const rootFiles = [
      ["manifest.webmanifest", "application/manifest+json"],
      ["pwa-192.png", "image/png"],
      ["pwa-512.png", "image/png"],
      ["sw.js", "application/javascript"]
    ];
    for (const [name, type] of rootFiles) {
      const filePath = resolve(uiDist, name);
      if (existsSync(filePath)) {
        uiRootFiles.set(name, type);
      }
    }
    const workbox = readdirSync(uiDist).find((entry) => entry.startsWith("workbox-") && entry.endsWith(".js"));
    if (workbox) {
      uiRootFiles.set(workbox, "application/javascript");
    }
  }

  if (existsSync(resolve(uiDist, "assets"))) {
    app.register(fastifyStatic, {
      root: resolve(uiDist, "assets"),
      prefix: "/ui/assets/"
    });
  }

  app.get("/ui/godex.png", async (_req, reply) => {
    if (!uiLogo) {
      return reply.code(404).send({ ok: false, error: "logo not found" });
    }
    reply.type("image/png").send(uiLogo);
  });

  for (const [fileName, contentType] of uiRootFiles.entries()) {
    app.get(`/ui/${fileName}`, async (_req, reply) => {
      const filePath = resolve(uiDist, fileName);
      if (!existsSync(filePath)) {
        return reply.code(404).send({ ok: false, error: "file not found" });
      }
      const buffer = readFileSync(filePath);
      reply.type(contentType).send(buffer);
    });
  }

  const serveUi = async (_req: unknown, reply: any) => {
    if (!uiIndexHtml) {
      return reply.code(503).send({ ok: false, error: "ui not built" });
    }
    reply.header("Cache-Control", "no-store");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    reply.type("text/html").send(uiIndexHtml);
  };

  app.get("/ui", serveUi);
  app.get("/ui/*", serveUi);

  return app;
};
