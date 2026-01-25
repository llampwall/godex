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

### Memory Files (non-overlapping)

- **operating_brief.md** — Entry point: what this project is, goals, current state, hazards, and next steps. Read this first when starting a fresh chat.
- **key_facts.md** — Lookupable truths: commands, ports, URLs, paths, env var *names*, deployment targets. Prefer documented facts over assumptions.
- **adrs.md** — **Constraints (ADRs)**: long-lived rules/invariants + rationale future changes must respect. If it doesn’t create a constraint, it doesn’t belong.
- **bugs.md** — Recurring/scary bugs: symptom → root cause → fix → prevention.
- **worklog.md** — **Checkpoints**: outcomes + local intent for completed work. May link ADRs/bugs/key facts; must not duplicate them.

### Memory-Aware Protocol

**Before proposing changes:**
- Read `docs/project_notes/operating_brief.md` first.
- Check `docs/project_notes/adrs.md` before proposing architectural or data-model changes.
- Check `docs/project_notes/key_facts.md` before asserting commands/ports/paths/URLs/env-var names.

**When encountering errors or bugs:**
- Search `docs/project_notes/bugs.md` first.
- If the issue was expensive/non-obvious or likely to recur, update `bugs.md` (symptom → root cause → fix → prevention).

**After completing meaningful work (ready to keep):**
- Verify the change (run relevant tests / quick sanity checks).
- If the user has approved the change (or you are confident it is correct and intended), commit the work using `$git-commit-helper`.
- Ownership:
- The main coding agent should **not** edit docs/project_notes/* directly.
- Only the post-commit maintainer edits those files (unless user explicitly requests manual edits).

**If work appears complete but is not yet approved:**
- Ask the user if they want to commit now.
- If approved, commit using `$git-commit-helper`.
- If not approved, leave changes uncommitted and do not update `docs/project_notes/*`.

**Notes update policy:**
- `docs/project_notes/*` is maintained automatically after meaningful commits.
- If no meaningful notes updates are needed, the maintainer will leave them unchanged.

### Anti-Redundancy Rules

- `worklog.md` must not duplicate ADR rationale, bug writeups, or key facts.
- If details belong elsewhere, link to `adrs.md`, `bugs.md`, or `key_facts.md`.
- `operating_brief.md` is curated (rewrite allowed). Keep it short.
- If no meaningful doc changes are needed, say `No project_notes updates needed for this change.`
