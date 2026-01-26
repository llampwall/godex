# Operating Brief

## One-liner
- Use Codex CLI on a Windows host from your phone (via Tailscale) with a minimal web UI.

## Goals
- Provide remote access to Codex CLI runs from a phone through a lightweight UI.
- Serve the UI via Vite dev server during development or from built assets via the server.
- Clarify repo profiles (workspaces) vs conversational threads, with workspace defaults and attachments.

## Current state
- Working: pnpm workspace with `apps/server` and `apps/ui`, plus root scripts for dev/build/start.
- Working: server serves built UI at `/ui`; dev uses Vite UI on `UI_PORT` when assets are not built.
- Working: sessions persist `notify_mode`; server can send ntfy notifications and UI exposes per-session controls.
- Working: Threads UI bridges to `codex app-server` so existing Codex threads can be listed and resumed.
- Working: Threads list aligns to the server response shape, supports workspace filtering, and includes a synthetic "Unlinked Threads" workspace for orphaned threads (with message/actions disabled).
- Working: Workspaces are stored server-side as repo profiles; threads can be attached with local metadata (pinned/archived/title override).
- Working: New repo bootstrap flow in the UI plus `/workspaces/bootstrap` endpoint can scaffold repos (strap + optional auto template).
- Working: UI is installable as a PWA, shows an offline/server-unreachable banner, and serves PWA root assets from the server build output.
- Working: Threads streaming aggregates deltas to hide raw SSE tags, adds manual/auto refresh on thread detail, plus UI restart controls and service-worker update toasts.
- Working: Thread view shows a working spinner/status while streaming replies.
- Working: App shell header components are in place (header, actions menu, workspace switcher).
- Working: Workspace detail sends messages via the shared MessageInput and streams replies via SSE.
- Working: Share drafts flow at `/ui/share` saves incoming share text/URLs to localStorage before sending.
- Working: Dictation is available via mic controls on workspace/thread inputs (Chrome + mic permission).
- Working: Windows restart tooling includes a PM2 ecosystem config for `godex`.

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
  - Codex app-server: spawned by the server to fetch existing Codex threads.
- Data flow:
  1) UI loads with `?token=<CODEX_RELAY_TOKEN>` (and optional `serverPort`).
  2) UI calls server API with `Authorization: Bearer <CODEX_RELAY_TOKEN>`; SSE uses `?token=`.
  3) Threads UI calls server routes, which proxy to the local `codex app-server`.

## Active constraints
- None yet. (When you add one, reference ADR-### from `adrs.md`.)

## Known hazards
- `CODEX_RELAY_TOKEN` is required for API requests and SSE streams; missing/incorrect tokens break UI and API access.
- Setting `CODEX_FULL_ACCESS=1` allows full-access Codex runs; use only when explicitly needed.
- Threads require `codex` on PATH (or `CODEX_BIN` set) so the server can spawn `codex app-server`.
- PWA/share flows still require a valid token in localStorage (open UI once with `?token=...` to set it).

## How to get oriented fast
- Start here: `README.md`
- Key facts: `docs/project_notes/key_facts.md`
- ADR constraints: `docs/project_notes/adrs.md`
- Work checkpoints: `docs/project_notes/worklog.md`
- Bug playbook: `docs/project_notes/bugs.md`
