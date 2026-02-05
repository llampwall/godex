# Constraints

## Infrastructure
- **Server port**: Default 6969 (dev) or 7777 (prod); configurable via `SERVER_PORT` in `.env`
- **UI dev server**: Port 5174 during development
- **PM2 process name**: Must be `godex` for restart endpoint to work (`/diag/restart` calls `pm2 restart godex`)
- **Caddy**: Required for HTTPS access from phone; run `start-caddy.cmd` in separate terminal
- **Auth**: All API calls require `Authorization: Bearer <CODEX_RELAY_TOKEN>`; SSE streams use `?token=` query param
- **Windows**: Prefer `pwsh -File <script>.ps1` over `.cmd`/`.bat`; use `shell: true` for spawn calls
- **PWA**: Service worker registration at `/registerSW.js` must be served as JavaScript, not HTML (added to rootFiles list 2026-01-26)

## Rules
- **Global workspace filtering**: When `workspace_id=__global__`, server returns only threads with `attached_workspace_ids.length === 0`
- **PM2 restart**: Use direct process name (`godex`) in ecosystem config; avoid script-based approach for production
- **Mobile-first**: UI must support mobile/phone usage as primary interface
- **SSE reconnection**: UI must handle SSE disconnects gracefully and reconnect automatically
- **Thread-workspace linking**: Threads can be linked to multiple workspaces; use `attached_workspace_ids` array

## Key Facts
- **Repository structure**: pnpm monorepo with `apps/server`, `apps/ui`, `packages/shared`
- **Build system**: Vite for UI, TypeScript for server
- **Primary use case**: Codex CLI access from phone via Tailscale
- **Data storage**: SQLite database at `.godex/godex.sqlite`
- **Codex integration**: Server spawns `codex app-server` to proxy thread operations

## Hazards
- **registerSW.js**: Must be in rootFiles list or HTML gets served instead of JavaScript, breaking service worker (fixed 2026-01-26)
- **URL routing loops**: Bidirectional URL/state sync causes infinite updates; use one-way routing only (fixed 2026-01-26)
- **Thread data structure**: Server returns `{ data: [...] }`, not `{ threads: [...] }` - UI must use correct field name
- **PM2 process name mismatch**: Restart endpoint fails if PM2 process name doesn't match hardcoded value in `/diag/restart`

## Superseded
(None yet)
