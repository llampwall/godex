import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createStore } from "../src/store";
import {
  buildStrapArgs,
  checkRepoAvailability,
  finalizeBootstrapSuccess,
  parseTemplateDecision,
  validateRepoName
} from "../src/bootstrap";

const makeTempDir = () => {
  const base = mkdtempSync(join(tmpdir(), "godex-bootstrap-test-"));
  mkdirSync(base, { recursive: true });
  return base;
};

describe("bootstrap helpers", () => {
  it("validates repo names", () => {
    expect(validateRepoName("ok-name").ok).toBe(true);
    expect(validateRepoName("bad:name").ok).toBe(false);
    expect(validateRepoName(" ").ok).toBe(false);
  });

  it("parses template decisions", () => {
    const payload = '{"template_used":"python","confidence":"high","alternatives":["service"],"reasoning":"scraping"}';
    const decision = parseTemplateDecision(payload);
    expect(decision?.template_used).toBe("python");
    expect(decision?.confidence).toBe("high");
  });


  it("parses blank template decisions", () => {
    const payload = '{"template_used":"blank","confidence":"low","alternatives":["mono"],"reasoning":"no match"}';
    const decision = parseTemplateDecision(payload);
    expect(decision?.template_used).toBe("blank");
  });
  it("builds strap args", () => {
    const args = buildStrapArgs("demo", "web", "C:\\Code", true);
    expect(args).toEqual(["demo", "-t", "web", "-p", "C:\\Code", "--start"]);
  });

  it("detects existing repo path", () => {
    const root = makeTempDir();
    const repoPath = resolve(root, "exists");
    mkdirSync(repoPath, { recursive: true });
    const result = checkRepoAvailability(root, "exists");
    expect(result.ok).toBe(false);
  });
});

describe("bootstrap success", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDir();
    process.env.GODEX_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.GODEX_DATA_DIR;
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("creates workspace and attaches thread", async () => {
    const { store } = createStore();
    const appServer = {
      isReady: () => true,
      request: async (method: string, _params: Record<string, unknown>) => {
        if (method.startsWith("thread/")) {
          return { thread_id: "t-boot" };
        }
        return { ok: true };
      }
    };

    const result = await finalizeBootstrapSuccess(store, appServer, {
      name: "demo",
      repo_path: "C:\\Code\\demo",
      template_used: "mono",
      set_default_thread: true
    });

    const workspace = store.getWorkspace(result.workspace_id);
    expect(workspace?.default_thread_id).toBe(result.thread_id);
    const links = store.listWorkspaceThreads();
    expect(links.some((link) => link.thread_id === result.thread_id)).toBe(true);
    expect(store.getThreadMeta(result.thread_id)).toBeTruthy();
  });
});
