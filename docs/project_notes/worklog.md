# Worklog

### 2026-01-23 - SSE replay toggle + local store tracked
- **Outcome:** Runs SSE stream can skip replay with `replay=0`, post-commit prompts are passed via a temp stdin file, and `.godex` store files are committed.
- **Why:** Prevent duplicate output when UI opts out of replay and capture local store state per request.
- **Links:** commit `6bc34a098236ce3b18739d1f9b9359f56e13af02`

### 2026-01-23 - Session notification modes + UI control
- **Outcome:** Sessions now track notification preferences, ntfy messages are gated by per-session mode, and the UI exposes the notify control plus improved run/output handling.
- **Why:** Allow per-session notification preferences, reduce false needs-input alerts, and tighten UI flow for status/output.
- **Links:** commit `1f8b78e9a4c640922ed45ee19acf02ea5604a1cc`
