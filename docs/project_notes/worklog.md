# Worklog

### 2026-01-23 - UI icons + ticker marquee
- **Outcome:** UI uses consistent inline SVG icons and the status ticker scrolls with vanilla-marquee plus controlled pause.
- **Why:** Improve readability with consistent iconography and make the top ticker behave like a real marquee.
- **Links:** commit `a29eaa4795ffbb53e2e3f256feeab78a65b913fe`

### 2026-01-23 - Thread rename flow + startup helpers
- **Outcome:** Threads can be renamed via a modal with title overrides shown in list/detail, Android dictation avoids repeated transcripts, and `start-godex.cmd`/`start-caddy.cmd` helpers exist.
- **Why:** Make thread lists easier to scan, reduce duplicate dictation input on Android, and simplify local startup.
- **Links:** commit `4d4d36f2242cd574a223622729a6b097a47959be`

### 2026-01-23 - PWA install, share drafts, and dictation
- **Outcome:** UI is installable as a PWA with offline banner/toasts, supports share-to-godex drafts at `/ui/share`, and adds mic-driven dictation on message inputs.
- **Why:** Enable installable offline-capable UI on Android and faster prompt entry via share + voice.
- **Links:** commit `0eee4a68f49c9d05466f05c26c2d254a7771fe2b`

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
