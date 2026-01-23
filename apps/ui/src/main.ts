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
    el.textContent = `server ok | port ${port} | pid ${data.pid ?? "?"} | uptime ${uptime}s | active ${active}`;
  } catch (err) {
    el.textContent = "server status unavailable";
  }
};

const renderLayout = (title: string, content: string) => {
  root.innerHTML = `
    <main class="page">
      <div class="ticker" id="server-status">server status...</div>
      <header class="topbar header-wrap">
        <img class="brand-image" src="/ui/godex.png" alt="godex" />
      </header>
      <section class="content">
        ${content}
      </section>
    </main>
  `;

  void updateHealth();
  if (healthInterval) {
    window.clearInterval(healthInterval);
  }
  healthInterval = window.setInterval(async () => {
    await updateHealth();
  }, 10000);
};

const renderSessionsList = async () => {
  renderLayout("sessions", `
    <div class="grid">
      <div class="card">
        <h2>add session</h2>
        <form id="session-form">
          <label>repo path (windows)</label>
          <input name="repo" placeholder="P:\\software\\godex" required />
          <label>title (optional)</label>
          <input name="title" placeholder="godex" />
          <button type="submit">create</button>
        </form>
      </div>
      <div class="card">
        <h2>sessions</h2>
        <div id="session-list" class="list">loading...</div>
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
      list.textContent = "no sessions yet.";
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

const appendChunk = (container: HTMLElement, chunk: string) => {
  const lines = chunk.split(/\n/);
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    const trimmed = line.trimStart().toLowerCase();
    if (trimmed.startsWith("user ")) {
      span.className = "user-line";
    }
    span.textContent = line;
    container.appendChild(span);
    if (index < lines.length - 1) {
      container.appendChild(document.createTextNode("\n"));
    }
  });
};

const renderRunOutput = (container: HTMLElement, events: any[]) => {
  container.textContent = "";
  for (const event of events) {
    appendChunk(container, event.chunk);
  }
  container.scrollTop = container.scrollHeight;
};

const attachStream = (runId: string, output: HTMLElement) => {
  const token = getToken();
  if (!token) {
    output.textContent = "missing token. append ?token=... to url.";
    return;
  }
  const streamUrl = `${apiBase()}/runs/${runId}/stream?token=${encodeURIComponent(token)}&replay=0`;
  const es = new EventSource(streamUrl);

  es.addEventListener("chunk", (event) => {
    const data = JSON.parse((event as MessageEvent).data);
    appendChunk(output, data.chunk);
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
  renderLayout("", `
    <div class="toolbar">
      <div id="session-location" class="location">loading...</div>
      <a href="/ui" class="link outline">cd</a>
    </div>
    <div class="card">
      <div id="session-meta" class="meta-block">loading...</div>
      <div class="notify-row">
        <label for="notify-mode">notify</label>
        <select id="notify-mode">
          <option value="needs_input_failed">needs_input_failed</option>
          <option value="all">all</option>
          <option value="off">off</option>
        </select>
      </div>
      <pre id="output" class="output"></pre>
      <div class="input-row single">
        <textarea id="message" rows="1" placeholder="send prompt to codex..."></textarea>
        <button id="send" class="send">send</button>
      </div>
      <div class="actions below thirds">
        <button id="git-status">git status</button>
        <button id="git-diff">git diff</button>
        <button id="run-tests">run tests</button>
      </div>
    </div>
    <div class="card">
      <div class="runs-header">
        <h3>runs</h3>
        <button id="clear-runs" class="ghost">clear</button>
      </div>
      <div id="run-list" class="list">loading...</div>
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
  const notifySelect = document.querySelector<HTMLSelectElement>("#notify-mode");

  const refreshRuns = async () => {
    const data = await apiFetch(`/sessions/${sessionId}`);
    const location = document.querySelector<HTMLDivElement>("#session-location");
    if (location) {
      const parts = data.session.repo_path.split(/[/\\\\]/).filter(Boolean);
      location.textContent = parts.length ? `/${parts[parts.length - 1]}` : `/${data.session.repo_path}`;
    }
    if (meta) {
      meta.innerHTML = `
        <div class="title-row"><strong>[${data.session.title}]</strong><span>status: ${data.session.status}</span></div>
      `;
    }
    if (notifySelect) {
      notifySelect.value = data.session.notify_mode || "needs_input_failed";
    }
    if (runList) {
      if (!data.runs.length) {
        runList.textContent = "no runs yet.";
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

  notifySelect?.addEventListener("change", async () => {
    const value = notifySelect.value;
    await apiFetch(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ notify_mode: value })
    });
    await refreshRuns();
  });

  clearRuns?.addEventListener("click", async () => {
    if (!confirm("clear all runs for this session?")) return;
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
  body { margin: 0; font-family: "Space Grotesk", "Segoe UI", sans-serif; background: #f2f0ea; color: #1e1a16; text-transform: lowercase; }
  .page { max-width: none; margin: 0; padding: 0; }
  .topbar { display: flex; justify-content: flex-end; align-items: center; padding: 6px 12px; }
  .header-wrap { background: #000; }
  .brand-image { width: 100%; height: auto; display: block; }
  .ticker { background: #000; text-align: center; font-size: 12px; color: #e4a05b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 6px 12px; border-bottom: 1px solid #d6d0c6; }
  .content { display: flex; flex-direction: column; padding: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .card { background: #000; border-radius: 3px; padding: 12px; box-shadow: none; border: 1px solid #e0d9ce; margin: 0; }
  h2, h3 { margin: 0 0 12px; }
  label { display: block; font-size: 12px; margin-bottom: 6px; text-transform: lowercase; letter-spacing: 0.08em; }
  input, textarea, select { width: 100%; padding: 8px 10px; border-radius: 3px; border: 1px solid #d6d0c6; font-size: 14px; margin-bottom: 0; background: #0f0d0b; color: #f5efe6; box-sizing: border-box; }
  button { padding: 10px 14px; border-radius: 3px; border: none; background: #2a2420; color: #fff; font-weight: 600; cursor: pointer; }
  .send { background: #6f6a62; }
  button:hover { background: #3c342e; }
  .ghost { background: transparent; color: #f5efe6; border: 1px solid #d6d0c6; }
  .ghost:hover { background: #efe9de; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .list-item { display: block; padding: 12px; border-radius: 3px; border: 1px solid #e0d9ce; text-decoration: none; color: inherit; }
  .list-item .title { font-weight: 600; }
  .list-item .meta { font-size: 12px; color: #6a6056; }
  .list-item .status { font-size: 12px; text-transform: lowercase; letter-spacing: 0.08em; }
  .toolbar { background: #000; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; }
  .actions { display: flex; gap: 8px; flex-wrap: nowrap; }
  .actions.below { margin-top: 10px; }
  .actions.thirds button { flex: 1; }
  .link { text-decoration: none; color: #2a2420; font-weight: 600; }
  .link.outline { color: #e4a05b; padding: 6px 10px; border-radius: 3px; text-transform: lowercase; }
  .input-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
  .input-row.single textarea { height: 34px; resize: none; overflow: hidden; }
  .meta-block { color: #4c4036; margin-bottom: 8px; }
  .notify-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #f5efe6; }
  .notify-row label { margin: 0; font-size: 12px; letter-spacing: 0.08em; }
  .title-row { color: #f5efe6; display: flex; justify-content: space-between; align-items: baseline; }
  .location { font-size: 16px; color: #e4a05b; font-weight: 600; }
  .output { text-wrap: auto; background: #0f0d0b; color: #f5efe6; min-height: 220px; max-height: 320px; overflow: auto; padding: 12px; border-radius: 3px; margin-bottom: 8px; }
  .run-item { text-align: left; padding: 10px; border-radius: 3px; border: 1px solid #e0d9ce; background: #000; }
  .run-item .meta { font-size: 11px; color: #6a6056; }
  .runs-header { color: #f5efe6; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  @media (max-width: 720px) { .input-row { grid-template-columns: 1fr; } }
`;

document.head.appendChild(style);
route();
