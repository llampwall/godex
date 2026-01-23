
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

const withToken = (path: string) => {
  const token = getToken();
  if (!token) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}token=${encodeURIComponent(token)}`;
};

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
    const workspaces = data.workspace_count ?? 0;
    const linked = data.linked_threads_count ?? 0;
    el.textContent = `server ok | port ${port} | pid ${data.pid ?? "?"} | uptime ${uptime}s | active ${active} | workspaces ${workspaces} | links ${linked}`;
  } catch (err) {
    el.textContent = "server status unavailable";
  }
};

const renderLayout = (activeTab: "workspaces" | "threads", content: string, banner?: string) => {
  root.innerHTML = `
    <main class="page">
      <div class="ticker" id="server-status">server status...</div>
      <header class="topbar header-wrap">
        <img class="brand-image" src="/ui/godex.png" alt="godex" />
      </header>
      <nav class="tabs">
        <a class="tab ${activeTab === "workspaces" ? "active" : ""}" href="${withToken("/ui")}" style="color: cornflowerblue; margin-left: auto;">workspaces</a>
        <a class="tab ${activeTab === "threads" ? "active" : ""}" href="${withToken("/ui/threads")}">threads</a>
      </nav>
      ${banner ? `<div class="banner">${banner}</div>` : ""}
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

const formatTimestamp = (value?: string | number | null) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return trimmed;
    return date.toLocaleString();
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleString();
};

const getThreadTitle = (thread: any): string => {
  const source = String(thread?.summary ?? thread?.title ?? "").trim();
  if (!source) return "(untitled)";
  return source.split(/\r?\n/)[0] ?? source;
};

const getThreadSnippet = (thread: any): string => {
  return String(thread?.summary ?? "").trim();
};

const appendChunk = (container: HTMLElement, chunk: string) => {
  const lines = chunk.split(/\n/);
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    const trimmed = line.trimStart().toLowerCase();
    if (trimmed.startsWith("user ") || trimmed.startsWith("user:")) {
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

const buildThreadBadge = (label: string) => `<span class="badge">${label}</span>`;

const buildModal = (title: string, body: string) => `
  <div class="modal-backdrop" id="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="ghost" id="modal-close">close</button>
      </div>
      ${body}
    </div>
  </div>
`;

const openThreadPicker = async (onPick: (thread: any, setDefault: boolean) => Promise<void>, includeArchived = true) => {
  const modalHost = document.querySelector<HTMLDivElement>("#modal-host");
  if (!modalHost) return;

  modalHost.innerHTML = buildModal(
    "attach thread",
    `
      <div class="modal-controls">
        <label><input type="checkbox" id="picker-set-default" /> set as default</label>
      </div>
      <div class="list" id="picker-list">loading...</div>
    `
  );

  const close = () => {
    modalHost.innerHTML = "";
  };

  modalHost.querySelector("#modal-close")?.addEventListener("click", close);
  modalHost.querySelector("#modal-backdrop")?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).id === "modal-backdrop") close();
  });

  const list = modalHost.querySelector<HTMLDivElement>("#picker-list");
  const setDefault = modalHost.querySelector<HTMLInputElement>("#picker-set-default");

  try {
    const data = await apiFetch(`/threads?limit=100${includeArchived ? "&include_archived=1" : ""}`);
    const threads = Array.isArray(data.data) ? data.data : [];
    if (!list) return;
    if (!threads.length) {
      list.textContent = "no threads yet.";
      return;
    }
    list.innerHTML = threads
      .map((thread: any) => {
        return `
          <button class="list-item" data-thread="${thread.thread_id}">
            <div class="title">${thread.title}</div>
            <div class="meta">${formatTimestamp(thread.updated_at)}</div>
          </button>
        `;
      })
      .join("");

    list.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>(".list-item");
      if (!button) return;
      const threadId = button.dataset.thread;
      if (!threadId) return;
      const thread = threads.find((item: any) => item.thread_id === threadId) ?? { thread_id: threadId };
      await onPick(thread, Boolean(setDefault?.checked));
      close();
    });
  } catch (err) {
    if (list) list.textContent = String(err);
  }
};

