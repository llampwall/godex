import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Store } from "./store.js";

export type BootstrapTemplate = "mono" | "service" | "web" | "python" | "blank" | "auto";
export type TemplateUsed = Exclude<BootstrapTemplate, "auto">;

export type TemplateConfidence = "high" | "medium" | "low";
export type TemplateDecision = {
  template_used: TemplateUsed;
  confidence: TemplateConfidence;
  alternatives?: TemplateUsed[];
  reasoning?: string;
};

const templateChoices: TemplateUsed[] = ["mono", "service", "web", "python", "blank"];

const buildTemplatePrompt = (name: string, description: string) => {
  return `Pick the template stack that best suits the application.
Return JSON only. No extra text.

Project name: ${name}
Description: ${description}

Rubric:
- mono: UI + backend, web app, dashboard, admin, PWA, "an app"
- service: backend-only API/service/worker/cron/queue/SSE/CLI
- web: frontend-only landing/marketing/static/portfolio
- python: python tool/script/automation/scrape/ETL/notebook
- blank: no template fits

Choose the best template from: mono, service, web, python, blank.
Return JSON only with keys: template_used, confidence (high|medium|low), alternatives (array), reasoning.
If uncertain or no template fits, choose blank or set confidence to medium/low and provide alternatives.`;
};

export const parseTemplateDecision = (text: string): TemplateDecision | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== "object") return null;
    const template = parsed.template_used as TemplateUsed | undefined;
    const confidence = parsed.confidence as TemplateConfidence | undefined;
    if (!template || !templateChoices.includes(template)) return null;
    if (!confidence || !["high", "medium", "low"].includes(confidence)) return null;
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives.filter((item: any) => templateChoices.includes(item))
      : undefined;
    return {
      template_used: template,
      confidence,
      alternatives,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined
    };
  } catch {
    return null;
  }
};

const buildCodexExecArgs = (prompt: string) => {
  const schemaPath = resolve(process.cwd(), "bootstrap_template.schema.json");
  const fullAccess = process.env.CODEX_FULL_ACCESS === "1" || process.env.CODEX_FULL_ACCESS === "true";
  if (fullAccess) {
    return {
      command: "codex",
      args: ["--dangerously-bypass-approvals-and-sandbox", "exec", "--output-schema", schemaPath, "-"],
      useStdin: true
    };
  }
  return {
    command: "codex",
    args: ["-a", "never", "-s", "workspace-write", "exec", "--output-schema", schemaPath, "-"],
    useStdin: true
  };
};

const dynamicImport = (specifier: string) => {
  if (process.env.VITEST) {
    return import(specifier);
  }
  const importer = new Function("specifier", "return import(specifier)");
  return importer(specifier) as Promise<any>;
};

const loadExeca = async () => {
  const mod = (await dynamicImport("execa")) as { execa: typeof import("execa").execa };
  return mod.execa;
};

const resolveLogDir = () => {
  const override = process.env.GODEX_LOG_DIR;
  const base = override && override.trim() ? override.trim() : resolve(process.cwd(), ".godex", "logs");
  mkdirSync(base, { recursive: true });
  return base;
};

const appendBootstrapLog = (entry: string) => {
  try {
    const logPath = resolve(resolveLogDir(), "codex-bootstrap.log");
    appendFileSync(logPath, entry);
  } catch {
    // ignore log failures
  }
};

export const resolveTemplateWithCodex = async (name: string, description: string): Promise<TemplateDecision> => {
  const prompt = buildTemplatePrompt(name, description);
  const execa = await loadExeca();
  const { command, args, useStdin } = buildCodexExecArgs(prompt);
  const result = await execa(command, args, {
    reject: false,
    cwd: process.cwd(),
    input: useStdin ? prompt : undefined
  });
  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();
  const timestamp = new Date().toISOString();
  const logEntry = [
    `---- ${timestamp} ----`,
    `name: ${name}`,
    `description: ${description}`,
    `command: ${command} ${args.join(" ")}`,
    `exitCode: ${result.exitCode ?? "unknown"}`,
    `stdout: ${stdout || "(empty)"}`,
    `stderr: ${stderr || "(empty)"}`,
    ""
  ].join("\n");
  appendBootstrapLog(`${logEntry}\n`);
  const decision = parseTemplateDecision(stdout || stderr);
  if (!decision) {
    return {
      template_used: "mono",
      confidence: "low",
      alternatives: templateChoices,
      reasoning: "Unable to parse template decision"
    };
  }
  return decision;
};

