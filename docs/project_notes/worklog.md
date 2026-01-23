# Worklog

### 2026-01-23 - Workspaces model + thread attachments
- **Outcome:** Server stores workspace profiles, exposes workspace routes/actions, and threads carry local metadata plus workspace attachments in the UI.
- **Why:** Separate repo profiles from conversations, allow per-workspace defaults, and support thread attachments in the interface.
- **Links:** commit `4ee6ca7a9fee8b39f92e835fbc9d55c2a1542b73`

### 2026-01-23 - Codex app-server threads bridge
- **Outcome:** Server spawns `codex app-server`, exposes thread routes, and UI ships a Threads tab with diagnostics + smoke check.
- **Why:** Surface existing Codex threads in the phone UI and make app-server spawning easier to diagnose.
- **Links:** commit `e5f4b2b530400d96b93b4999f29437624ec2c881`

### 2026-01-23 - SSE replay toggle + local store tracked
- **Outcome:** Runs SSE stream can skip replay with `replay=0`, post-commit prompts are passed via a temp stdin file, and `.godex` store files are committed.
- **Why:** Prevent duplicate output when UI opts out of replay and capture local store state per request.
- **Links:** commit `6bc34a098236ce3b18739d1f9b9359f56e13af02`

### 2026-01-23 - Session notification modes + UI control
- **Outcome:** Sessions now track notification preferences, ntfy messages are gated by per-session mode, and the UI exposes the notify control plus improved run/output handling.
- **Why:** Allow per-session notification preferences, reduce false needs-input alerts, and tighten UI flow for status/output.
- **Links:** commit `1f8b78e9a4c640922ed45ee19acf02ea5604a1cc`
