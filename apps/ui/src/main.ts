const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root");
}

const qs = new URLSearchParams(window.location.search);
const tokenParam = qs.get("token");

if (tokenParam) {
  localStorage.setItem("godex_token", tokenParam);
}

const getToken = () => localStorage.getItem("godex_token") ?? "";
const apiBase = () => window.location.origin;

const apiFetch = async (path: string, init?: RequestInit) => {
  const token = getToken();
  const headers = new Headers(init?.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
};

let healthInterval: number | null = null;

const updateHealth = async () => {
  const el = document.querySelector<HTMLDivElement>("#server-status");
  if (!el) return;
  try {
    const data = await apiFetch("/health");
    const port = window.location.port || "?";
    const uptime = Math.round(Number(data.uptime ?? 0));
    const active = data.active_runs ?? 0;
    el.textContent = `Server ok | port ${port} | pid ${data.pid ?? "?"} | uptime ${uptime}s | active ${active}`;
  } catch (err) {
    el.textContent = `Server status unavailable`;
  }
};

const renderLayout = (title: string, content: string) => {
  root.innerHTML = `
    <main class="page">
      <header class="topbar">
        <div>
          <div class="brand">godex</div>
          <div class="sub">${title}</div>
          <div class="status" id="server-status">Server status...</div>
        </div>
        <div class="token">Token ${getToken() ? "loaded" : "missing"}</div>
      </header>
      <section class="content">
        ${content}
      </section>
      <footer class="footer">
        <div class="status" id="server-status-footer"></div>
      </footer>
    </main>
  `;

  const footer = document.querySelector<HTMLDivElement>("#server-status-footer");
  if (footer) {
    footer.textContent = "Server status...";
  }

  void updateHealth();
  if (healthInterval) {
    window.clearInterval(healthInterval);
  }
  healthInterval = window.setInterval(async () => {
    await updateHealth();
    const header = document.querySelector<HTMLDivElement>("#server-status");
    if (header && footer) {
      footer.textContent = header.textContent;
    }
  }, 10000);
};

const renderSessionsList = async () => {
  renderLayout("Sessions", `
    <div class="grid">
      <div class="card">
        <h2>Add session</h2>
        <form id="session-form">
          <label>Repo path (Windows)</label>
          <input name="repo" placeholder="P:\\software\\godex" required />
          <label>Title (optional)</label>
          <input name="title" placeholder="godex" />
          <button type="submit">Create</button>
        </form>
      </div>
      <div class="card">
        <h2>Sessions</h2>
        <div id="session-list" class="list">Loading...</div>
      </div>
    </div>
  `);

  const list = document.querySelector<HTMLDivElement>("#session-list");
  const form = document.querySelector<HTMLFormElement>("#session-form");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const repo_path = String(formData.get("repo") || "").trim();
    const title = String(formData.get("title") || "").trim();
    if (!repo_path) return;
    try {
      await apiFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({ repo_path, title: title || undefined })
      });
      window.location.reload();
    } catch (err) {
      alert(String(err));
    }
  });

  try {
    const data = await apiFetch("/sessions");
    if (!list) return;
    if (!data.sessions.length) {
      list.textContent = "No sessions yet.";
      return;
    }
    list.innerHTML = data.sessions
      .map((session: any) => {
        return `
          <a class="list-item" href="/ui/s/${session.id}${getToken() ? `?token=${encodeURIComponent(getToken())}` : ""}">
            <div class="title">${session.title}</div>
            <div class="meta">${session.repo_path}</div>
            <div class="status">${session.status}</div>
          </a>
        `;
      })
      .join("");
  } catch (err) {
    if (list) list.textContent = String(err);
  }
};

const renderRunOutput = (container: HTMLElement, events: any[]) => {
  container.textContent = "";
  for (const event of events) {
    const span = document.createElement("span");
    span.textContent = event.chunk;
    container.appendChild(span);
  }
  container.scrollTop = container.scrollHeight;
};