const openWorkspacePicker = async (title: string, onPick: (workspace: any, setDefault: boolean) => Promise<void>) => {
  const modalHost = document.querySelector<HTMLDivElement>("#modal-host");
  if (!modalHost) return;

  modalHost.innerHTML = buildModal(
    title,
    `
      <div class="modal-controls">
        <label><input type="checkbox" id="picker-set-default" /> set as default</label>
      </div>
      <div class="list" id="picker-list">loading...</div>
    `
  );

  const close = () => {
    modalHost.innerHTML = "";
  };

  modalHost.querySelector("#modal-close")?.addEventListener("click", close);
  modalHost.querySelector("#modal-backdrop")?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).id === "modal-backdrop") close();
  });

  const list = modalHost.querySelector<HTMLDivElement>("#picker-list");
  const setDefault = modalHost.querySelector<HTMLInputElement>("#picker-set-default");

  try {
    const data = await apiFetch("/workspaces");
    const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
    if (!list) return;
    if (!workspaces.length) {
      list.textContent = "no workspaces yet.";
      return;
    }
    list.innerHTML = workspaces
      .map((workspace: any) => {
        return `
          <button class="list-item" data-workspace="${workspace.id}">
            <div class="title">${workspace.title}</div>
            <div class="meta">${workspace.repo_path}</div>
          </button>
        `;
      })
      .join("");

    list.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>(".list-item");
      if (!button) return;
      const workspaceId = button.dataset.workspace;
      if (!workspaceId) return;
      const workspace = workspaces.find((item: any) => item.id === workspaceId) ?? { id: workspaceId };
      await onPick(workspace, Boolean(setDefault?.checked));
      close();
    });
  } catch (err) {
    if (list) list.textContent = String(err);
  }
};

const renderWorkspacesList = async () => {
  renderLayout("workspaces", `
    <div class="card">
      <div class="section-header">
        <h2 style="color: cornflowerblue;">workspaces</h2>
        <button id="open-workspace-modal" class="ghost">+</button>
      </div>
      <div id="workspace-list" class="list">loading...</div>
    </div>
    <div id="modal-host"></div>
  `);

  const list = document.querySelector<HTMLDivElement>("#workspace-list");
  const openModal = document.querySelector<HTMLButtonElement>("#open-workspace-modal");

  const openCreateWorkspace = () => {
    const modalHost = document.querySelector<HTMLDivElement>("#modal-host");
    if (!modalHost) return;

    modalHost.innerHTML = buildModal(
      "add workspace",
      `
        <form id="workspace-form">
          <label>repo path (windows)</label>
          <input name="repo" placeholder="P:\\software\\godex" required />
          <label>title (optional)</label>
          <input name="title" placeholder="godex" />
          <div class="actions below">
            <button type="submit">create</button>
            <button type="button" id="cancel-workspace" class="ghost">cancel</button>
          </div>
        </form>
      `
    );

    const form = modalHost.querySelector<HTMLFormElement>("#workspace-form");
    const cancel = modalHost.querySelector<HTMLButtonElement>("#cancel-workspace");
    const close = () => { modalHost.innerHTML = ""; };

    cancel?.addEventListener("click", close);
    modalHost.querySelector("#modal-close")?.addEventListener("click", close);
    modalHost.querySelector("#modal-backdrop")?.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).id === "modal-backdrop") close();
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form) return;
      const formData = new FormData(form);
      const repo_path = String(formData.get("repo") || "").trim();
      const title = String(formData.get("title") || "").trim();
      if (!repo_path) return;
      try {
        await apiFetch("/workspaces", {
          method: "POST",
          body: JSON.stringify({ repo_path, title: title || undefined })
        });
        close();
        window.location.reload();
      } catch (err) {
        alert(String(err));
      }
    });
  };

  openModal?.addEventListener("click", openCreateWorkspace);

  try {
    const data = await apiFetch("/workspaces");
    const metaData = await apiFetch("/threads/meta");
    const metaEntries = Array.isArray(metaData.meta) ? metaData.meta : [];
    const metaMap = new Map<string, any>(metaEntries.map((entry: any) => [entry.thread_id, entry]));
    if (!list) return;
    if (!data.workspaces.length) {
      list.textContent = "no workspaces yet.";
      return;
    }
    list.innerHTML = data.workspaces
      .map((workspace: any) => {
        const defaultThread = workspace.default_thread_id
          ? metaMap.get(workspace.default_thread_id)?.title_override || workspace.default_thread_id
          : "none";
        const badge = buildThreadBadge(workspace.notify_policy ?? "needs_input+failed");
        return `
          <a class="list-item" href="${withToken(`/ui/w/${workspace.id}`)}">
            <div class="title">${workspace.title}</div>
            <div class="meta">${workspace.repo_path}</div>
            <div class="meta-row">
              ${badge}
              <span>default thread: ${defaultThread}</span>
            </div>
            <div class="meta">last activity: ${formatTimestamp(workspace.last_activity_at)}</div>
          </a>
        `;
      })
      .join("");
  } catch (err) {
    if (list) list.textContent = String(err);
  }
};

