# Key Facts

## Quick start
- Install: `pnpm install`
- Configure env: create `.env` at repo root (see `README.md` for required vars)
- Dev: `pnpm dev`
- Test: `pnpm test`

## Local development
- Runtime: Node.js (pnpm workspace)
- Package manager: pnpm@9.12.3
- Env var names: `SERVER_HOST`, `SERVER_PORT`, `UI_HOST`, `UI_PORT`, `CODEX_RELAY_TOKEN`, `CODEX_FULL_ACCESS`, `CODEX_BIN`, `GODEX_APP_SERVER_CWD`, `GODEX_DEFAULT_REPO_ROOT`, `STRAP_BIN`, `NTFY_URL`, `NTFY_TOPIC`
- Default hosts: `SERVER_HOST=0.0.0.0`, `UI_HOST=0.0.0.0`
- Ports: server `SERVER_PORT` (default 6969), UI dev server `UI_PORT` (default 5174)
- Auth: API requires `Authorization: Bearer <CODEX_RELAY_TOKEN>`; SSE uses `?token=<CODEX_RELAY_TOKEN>`
- UI token storage: `?token=` is stored in localStorage as `godex_token` and removed from the URL.
- Runs SSE stream: `/runs/:id/stream` accepts `replay=0` to skip replaying recent events
- Common paths: `apps/server`, `apps/ui`, `packages`

## Notifications
- Session notify modes: `off`, `needs_input_failed`, `all` (default `needs_input_failed`)
- Update notify mode: `PATCH /sessions/:id` with JSON `{ "notify_mode": "<mode>" }`

## Data storage
- Local store files live in `.godex/`: `data.json` and `godex.sqlite`
- Restart logs: `.godex/restart.log` (diag restart)

## Deployment
- Build: `pnpm build`
- Start: `pnpm start` (builds then starts `apps/server`)

## PWA + share + dictation
- PWA install: open `/ui` in Chrome (Android) and use the "Install app" browser menu.
- Offline behavior: UI shell loads from cache and shows an offline/server-unreachable banner if the server is down.
- Share sheet route: `/ui/share` ingests shared text/URLs and stores drafts in localStorage until sent/cleared.
- Dictation: mic button on message inputs (Chrome only; requires mic permission).
- HTTPS dev helper: `caddy run --config P:\software\caddy\Caddyfile`
- Caddy SSE headers: add no-buffer headers for `/runs/*/stream` (`Cache-Control: no-cache`, `X-Accel-Buffering: no`).
- Token requirement: PWA/share flows still need `CODEX_RELAY_TOKEN` in localStorage (open UI once with `?token=...`).

## Threads + diagnostics
- Threads UI uses `codex app-server` (spawned by the server); requires `codex` on PATH or `CODEX_BIN` set.
- Thread detail route: `/ui/t/:thread_id`
- Diagnostics: `GET /diag/codex` returns spawn config + `codex --version`
- Diagnostics: `POST /diag/restart` runs build + server restart and logs to `.godex/restart.log`
- Smoke check: `pnpm smoke` (calls `/diag/codex`)

## Workspaces
- Workspaces are repo profiles with fields: `title`, `repo_path`, `notify_policy`, `default_thread_id`, `test_command_override`.
- Workspaces API: `GET/POST /workspaces`, `GET/PATCH/DELETE /workspaces/:id`.
- Workspace actions: attach threads (`POST /workspaces/:id/threads`), git status/diff (`POST /workspaces/:id/git/status`, `/git/diff`), tests (`POST /workspaces/:id/test`), and utility actions (`POST /workspaces/:id/open-folder`, `/open-code`, `/runs/clear`).

## Repo bootstrap
- Requires `strap` on PATH.
- Default repo root env: `GODEX_DEFAULT_REPO_ROOT`.
- Override strap command: `STRAP_BIN` (supports full path or `.cmd`/`.bat` on Windows).
- Endpoint: `POST /workspaces/bootstrap`.
- Templates: `mono`, `service`, `web`, `python`, `blank`, `auto` (auto can use a description to request suggestions).

## External services
- Optional notifications: `NTFY_URL`, `NTFY_TOPIC` (uses ntfy.sh by default)

## Operational commands
- `pnpm build`
- `pnpm start`
- `pnpm smoke`
- `pnpm typecheck`
- `pnpm test:server`
- `pnpm test:ui`
- `pm2 start "P:\software\godex\apps\server\dist\index.js" --name godex --cwd "P:\software\godex\apps\server"`
- `pm2 stop godex`
- `pm2 start godex`
- `pm2 restart godex`
- `start-godex.cmd` (builds then starts the server)
- `start-caddy.cmd` (runs Caddy with `P:\software\caddy\Caddyfile`)
- `scripts/godex-pm2-start.ps1` (PM2 start helper for Windows)
- `scripts/godex-pm2-start.cmd` (PM2 start helper for Windows)
- `ecosystem.config.cjs` (PM2 config for running `godex` via the Windows helper)

## Repo map
- `.`: pnpm workspace root.
- `apps/`: application packages.
- `packages/`: shared packages.
- `scripts/`: automation scripts.
- `tools/`: tooling.

## Deprecations / gotchas
- UI requires a token: `http://<host>:<ui_port>/ui?token=<CODEX_RELAY_TOKEN>` (add `serverPort=<port>` if server port differs).
- Built UI is served by the server at `http://<host>:<server_port>/ui?token=<CODEX_RELAY_TOKEN>` when assets exist.

## Linkouts
- Operating brief: `docs/project_notes/operating_brief.md`
- ADR constraints: `docs/project_notes/adrs.md`
- Bug playbook: `docs/project_notes/bugs.md`
- Work checkpoints: `docs/project_notes/worklog.md`