const attachStream = (runId: string, output: HTMLElement) => {
  const token = getToken();
  if (!token) {
    output.textContent = "Missing token. Append ?token=... to URL.";
    return;
  }
  const streamUrl = `${apiBase()}/runs/${runId}/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(streamUrl);

  es.addEventListener("chunk", (event) => {
    const data = JSON.parse((event as MessageEvent).data);
    const span = document.createElement("span");
    span.textContent = data.chunk;
    output.appendChild(span);
    output.scrollTop = output.scrollHeight;
  });

  es.addEventListener("final", () => {
    es.close();
  });
};

const loadRun = async (runId: string, output: HTMLElement) => {
  const data = await apiFetch(`/runs/${runId}`);
  renderRunOutput(output, data.events);
};

const renderSessionDetail = async (sessionId: string) => {
  renderLayout("Session", `
    <div class="toolbar">
      <a href="/ui" class="link">Back</a>
      <div class="actions">
        <button id="git-status">Git Status</button>
        <button id="git-diff">Git Diff</button>
        <button id="run-tests">Run Tests</button>
      </div>
    </div>
    <div class="card">
      <div id="session-meta" class="meta-block">Loading...</div>
      <div class="input-row">
        <textarea id="message" rows="3" placeholder="Send prompt to codex..."></textarea>
        <button id="send">Send</button>
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="runs-header">
          <h3>Runs</h3>
          <button id="clear-runs" class="ghost">Clear</button>
        </div>
        <div id="run-list" class="list">Loading...</div>
      </div>
      <div class="card">
        <h3>Output</h3>
        <pre id="output" class="output"></pre>
      </div>
    </div>
  `);

  const meta = document.querySelector<HTMLDivElement>("#session-meta");
  const runList = document.querySelector<HTMLDivElement>("#run-list");
  const output = document.querySelector<HTMLPreElement>("#output");
  const sendBtn = document.querySelector<HTMLButtonElement>("#send");
  const msg = document.querySelector<HTMLTextAreaElement>("#message");
  const gitStatus = document.querySelector<HTMLButtonElement>("#git-status");
  const gitDiff = document.querySelector<HTMLButtonElement>("#git-diff");
  const runTests = document.querySelector<HTMLButtonElement>("#run-tests");
  const clearRuns = document.querySelector<HTMLButtonElement>("#clear-runs");

  const refreshRuns = async () => {
    const data = await apiFetch(`/sessions/${sessionId}`);
    if (meta) {
      meta.innerHTML = `
        <div><strong>${data.session.title}</strong></div>
        <div>${data.session.repo_path}</div>
        <div>Status: ${data.session.status}</div>
      `;
    }
    if (runList) {
      if (!data.runs.length) {
        runList.textContent = "No runs yet.";
      } else {
        runList.innerHTML = data.runs
          .map((run: any) => {
            return `
              <button class="run-item" data-run="${run.id}">
                <div>${run.type}</div>
                <div class="meta">${run.status} ${run.exit_code ?? ""}</div>
              </button>
            `;
          })
          .join("");
        const first = data.runs[0];
        if (first && output) {
          await loadRun(first.id, output);
        }
      }
    }
  };

  const startAction = async (path: string, body?: unknown) => {
    if (!output) return;
    output.textContent = "";
    const data = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    });
    attachStream(data.run_id, output);
    await refreshRuns();
  };

  sendBtn?.addEventListener("click", async () => {
    if (!msg) return;
    const text = msg.value.trim();
    if (!text) return;
    msg.value = "";
    await startAction(`/sessions/${sessionId}/message`, { text });
  });

  gitStatus?.addEventListener("click", async () => {
    await startAction(`/sessions/${sessionId}/git/status`);
  });

  gitDiff?.addEventListener("click", async () => {
    await startAction(`/sessions/${sessionId}/git/diff`);
  });

  runTests?.addEventListener("click", async () => {
    await startAction(`/sessions/${sessionId}/test`);
  });

  clearRuns?.addEventListener("click", async () => {
    if (!confirm("Clear all runs for this session?")) return;
    await apiFetch(`/sessions/${sessionId}/runs/clear`, { method: "POST" });
    if (output) output.textContent = "";
    await refreshRuns();
  });

  runList?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(".run-item");
    if (!button || !output) return;
    const runId = button.dataset.run;
    if (!runId) return;
    await loadRun(runId, output);
  });

  await refreshRuns();
};

const route = () => {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/" || path === "/ui") {
    void renderSessionsList();
    return;
  }
  if (path.startsWith("/ui/s/")) {
    const sessionId = path.split("/").pop();
    if (sessionId) void renderSessionDetail(sessionId);
    return;
  }
  if (path.startsWith("/s/")) {
    const sessionId = path.split("/").pop();
    if (sessionId) void renderSessionDetail(sessionId);
    return;
  }
  void renderSessionsList();
};

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light; }
  body { margin: 0; font-family: "Space Grotesk", "Segoe UI", sans-serif; background: #f2f0ea; color: #1e1a16; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px 60px; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 16px; }
  .brand { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  .sub { color: #6a6056; font-size: 14px; }
  .token { font-size: 12px; padding: 6px 10px; border: 1px solid #c9c2b8; border-radius: 999px; align-self: flex-start; }
  .status { font-size: 12px; color: #6a6056; margin-top: 6px; }
  .content { display: flex; flex-direction: column; gap: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .card { background: #fffdf9; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(78, 63, 48, 0.12); }
  h2, h3 { margin: 0 0 12px; }
  label { display: block; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  input, textarea { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d6d0c6; font-size: 14px; margin-bottom: 12px; background: #fff; }
  button { padding: 10px 14px; border-radius: 10px; border: none; background: #2a2420; color: #fff; font-weight: 600; cursor: pointer; }
  button:hover { background: #3c342e; }
  .ghost { background: transparent; color: #2a2420; border: 1px solid #d6d0c6; }
  .ghost:hover { background: #efe9de; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .list-item { display: block; padding: 12px; border-radius: 12px; border: 1px solid #e0d9ce; text-decoration: none; color: inherit; }
  .list-item .title { font-weight: 600; }
  .list-item .meta { font-size: 12px; color: #6a6056; }
  .list-item .status { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .link { text-decoration: none; color: #2a2420; font-weight: 600; }
  .input-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; }
  .meta-block { color: #4c4036; }
  .output { background: #0f0d0b; color: #f5efe6; min-height: 320px; max-height: 420px; overflow: auto; padding: 12px; border-radius: 12px; }
  .run-item { text-align: left; padding: 10px; border-radius: 10px; border: 1px solid #e0d9ce; background: #f8f4ee; }
  .run-item .meta { font-size: 11px; color: #6a6056; }
  .runs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .footer { margin-top: 24px; }
  @media (max-width: 720px) { .input-row { grid-template-columns: 1fr; } }
`;

document.head.appendChild(style);
route();