const renderWorkspaceDetail = async (workspaceId: string) => {
  renderLayout("workspaces", `
    <div class="toolbar">
      <div id="workspace-location" class="location">loading...</div>
      <a href="${withToken("/ui")}" class="link outline">back</a>
    </div>
    <div class="card">
      <div id="workspace-meta" class="meta-block">loading...</div>
      <div class="actions below thirds">
        <button id="open-folder">open folder</button>
        <button id="open-code">open in VS code</button>
        <button id="open-thread">open default thread</button>
      </div>
      <div class="notify-row">
        <label for="notify-policy">notify</label>
        <select id="notify-policy">
          <option value="needs_input+failed">needs_input+failed</option>
          <option value="all">all</option>
          <option value="off">off</option>
        </select>
      </div>
      <div class="input-row single">
        <textarea id="message" rows="1" placeholder="send prompt to default thread..."></textarea>
        <button id="send" class="send">send</button>
      </div>
      <div class="helper" id="thread-helper"></div>
      <div class="actions below thirds">
        <button id="git-status">git status</button>
        <button id="git-diff">git diff</button>
        <button id="run-tests">run tests</button>
      </div>
      <pre id="output" class="output"></pre>
    </div>
    <div class="card">
      <div class="section-header">
        <h3>linked threads</h3>
        <button id="attach-thread" class="ghost">attach thread</button>
      </div>
      <div id="linked-threads" class="list">loading...</div>
      <div class="input-row" style="margin-top: 12px;">
        <select id="default-thread"></select>
        <button id="save-default" class="ghost">set default</button>
      </div>
    </div>
    <div class="card">
      <div class="runs-header">
        <h3>runs</h3>
        <button id="clear-runs" class="ghost">clear</button>
      </div>
      <div id="run-list" class="list">loading...</div>
    </div>
    <div id="modal-host"></div>
  `);

  const meta = document.querySelector<HTMLDivElement>("#workspace-meta");
  const runList = document.querySelector<HTMLDivElement>("#run-list");
  const output = document.querySelector<HTMLPreElement>("#output");
  const sendBtn = document.querySelector<HTMLButtonElement>("#send");
  const msg = document.querySelector<HTMLTextAreaElement>("#message");
  const gitStatus = document.querySelector<HTMLButtonElement>("#git-status");
  const gitDiff = document.querySelector<HTMLButtonElement>("#git-diff");
  const runTests = document.querySelector<HTMLButtonElement>("#run-tests");
  const clearRuns = document.querySelector<HTMLButtonElement>("#clear-runs");
  const notifySelect = document.querySelector<HTMLSelectElement>("#notify-policy");
  const openFolder = document.querySelector<HTMLButtonElement>("#open-folder");
  const openCode = document.querySelector<HTMLButtonElement>("#open-code");
  const openThread = document.querySelector<HTMLButtonElement>("#open-thread");
  const threadHelper = document.querySelector<HTMLDivElement>("#thread-helper");
  const linkedThreads = document.querySelector<HTMLDivElement>("#linked-threads");
  const attachThread = document.querySelector<HTMLButtonElement>("#attach-thread");
  const defaultSelect = document.querySelector<HTMLSelectElement>("#default-thread");
  const saveDefault = document.querySelector<HTMLButtonElement>("#save-default");

  let workspace: any = null;
  let threadsCache: any[] = [];

  const refreshRuns = async () => {
    const data = await apiFetch(`/workspaces/${workspaceId}`);
    workspace = data.workspace;

    const location = document.querySelector<HTMLDivElement>("#workspace-location");
    if (location) {
      const parts = data.workspace.repo_path.split(/[/\\]/).filter(Boolean);
      location.textContent = parts.length ? `/${parts[parts.length - 1]}` : `/${data.workspace.repo_path}`;
    }
    if (meta) {
      meta.innerHTML = `
        <div class="title-row"><strong>[${data.workspace.title}]</strong><span>${data.workspace.repo_path}</span></div>
      `;
    }
    if (notifySelect) {
      notifySelect.value = data.workspace.notify_policy || "needs_input+failed";
    }

    await refreshThreads();

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

  const refreshThreads = async () => {
    if (!linkedThreads || !defaultSelect) return;

    const linkedIds = new Set<string>();
    const workspaceData = await apiFetch(`/workspaces/${workspaceId}`);
    (workspaceData.linked_thread_ids ?? []).forEach((id: string) => linkedIds.add(id));

    let threadData: any[] = [];
    try {
      const res = await apiFetch("/threads?limit=100&include_archived=1");
      threadData = res.data ?? [];
    } catch {
      const metaRes = await apiFetch("/threads/meta");
      threadData = (metaRes.meta ?? []).map((meta: any) => ({
        thread_id: meta.thread_id,
        title: meta.title_override || meta.thread_id,
        updated_at: meta.last_seen_at,
        summary: "",
        archived: meta.archived ?? false
      }));
    }

    threadsCache = threadData;

    const linkedList = threadData.filter((thread: any) => linkedIds.has(thread.thread_id));
    if (!linkedList.length) {
      linkedThreads.textContent = "no linked threads yet.";
    } else {
      linkedThreads.innerHTML = linkedList
        .map((thread: any) => {
          return `
            <div class="list-item">
              <div class="title">${thread.title}</div>
              <div class="meta">${thread.thread_id}</div>
              <div class="actions below">
                <a class="link outline" href="${withToken(`/ui/t/${thread.thread_id}`)}">open</a>
                <button class="ghost" data-detach="${thread.thread_id}">detach</button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    defaultSelect.innerHTML = `
      <option value="">no default thread</option>
      ${threadData
        .map((thread: any) => `<option value="${thread.thread_id}">${thread.title}</option>`)
        .join("")}
    `;
    if (workspace?.default_thread_id) {
      defaultSelect.value = workspace.default_thread_id;
    }

    linkedThreads.querySelectorAll<HTMLButtonElement>("[data-detach]").forEach((button) => {
      button.addEventListener("click", async () => {
        const threadId = button.dataset.detach;
        if (!threadId) return;
        await apiFetch(`/workspaces/${workspaceId}/threads/${threadId}`, { method: "DELETE" });
        await refreshThreads();
      });
    });

    if (threadHelper) {
      if (!workspace?.default_thread_id) {
        threadHelper.innerHTML = `
          <div class="helper-text">no default thread set.</div>
          <div class="actions below">
            <button id="pick-thread" class="ghost">pick thread</button>
            <button id="create-thread" class="ghost">create new thread</button>
          </div>
        `;
        const pick = threadHelper.querySelector<HTMLButtonElement>("#pick-thread");
        const create = threadHelper.querySelector<HTMLButtonElement>("#create-thread");

        pick?.addEventListener("click", async () => {
          await openThreadPicker(async (thread, setDefault) => {
            await apiFetch(`/workspaces/${workspaceId}/threads`, {
              method: "POST",
              body: JSON.stringify({ thread_id: thread.thread_id })
            });
            if (setDefault) {
              await apiFetch(`/workspaces/${workspaceId}`, {
                method: "PATCH",
                body: JSON.stringify({ default_thread_id: thread.thread_id })
              });
            }
            await refreshThreads();
          });
        });

        create?.addEventListener("click", async () => {
          try {
            const res = await apiFetch("/threads/create", { method: "POST", body: JSON.stringify({}) });
            if (!res.thread_id) {
              alert("failed to create thread");
              return;
            }
            await apiFetch(`/workspaces/${workspaceId}/threads`, {
              method: "POST",
              body: JSON.stringify({ thread_id: res.thread_id })
            });
            await apiFetch(`/workspaces/${workspaceId}`, {
              method: "PATCH",
              body: JSON.stringify({ default_thread_id: res.thread_id })
            });
            await refreshThreads();
          } catch (err) {
            alert(String(err));
          }
        });
      } else {
        threadHelper.innerHTML = `
          <div class="helper-text">default thread is set.</div>
        `;
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
    if (!msg || !workspace) return;
    const text = msg.value.trim();
    if (!text) return;
    msg.value = "";
    if (!workspace.default_thread_id) {
      alert("Pick a default thread first.");
      return;
    }
    const data = await apiFetch(`/threads/${workspace.default_thread_id}/message`, {
      method: "POST",
      body: JSON.stringify({ text, workspace_id: workspace.id })
    });
    if (output) {
      output.textContent = "";
      attachStream(data.run_id, output);
    }
  });

  gitStatus?.addEventListener("click", async () => {
    await startAction(`/workspaces/${workspaceId}/git/status`);
  });

  gitDiff?.addEventListener("click", async () => {
    await startAction(`/workspaces/${workspaceId}/git/diff`);
  });

  runTests?.addEventListener("click", async () => {
    await startAction(`/workspaces/${workspaceId}/test`);
  });

  notifySelect?.addEventListener("change", async () => {
    const value = notifySelect.value;
    await apiFetch(`/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ notify_policy: value })
    });
    await refreshRuns();
  });

  clearRuns?.addEventListener("click", async () => {
    if (!confirm("clear all runs for this workspace?")) return;
    await apiFetch(`/workspaces/${workspaceId}/runs/clear`, { method: "POST" });
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

  openFolder?.addEventListener("click", async () => {
    try {
      await apiFetch(`/workspaces/${workspaceId}/open-folder`, { method: "POST" });
    } catch (err) {
      alert(String(err));
    }
  });

  openCode?.addEventListener("click", async () => {
    try {
      await apiFetch(`/workspaces/${workspaceId}/open-code`, { method: "POST" });
    } catch (err) {
      alert(String(err));
    }
  });

  openThread?.addEventListener("click", () => {
    if (!workspace?.default_thread_id) {
      alert("No default thread set.");
      return;
    }
    window.location.href = withToken(`/ui/t/${workspace.default_thread_id}`);
  });

  attachThread?.addEventListener("click", async () => {
    await openThreadPicker(async (thread, setDefault) => {
      await apiFetch(`/workspaces/${workspaceId}/threads`, {
        method: "POST",
        body: JSON.stringify({ thread_id: thread.thread_id })
      });
      if (setDefault) {
        await apiFetch(`/workspaces/${workspaceId}`, {
          method: "PATCH",
          body: JSON.stringify({ default_thread_id: thread.thread_id })
        });
      }
      await refreshThreads();
    });
  });

  saveDefault?.addEventListener("click", async () => {
    const selected = defaultSelect?.value || null;
    await apiFetch(`/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ default_thread_id: selected })
    });
    await refreshRuns();
  });

  await refreshRuns();
};

const extractItemText = (item: any): string => {
  if (!item) return "";
  if (typeof item.text === "string") return item.text;
  if (typeof item.content === "string") return item.content;
  if (Array.isArray(item.content)) {
    return item.content
      .map((entry: any) => {
        if (typeof entry?.text === "string") return entry.text;
        if (typeof entry?.content === "string") return entry.content;
        return "";
      })
      .join("");
  }
  return "";
};

const renderThreadTranscript = (output: HTMLElement, payload: { items?: any[]; turns?: any[] }) => {
  output.textContent = "";
  const lines: string[] = [];

  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      const role = item?.role ?? item?.author ?? item?.type ?? "item";
      const text = extractItemText(item);
      if (text) {
        lines.push(`${role}: ${text}`);
      }
    }
  } else if (Array.isArray(payload.turns)) {
    for (const turn of payload.turns) {
      const role = turn?.role ?? turn?.author ?? "turn";
      const text = extractItemText(turn) || extractItemText(turn?.message);
      if (text) {
        lines.push(`${role}: ${text}`);
      }
    }
  }

  if (!lines.length) {
    output.textContent = "no transcript available.";
    return;
  }

  lines.forEach((line) => appendChunk(output, line));
  output.scrollTop = output.scrollHeight;
};

const renderThreadsList = async () => {
  renderLayout("threads", `
    <div class="card">
      <div class="threads-header">
        <h2 style="color: #e4a05b;">threads</h2>
        <div class="actions">
          <label class="toggle"><input type="checkbox" id="show-archived" /><span style="margin-bottom: 6px;">show archived</span></label>
          <button id="refresh-threads" class="ghost">refresh</button>
        </div>
      </div>
      <div id="threads-banner" class="banner hidden"></div>
      <div id="thread-list" class="list">loading...</div>
    </div>
  `);

  const list = document.querySelector<HTMLDivElement>("#thread-list");
  const refresh = document.querySelector<HTMLButtonElement>("#refresh-threads");
  const archivedToggle = document.querySelector<HTMLInputElement>("#show-archived");

  let menuListenerAttached = false;

  const bindThreadActions = () => {
    const cards = document.querySelectorAll<HTMLDivElement>(".thread-card");
    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".thread-menu") || target.closest(".menu-button")) return;
        const threadId = card.dataset.thread;
        if (threadId) {
          window.location.href = withToken(`/ui/t/${threadId}`);
        }
      });
    });

    const menus = document.querySelectorAll<HTMLButtonElement>(".menu-button");
    menus.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const threadId = button.dataset.menu;
        if (!threadId) return;
        document.querySelectorAll<HTMLElement>(".thread-menu").forEach((menu) => {
          if (menu.dataset.menuFor !== threadId) menu.classList.remove("open");
        });
        const menu = document.querySelector<HTMLElement>(`.thread-menu[data-menu-for="${threadId}"]`);
        menu?.classList.toggle("open");
      });
    });

    const items = document.querySelectorAll<HTMLButtonElement>(".menu-item");
    items.forEach((item) => {
      item.addEventListener("click", async (event) => {
        event.stopPropagation();
        const action = item.dataset.action;
        const threadId = item.dataset.thread;
        if (!action || !threadId) return;

        if (action === "attach") {
          await openWorkspacePicker("attach to workspace", async (workspace, setDefaultFlag) => {
            await apiFetch(`/workspaces/${workspace.id}/threads`, {
              method: "POST",
              body: JSON.stringify({ thread_id: threadId })
            });
            if (setDefaultFlag) {
              await apiFetch(`/workspaces/${workspace.id}`, {
                method: "PATCH",
                body: JSON.stringify({ default_thread_id: threadId })
              });
            }
            await loadThreads();
          });
          return;
        }

        if (action === "default") {
          await openWorkspacePicker("set default for workspace", async (workspace) => {
            await apiFetch(`/workspaces/${workspace.id}`, {
              method: "PATCH",
              body: JSON.stringify({ default_thread_id: threadId })
            });
            await loadThreads();
          });
          return;
        }

        if (action === "archive") {
          const card = document.querySelector<HTMLElement>(`.thread-card[data-thread="${threadId}"]`);
          const isArchived = card?.dataset.archived === "true";
          await apiFetch(`/threads/${threadId}/meta`, {
            method: "PATCH",
            body: JSON.stringify({ archived: !isArchived })
          });
          await loadThreads();
        }
      });
    });

    if (!menuListenerAttached) {
      document.addEventListener("click", () => {
        document.querySelectorAll<HTMLElement>(".thread-menu").forEach((menu) => menu.classList.remove("open"));
      });
      menuListenerAttached = true;
    }
  };

  const loadThreads = async () => {
    if (list) list.textContent = "loading...";
    const banner = document.querySelector<HTMLDivElement>("#threads-banner");
    try {
      if (banner) {
        banner.textContent = "";
        banner.classList.add("hidden");
      }
      const workspaces = await apiFetch("/workspaces");
      const workspaceMap = new Map<string, string>((workspaces.workspaces ?? []).map((ws: any) => [ws.id, ws.title]));
      const archived = archivedToggle?.checked ? "&include_archived=1" : "";
      const data = await apiFetch(`/threads?limit=50${archived}`);
      if (!list) return;
      if (!data.data?.length) {
        list.textContent = "no threads yet.";
        return;
      }
      const sorted = [...data.data].sort((a: any, b: any) => {
        const aTime = new Date(a.updated_at ?? 0).getTime();
        const bTime = new Date(b.updated_at ?? 0).getTime();
        return bTime - aTime;
      });
      list.innerHTML = sorted
        .map((thread: any) => {
          const badges = (thread.attached_workspace_ids ?? [])
            .map((id: string) => buildThreadBadge(workspaceMap.get(id) || id))
            .join(" ");
          const title = getThreadTitle(thread);
          const snippet = getThreadSnippet(thread);
          const archived = thread.archived ? "true" : "false";
          return `
            <div class="list-item thread-card" data-thread="${thread.thread_id}" data-archived="${archived}">
              <div class="thread-header">
                <div class="thread-date">${formatTimestamp(thread.updated_at)}</div>
                <div class="thread-menu-wrap">
                  <button class="menu-button" data-menu="${thread.thread_id}" aria-label="thread menu">☰</button>
                  <div class="thread-menu" data-menu-for="${thread.thread_id}">
                    <button class="menu-item" data-action="attach" data-thread="${thread.thread_id}">attach to</button>
                    <button class="menu-item" data-action="default" data-thread="${thread.thread_id}">set as default for</button>
                    <button class="menu-item" data-action="archive" data-thread="${thread.thread_id}">${thread.archived ? "unarchive locally" : "archive locally"}</button>
                  </div>
                </div>
              </div>
              <div class="thread-title">${title}</div>
              <div class="thread-snippet">${snippet}</div>
              ${badges ? `<div class="badges">${badges}</div>` : ""}
            </div>
          `;
        })
        .join("");

      bindThreadActions();
    } catch (err: any) {
      const message = String(err);
      if (banner && message.includes("codex app-server unavailable")) {
        banner.textContent = "codex app-server unavailable — threads list is paused. workspaces remain available.";
        banner.classList.remove("hidden");
      }
      if (list) {
        list.textContent = message;
      }
    }
  };

  refresh?.addEventListener("click", async () => {
    await loadThreads();
  });
  archivedToggle?.addEventListener("change", async () => {
    await loadThreads();
  });

  await loadThreads();
};

const renderThreadDetail = async (threadId: string) => {
  renderLayout("threads", `
    <div class="toolbar">
      <div class="location">/thread</div>
      <a href="${withToken("/ui/threads")}" class="link outline">back</a>
    </div>
    <div class="card">
      <div class="thread-meta" id="thread-meta">loading...</div>
      <div class="badges" id="thread-badges"></div>
      <div class="actions below">
        <button id="attach-workspace" class="ghost">attach to workspace</button>
        <button id="set-default" class="ghost">set as default for workspace</button>
        <button id="archive-thread" class="ghost">archive locally</button>
      </div>
      <pre id="thread-output" class="output"></pre>
      <div class="input-row">
        <textarea id="thread-message" rows="2" placeholder="send message..."></textarea>
        <button id="thread-send" class="send">send</button>
      </div>
      <div class="input-row">
        <select id="thread-link">
          <option value="">link to workspace (optional)</option>
        </select>
      </div>
    </div>
    <div id="modal-host"></div>
  `);

  const meta = document.querySelector<HTMLDivElement>("#thread-meta");
  const badges = document.querySelector<HTMLDivElement>("#thread-badges");
  const output = document.querySelector<HTMLPreElement>("#thread-output");
  const sendBtn = document.querySelector<HTMLButtonElement>("#thread-send");
  const input = document.querySelector<HTMLTextAreaElement>("#thread-message");
  const linkSelect = document.querySelector<HTMLSelectElement>("#thread-link");
  const attachWorkspace = document.querySelector<HTMLButtonElement>("#attach-workspace");
  const setDefault = document.querySelector<HTMLButtonElement>("#set-default");
  const archiveBtn = document.querySelector<HTMLButtonElement>("#archive-thread");

  let threadMeta: any = null;

  const loadWorkspaces = async () => {
    if (!linkSelect) return;
    try {
      const data = await apiFetch("/workspaces");
      if (!data.workspaces?.length) return;
      for (const workspace of data.workspaces) {
        const option = document.createElement("option");
        option.value = workspace.id;
        option.textContent = workspace.title;
        linkSelect.appendChild(option);
      }
    } catch {
      // ignore
    }
  };

  const loadThread = async () => {
    if (!output) return;
    try {
      const data = await apiFetch(`/threads/${threadId}`);
      threadMeta = data.meta;
      if (meta) {
        const title = data.thread?.title ?? data.thread?.preview ?? data.thread?.id ?? threadId;
        meta.innerHTML = `<div class="title-row"><strong>${title}</strong><span>${formatTimestamp(data.thread?.updatedAt ?? data.thread?.updated_at)}</span></div><div class="meta">id: ${threadId}</div>`;
      }
      if (badges) {
        const workspaceData = await apiFetch("/workspaces");
        const workspaceMap = new Map<string, string>((workspaceData.workspaces ?? []).map((ws: any) => [ws.id, ws.title]));
        const attached = data.attached_workspace_ids ?? [];
        badges.innerHTML = attached.map((id: string) => buildThreadBadge(workspaceMap.get(id) || id)).join(" ");
      }
      if (archiveBtn) {
        archiveBtn.textContent = threadMeta?.archived ? "unarchive locally" : "archive locally";
      }
      renderThreadTranscript(output, { items: data.items, turns: data.turns });
    } catch (err) {
      output.textContent = String(err);
    }
  };

  sendBtn?.addEventListener("click", async () => {
    if (!output || !input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
      const workspace_id = linkSelect?.value || undefined;
      const res = await apiFetch(`/threads/${threadId}/message`, {
        method: "POST",
        body: JSON.stringify({ text, workspace_id: workspace_id || undefined })
      });
      attachStream(res.run_id, output);
    } catch (err) {
      appendChunk(output, String(err));
    }
  });

  attachWorkspace?.addEventListener("click", async () => {
    await openWorkspacePicker("attach to workspace", async (workspace, setDefaultFlag) => {
      await apiFetch(`/workspaces/${workspace.id}/threads`, {
        method: "POST",
        body: JSON.stringify({ thread_id: threadId })
      });
      if (setDefaultFlag) {
        await apiFetch(`/workspaces/${workspace.id}`, {
          method: "PATCH",
          body: JSON.stringify({ default_thread_id: threadId })
        });
      }
      await loadThread();
    });
  });

  setDefault?.addEventListener("click", async () => {
    await openWorkspacePicker("set default for workspace", async (workspace) => {
      await apiFetch(`/workspaces/${workspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ default_thread_id: threadId })
      });
      await loadThread();
    });
  });

  archiveBtn?.addEventListener("click", async () => {
    const next = !threadMeta?.archived;
    await apiFetch(`/threads/${threadId}/meta`, {
      method: "PATCH",
      body: JSON.stringify({ archived: next })
    });
    await loadThread();
  });

  await loadWorkspaces();
  await loadThread();
};

