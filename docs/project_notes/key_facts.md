# Key Facts

## Quick start
- Install: `pnpm install`
- Configure env: create `.env` at repo root (see `README.md` for required vars)
- Dev: `pnpm dev`
- Test: `pnpm test`

## Local development
- Runtime: Node.js (pnpm workspace)
- Package manager: pnpm@9.12.3
- Env var names: `SERVER_HOST`, `SERVER_PORT`, `UI_HOST`, `UI_PORT`, `CODEX_RELAY_TOKEN`, `CODEX_FULL_ACCESS`, `NTFY_URL`, `NTFY_TOPIC`
- Default hosts: `SERVER_HOST=0.0.0.0`, `UI_HOST=0.0.0.0`
- Ports: server `SERVER_PORT` (default 6969), UI dev server `UI_PORT` (default 5174)
- Auth: API requires `Authorization: Bearer <CODEX_RELAY_TOKEN>`; SSE uses `?token=<CODEX_RELAY_TOKEN>`
- Common paths: `apps/server`, `apps/ui`, `packages`

## Deployment
- Build: `pnpm build`
- Start: `pnpm start` (builds then starts `apps/server`)

## External services
- Optional notifications: `NTFY_URL`, `NTFY_TOPIC` (uses ntfy.sh by default)

## Operational commands
- `pnpm build`
- `pnpm start`
- `pnpm typecheck`
- `pnpm test:server`
- `pnpm test:ui`

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
