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

Institutional knowledge is maintained in `docs/memory/` (updated via `/update-memory` skill).

### Memory Files

- **STATE.md** — Current objective, active work, blockers, next actions, quick reference commands
- **CONSTRAINTS.md** — Infrastructure facts, rules, key facts, hazards (merge-only, never delete)
- **DECISIONS.md** — Dated decision log with evidence (commit hashes), bug fixes with symptom/root cause/fix/prevention

### Memory-Aware Protocol

**When opening a repo:**
- If STATE.md shows "ACTION REQUIRED" or bootstrap templates, offer to run `/update-memory`
- Read `docs/memory/STATE.md` first to understand current state and objectives

**Before proposing changes:**
- Check `docs/memory/CONSTRAINTS.md` for infrastructure requirements and architectural rules
- Verify commands/ports/paths against documented facts

**When encountering bugs:**
- Search `docs/memory/DECISIONS.md` for similar issues and their solutions
- Document expensive/recurring bugs in DECISIONS.md with full symptom/root cause/fix/prevention

**After completing work:**
- Run `/update-memory` to analyze commits and update memory files
- Memory files are maintained by the update-memory skill, not manually