const route = () => {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/" || path === "/ui") {
    void renderWorkspacesList();
    return;
  }
  if (path === "/ui/threads" || path === "/ui/t") {
    void renderThreadsList();
    return;
  }
  if (path.startsWith("/ui/w/")) {
    const workspaceId = path.split("/").pop();
    if (workspaceId) void renderWorkspaceDetail(workspaceId);
    return;
  }
  if (path.startsWith("/ui/t/")) {
    const threadId = path.split("/").pop();
    if (threadId) void renderThreadDetail(threadId);
    return;
  }
  void renderWorkspacesList();
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
  .tabs { display: flex; gap: 10px; padding: 8px 12px; background: #000; border-bottom: 1px solid #d6d0c6; }
  .tab { text-decoration: none; font-weight: 600; color: #2a2420; padding: 6px 10px 10px; border-radius: 5px; border: 1px solid transparent; }
  .tab.active { background: #000; color: #e4a05b; border-color: #000; }
  .tab:hover { border-color: #2a2420; }
  .banner { background: #efe9de; color: #2a2420; padding: 10px 12px; border-bottom: 1px solid #d6d0c6; font-size: 12px; }
  .banner.hidden { display: none; }
  .content { display: flex; flex-direction: column; padding: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) }
  .card { color: cornflowerblue; background: #000; border-radius: 3px; padding: 12px; box-shadow: none; border: 1px solid #e0d9ce; margin: 0; }
  h2, h3 { margin: 0 0 12px; }
  label { display: block; font-size: 12px; margin-bottom: 6px; text-transform: lowercase; letter-spacing: 0.08em; }
  input, textarea, select { padding: 8px 10px; border-radius: 3px; border: 1px solid #d6d0c6; font-size: 14px; margin-bottom: .5rem; background: #0f0d0b; color: #f5efe6; box-sizing: border-box; }
  input { width: 100%; }
  #show-archived { width: unset; }
  button { padding: 8px 10px; border-radius: 3px; border: none; background: #2a2420; color: #fff; font-weight: 600; cursor: pointer; }
  .send { background: #6f6a62; }
  button:hover { background: #3c342e; }
  .ghost { background: transparent; color: #f5efe6; border: 1px solid #d6d0c6; }
  .ghost:hover { background: #efe9de; color: #2a2420; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .list-item { display: block; padding: 12px; border-radius: 3px; border: 1px solid #e0d9ce; text-decoration: none; color: inherit; background: #000; }
  .list-item .title { font-weight: 600; color: #f5efe6; }
  .list-item .meta { font-size: 12px; color: #6a6056; }
  .list-item .status { font-size: 12px; text-transform: lowercase; letter-spacing: 0.08em; }
  .list-item .snippet { font-size: 12px; color: #8a7f74; margin-top: 4px; }
  .meta-row { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #6a6056; }
  .toolbar { background: #000; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
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
  .run-item { text-align: left; padding: 10px; border-radius: 3px; border: 1px solid #e0d9ce; background: #000; color: #f5efe6; }
  .run-item .meta { font-size: 11px; color: #6a6056; }
  .runs-header, .threads-header, .section-header { color: #f5efe6; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .thread-meta { color: #f5efe6; margin-bottom: 8px; }
  .thread-card { position: relative; display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
  .thread-menu-wrap { position: relative; margin-left: auto; }
  .thread-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .thread-date { font-size: 12px; color: #b7a48a; text-transform: lowercase; }
  .menu-button { background: #000; border: 1px solid #6a6056; color: #f5efe6; padding: 4px 8px; border-radius: 6px; font-size: 14px; line-height: 1; }
  .menu-button:hover { background: #111; color: #f5efe6; }
  .thread-menu { position: absolute; top: 30px; right: 0; background: #000; border: 1px solid #6a6056; border-radius: 6px; padding: 6px; display: none; flex-direction: column; gap: 6px; z-index: 5; min-width: 180px; }
  .thread-menu.open { display: flex; }
  .menu-item { background: #000; color: #f5efe6; border: 1px solid transparent; text-align: left; padding: 6px 8px; border-radius: 4px; font-size: 12px; width: 100%; }
  .menu-item:hover { border-color: #e4a05b; color: #e4a05b; }
  .thread-title { font-weight: 600; color: #e4a05b; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  .thread-snippet { font-size: 12px; color: #f5efe6; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; border: 1px solid #6a6056; color: #e4a05b; }
  .helper { margin: 8px 0; color: #f5efe6; }
  .helper-text { font-size: 12px; color: #cfc6bb; }
  .toggle { margin-bottom: 0; margin-right: 1rem; font-size: .8rem; color: #f5efe6; display: flex; align-items: center; gap: 6px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
  .modal { background: #000; border: 1px solid #e0d9ce; border-radius: 6px; padding: 16px; width: min(520px, 100%); max-height: 80vh; overflow: auto; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; color: #f5efe6; }
  .modal-controls { margin-bottom: 12px; color: #f5efe6; }
  @media (max-width: 720px) { .input-row { grid-template-columns: 1fr; } }
`;

document.head.appendChild(style);
route();

