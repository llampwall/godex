import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { authGuard } from "../src/auth";
import { createStore } from "../src/store";
import { RunManager } from "../src/run_manager";
import { registerWorkspaceRoutes } from "../src/routes/workspaces";
import { resolveTemplateWithCodex } from "../src/bootstrap";

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    ...actual,
    spawn: vi.fn()
  };
});

vi.mock("../src/bootstrap", async () => {
  const actual = await vi.importActual<typeof import("../src/bootstrap")>("../src/bootstrap");
  return {
    ...actual,
    resolveTemplateWithCodex: vi.fn()
  };
});

const makeTempDir = () => mkdtempSync(join(tmpdir(), "godex-bootstrap-route-"));

const waitForRun = async (store: ReturnType<typeof createStore>["store"], manager: RunManager, runId: string) => {
  const existing = store.getRun(runId);
  if (existing?.status === "done") return;
  await new Promise<void>((resolve) => {
    const unsubscribe = manager.subscribe(runId, (event) => {
      if (event.type === "final") {
        unsubscribe();
        resolve();
      }
    });
  });
};

describe("workspaces bootstrap route", () => {
  let dataDir: string;
  let rootDir: string;
  const token = "bootstrap-token";

  beforeEach(() => {
    dataDir = makeTempDir();
    rootDir = makeTempDir();
    process.env.GODEX_DATA_DIR = dataDir;
    process.env.CODEX_RELAY_TOKEN = token;
    process.env.NTFY_URL = "https://ntfy.sh";
    process.env.NTFY_TOPIC = "godex-test";
    process.env.STRAP_BIN = "C:\\strap\\strap.cmd";

    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });

    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as any;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      process.nextTick(() => {
        const nameArg = String(args?.[0] ?? "");
        const rootIndex = args?.indexOf("-p") ?? -1;
        const rootArg = rootIndex >= 0 ? String(args[rootIndex + 1] ?? "") : "";
        if (nameArg && rootArg) {
          try {
            mkdirSync(resolve(rootArg, nameArg), { recursive: true });
          } catch {
            // ignore in test
          }
        }
        child.stdout.emit("data", Buffer.from("strap ok\n"));
        child.emit("close", 0);
      });
      return child;
    });
  });

  afterEach(() => {
    delete process.env.GODEX_DATA_DIR;
    delete process.env.CODEX_RELAY_TOKEN;
    delete process.env.NTFY_URL;
    delete process.env.NTFY_TOPIC;
    delete process.env.STRAP_BIN;
    vi.restoreAllMocks();
    try {
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(rootDir, { recursive: true, force: true });
    } catch {
      // sqlite keeps handles open on windows; ignore cleanup failures
    }
  });

  it("kicks off codex template selection, runs strap, and notifies", async () => {
    const { store } = createStore();
    const runManager = new RunManager(store);
    const appServer = {
      isReady: () => true,
      request: async (method: string) => {
        if (method.startsWith("thread/")) {
          return { thread_id: "t-boot" };
        }
        return { ok: true };
      }
    };

    const templateMock = resolveTemplateWithCodex as unknown as ReturnType<typeof vi.fn>;
    templateMock.mockResolvedValue({
      template_used: "web",
      confidence: "high"
    });

    const app = Fastify({ logger: false });
    app.addHook("onRequest", authGuard);
    registerWorkspaceRoutes(app, store, runManager, appServer as any);

    const response = await app.inject({
      method: "POST",
      url: "/workspaces/bootstrap",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "demo-web",
        path: rootDir,
        template: "auto",
        description: "a small marketing page for a new product"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { run_id: string; template_used: string; repo_path: string };
    expect(body.template_used).toBe("web");
    expect(body.repo_path).toContain("demo-web");

    await waitForRun(store, runManager, body.run_id);

    expect(templateMock).toHaveBeenCalledTimes(1);
    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    expect(spawnMock).toHaveBeenCalled();
    expect(spawnMock.mock.calls[0][0]).toBe("C:\\strap\\strap.cmd");

    await new Promise((resolve) => setImmediate(resolve));
    const fetchMock = (globalThis as any).fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
