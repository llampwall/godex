# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

- Install: `pnpm install`
- Dev (both apps): `pnpm dev`
- Build: `pnpm build`
- Test all: `pnpm test`
- Test server only: `pnpm test:server`
- Test single file: `cd apps/server && pnpm vitest run test/<filename>.test.ts`
- Typecheck: `pnpm typecheck`
- Smoke test: `pnpm smoke`

## Running the Server (PM2)

PM2 is the standard way to run the server (enables UI restart button, reliable restarts).

**Initial setup:**
```
pnpm build
pm2 start "P:\software\godex\apps\server\dist\index.js" --name godex --cwd "P:\software\godex\apps\server"
pm2 save
```

**Daily operations:**
- Stop: `pm2 stop godex`
- Start: `pm2 start godex`
- Restart: `pm2 restart godex`
- Logs: `pm2 logs godex`

**Caddy (required for phone access):**
Run `start-caddy.cmd` in a separate terminal for HTTPS reverse proxy. Without Caddy, secure connections from the phone won't work.

## Architecture

pnpm monorepo with three packages:
- `apps/server` — Fastify API server + SSE streams, serves built UI at `/ui`
- `apps/ui` — Vite SPA (PWA-enabled), uses Vite dev server during development
- `packages/shared` — shared TypeScript types

Key concepts:
- **Workspaces**: repo profiles (not conversations) with fields like `repo_path`, `notify_policy`, `test_command_override`
- **Threads**: Codex app-server conversations; server spawns `codex app-server` to proxy thread operations
- **Runs**: execution sessions with SSE streaming at `/runs/:id/stream`

Data flow: UI → Server API (auth via `Authorization: Bearer <CODEX_RELAY_TOKEN>`) → Codex app-server

## Windows Caveats

- Prefer `pwsh -File <script>.ps1` over spawning `.cmd`/`.bat`; otherwise use `shell: true` for spawn calls
- PM2 restart helpers: use `scripts/godex-pm2-start.ps1` or `ecosystem.config.cjs`

## Project Memory System

Institutional knowledge is maintained in `docs/project_notes/` (updated automatically by post-commit maintainer).

### Memory Files

- **operating_brief.md** — Entry point: what this project is, goals, current state, hazards
- **key_facts.md** — Commands, ports, URLs, paths, env var names
- **adrs.md** — Long-lived constraints + rationale
- **bugs.md** — Recurring bugs: symptom → root cause → fix → prevention
- **worklog.md** — Work checkpoints (outcomes + intent)

### Protocol

**Before proposing changes:**
- Read `docs/project_notes/operating_brief.md` first
- Check `adrs.md` before architectural or data-model changes
- Check `key_facts.md` before asserting commands/ports/paths/env-var names

**When encountering bugs:**
- Search `bugs.md` first
- If expensive/non-obvious, update bugs.md with symptom → root cause → fix → prevention

**After completing work:**
- The main coding agent should NOT edit `docs/project_notes/*` directly
- Only the post-commit maintainer edits those files (unless user explicitly requests)
