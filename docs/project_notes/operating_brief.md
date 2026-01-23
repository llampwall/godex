# Operating Brief

## One-liner
- Use Codex CLI on a Windows host from your phone (via Tailscale) with a minimal web UI.

## Goals
- Provide remote access to Codex CLI runs from a phone through a lightweight UI.
- Serve the UI via Vite dev server during development or from built assets via the server.

## Current state
- Working: pnpm workspace with `apps/server` and `apps/ui`, plus root scripts for dev/build/start.
- Working: server serves built UI at `/ui`; dev uses Vite UI on `UI_PORT` when assets are not built.
- Working: sessions persist `notify_mode`; server can send ntfy notifications and UI exposes per-session controls.

## Repo map
- `apps/server`: backend server for API + SSE, and optional static UI serving.
- `apps/ui`: web UI (Vite dev server in development).
- `packages/`: shared packages.
- `scripts/`: automation scripts.
- `tools/`: tooling.

## System map
- Components:
  - UI: browser client from `apps/ui` (Vite dev server or served by `apps/server`).
  - Server: API + SSE endpoints in `apps/server`.
- Data flow:
  1) UI loads with `?token=<CODEX_RELAY_TOKEN>` (and optional `serverPort`).
  2) UI calls server API with `Authorization: Bearer <CODEX_RELAY_TOKEN>`; SSE uses `?token=`.

## Active constraints
- None yet. (When you add one, reference ADR-### from `adrs.md`.)

## Known hazards
- `CODEX_RELAY_TOKEN` is required for API requests and SSE streams; missing/incorrect tokens break UI and API access.
- Setting `CODEX_FULL_ACCESS=1` allows full-access Codex runs; use only when explicitly needed.

## How to get oriented fast
- Start here: `README.md`
- Key facts: `docs/project_notes/key_facts.md`
- ADR constraints: `docs/project_notes/adrs.md`
- Work checkpoints: `docs/project_notes/worklog.md`
- Bug playbook: `docs/project_notes/bugs.md`
