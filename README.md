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

## API requirements

- Auth: `Authorization: Bearer <CODEX_RELAY_TOKEN>` on every request.
- SSE: `/runs/:id/stream` accepts `?token=<CODEX_RELAY_TOKEN>` (EventSource cannot send headers).

## Threads (Codex app-server)

The Threads tab connects to the local `codex app-server` process to list and continue existing Codex threads.

- Sessions: repo-backed runs (codex exec / git / tests).
- Threads: existing Codex threads exposed by `codex app-server`.

Notes:
- The server spawns `codex app-server` automatically (requires `codex` on PATH).
- Optional: set `CODEX_BIN` to override the binary used for spawning codex.
- Optional: set `GODEX_APP_SERVER_CWD` to control the app-server working directory.
- Thread detail view: `/ui/t/:thread_id`.

Diagnostics:
- `GET /diag/codex` shows the spawn config and `codex --version` output.
- `pnpm smoke` calls `/diag/codex` and fails if codex cannot execute.

## Optional notifications

Set both `NTFY_URL` and `NTFY_TOPIC` to send a short notification when a run ends in `failed` or `needs_input`.

```
NTFY_URL=https://ntfy.sh
NTFY_TOPIC=godex
```
