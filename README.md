# godex

Use Codex CLI on a Windows host from your phone (via Tailscale) with a minimal web UI.

## Setup

1) Install dependencies

```
pnpm install
```

2) Create `.env` at repo root

```
SERVER_HOST=0.0.0.0
SERVER_PORT=6969

UI_HOST=0.0.0.0
UI_PORT=5174

CODEX_RELAY_TOKEN=change-me
```

Notes:
- For a single-port entrypoint later, set `SERVER_PORT=7777` and use that in your phone URL.
- `CODEX_RELAY_TOKEN` is required for every API call and SSE stream.

## Dev

Run both apps (server + UI dev server):

```
pnpm dev
```

Open UI:

```
http://central-command:5174/ui?token=YOUR_TOKEN
```

If you changed server port, add `serverPort=7777`:

```
http://central-command:5174/ui?token=YOUR_TOKEN&serverPort=7777
```

## Build + Start

```
pnpm build
pnpm start
```

If the UI has been built, the server will serve it at:

```
http://central-command:SERVER_PORT/ui?token=YOUR_TOKEN
```

If UI assets are not built, use the Vite dev server as described above.

## PWA + dictation + share

- Install: open the UI in Chrome (Android) and use the browser menu "Install app".
- Offline: the UI shell loads from cache and shows an "Offline / Server unreachable" banner when the server is down.
- Dictation: tap the mic button next to message inputs (Chrome only; requires mic permission).
- Share sheet: from Android, Share text or a URL to "godex" to create a draft message.

Notes:
- Start the backend before using the UI: run `pnpm start`.
- If using HTTPS via Caddy, run `caddy run --config P:\software\caddy\Caddyfile` in a separate terminal.
- The app still needs a valid token in localStorage. If you have not set one, open the UI once with `?token=...` first.
- Share drafts are stored locally and survive refresh until sent or cleared.

## Concepts

- **Workspaces**: repo profiles (not conversations). Fields include `title`, `repo_path`, `notify_policy`, `default_thread_id`, and `test_command_override`.
- **Threads**: Codex app-server conversations. We store local metadata (title override, pinned, archived) and attachments to workspaces.

## API requirements

- Auth: `Authorization: Bearer <CODEX_RELAY_TOKEN>` on every request.
- SSE: `/runs/:id/stream` accepts `?token=<CODEX_RELAY_TOKEN>` (EventSource cannot send headers).

## Workspaces API

- `GET /workspaces`
- `POST /workspaces` `{ repo_path, title? }`
- `GET /workspaces/:id`
- `PATCH /workspaces/:id` `{ title?, notify_policy?, default_thread_id?, test_command_override? }`
- `DELETE /workspaces/:id`
- `POST /workspaces/:id/threads` `{ thread_id }`
- `DELETE /workspaces/:id/threads/:thread_id`
- `POST /workspaces/:id/git/status`
- `POST /workspaces/:id/git/diff`
- `POST /workspaces/:id/test`
- `POST /workspaces/:id/runs/clear`
- `POST /workspaces/:id/open-folder`
- `POST /workspaces/:id/open-code`

## Threads (Codex app-server)

- `GET /threads` (merged list: remote threads + local meta + attached workspace ids)
- `GET /threads/:thread_id`
- `POST /threads/:thread_id/message` `{ text, workspace_id? }`
- `POST /threads/create` (best-effort thread/create)
- `GET /threads/meta`
- `PATCH /threads/:thread_id/meta` `{ title_override?, pinned?, archived? }`

Notes:
- The server spawns `codex app-server` automatically (requires `codex` on PATH).
- Optional: set `CODEX_BIN` to override the binary used for spawning codex.
- Optional: set `GODEX_APP_SERVER_CWD` to control the app-server working directory.
- Thread detail view: `/ui/t/:thread_id`.

Diagnostics:
- `GET /diag/codex` shows the spawn config and `codex --version` output.
- `GET /health` includes workspace/thread counts and app-server state.
- `pnpm smoke` calls `/diag/codex` and fails if codex cannot execute.

## Optional notifications

Set both `NTFY_URL` and `NTFY_TOPIC` to send a short notification when a run ends in `failed` or `needs_input`.

```
NTFY_URL=https://ntfy.sh
NTFY_TOPIC=godex
```