export const invalidNamePattern = /[<>:"/\\|?*]/;

export const validateRepoName = (name: string): { ok: boolean; error?: string } => {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "name required" };
  if (invalidNamePattern.test(trimmed)) {
    return { ok: false, error: "name contains invalid characters" };
  }
  if (trimmed.endsWith(".") || trimmed.endsWith(" ")) {
    return { ok: false, error: "name cannot end with dot or space" };
  }
  return { ok: true };
};

const isDirectory = (path: string): boolean => {
  if (!existsSync(path)) return false;
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

export const resolveDefaultRepoRoot = (): string | null => {
  const env = process.env.GODEX_DEFAULT_REPO_ROOT;
  if (env && isDirectory(env)) return resolve(env);
  const fallbacks = ["P:\\software", "C:\\Code", resolve(homedir(), "Code")];
  for (const candidate of fallbacks) {
    if (isDirectory(candidate)) return resolve(candidate);
  }
  return null;
};

export const resolveRepoRoot = (input?: string | null): string | null => {
  if (input && isDirectory(input)) return resolve(input);
  if (input) return null;
  return resolveDefaultRepoRoot();
};

export const buildTargetRepoPath = (root: string, name: string): string => {
  return resolve(root, name.trim());
};

export const checkRepoAvailability = (root: string, name: string):
  | { ok: true; repo_path: string }
  | { ok: false; error: "repo_exists"; repo_path: string } => {
  const repo_path = buildTargetRepoPath(root, name);
  if (existsSync(repo_path)) {
    return { ok: false, error: "repo_exists", repo_path };
  }
  return { ok: true, repo_path };
};

export const buildStrapArgs = (name: string, template: TemplateUsed, root: string, start?: boolean) => {
  const args = [name, "-t", template, "-p", root];
  if (start) args.push("--start");
  return args;
};

export const buildBootstrapMessage = (name: string, repoPath: string, template: TemplateUsed) => {
  const lines: string[] = [];
  lines.push(`Bootstrap complete: ${name}`);
  lines.push(`Path: ${repoPath}`);
  lines.push(`Template: ${template}`);
  lines.push("");
  lines.push("Next steps:");

  if (template === "mono") {
    lines.push("- pnpm install");
    lines.push("- pnpm dev");
    lines.push("- pnpm build && pnpm start");
  } else if (template === "service" || template === "web") {
    lines.push("- pnpm install");
    lines.push("- pnpm dev");
    lines.push("- pnpm build");
  } else if (template === "python") {
    lines.push("- python -m venv .venv");
    lines.push("- .\\.venv\\Scripts\\activate");
    lines.push("- pip install -e .");
    lines.push("- pytest");
  } else if (template === "blank") {
    lines.push("- git init");
    lines.push("- add README.md or starter files");
  }

  lines.push("");
  lines.push("You can attach/rename this workspace from the UI.");
  return lines.join("\n");
};

export interface AppServerClient {
  isReady: () => boolean;
  request: (method: string, params: Record<string, unknown>) => Promise<any>;
}

const extractThreadIdFromResponse = (result: any): string | null => {
  return (
    result?.thread_id ||
    result?.threadId ||
    result?.thread?.id ||
    result?.thread?.thread_id ||
    result?.data?.thread_id ||
    result?.data?.thread?.id ||
    result?.data?.thread?.thread_id ||
    null
  );
};

export const createThread = async (appServer: AppServerClient, title?: string) => {
  const payload = title ? { title } : {};
  const attempts = [
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

export const sendThreadMessage = async (appServer: AppServerClient, threadId: string, text: string) => {
  await appServer.request("thread/resume", { threadId });
  await appServer.request("turn/start", {
    threadId,
    input: [{ type: "text", text }],
    approvalPolicy: "never"
  });
};

export const finalizeBootstrapSuccess = async (store: Store, appServer: AppServerClient, input: {
  name: string;
  repo_path: string;
  template_used: TemplateUsed;
  set_default_thread?: boolean;
}) => {
  const workspace = store.createWorkspace({ title: input.name, repo_path: input.repo_path });
  const created = await createThread(appServer, `Bootstrap: ${input.name}`);
  if (!created.thread_id) {
    throw new Error("thread create failed");
  }

  store.upsertThreadMeta({ thread_id: created.thread_id, last_seen_at: new Date().toISOString() });
  store.attachThreadToWorkspace(workspace.id, created.thread_id);

  if (input.set_default_thread !== false) {
    store.updateWorkspace(workspace.id, { default_thread_id: created.thread_id });
  }

  const message = buildBootstrapMessage(input.name, input.repo_path, input.template_used);
  await sendThreadMessage(appServer, created.thread_id, message);

  return { workspace_id: workspace.id, thread_id: created.thread_id };
};
