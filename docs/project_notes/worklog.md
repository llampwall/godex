# Worklog

### 2026-01-26 - Global workspace thread filtering
- **Outcome:** `/threads?workspace_id=__global__` now returns only unattached threads by filtering on empty `attached_workspace_ids`.
- **Why:** Keep the "Unlinked Threads" workspace aligned with server-side filtering without affecting real workspace queries.
- **Links:** commit `dc5276ee38efe94b40740733612fc0357283209a`

### 2026-01-26 - Workspace detail global workspace polish
- **Outcome:** Workspace detail always sends `workspace_id` (including `__global__`), global workspace help text mentions linking, the label reads "Unlinked Threads", and mobile layout uses safer width/overflow utilities.
- **Why:** Keep global workspace filtering consistent and prevent mobile overflow regressions while clarifying what unlinked threads represent.
- **Links:** commit `70e50888bdb6bf7ab1c423877419585b5e328cb8`

### 2026-01-26 - Workspace switcher menu ordering
- **Outcome:** Workspace switcher now hides the `__global__` entry, orders menu items as Workspaces → All Workspaces → Unlinked Threads → New Repo, and highlights Unlinked Threads when selected.
- **Why:** Keep the workspace switcher focused on user-relevant options and make the unlinked threads state more obvious.
- **Links:** commit `5d6a90652c32e101aaa17eea1e03698828d8382c`

### 2026-01-25 - Threads list response + global workspace
- **Outcome:** Threads list now reads the server `data` wrapper, supports `/threads?workspace_id=...`, and adds a synthetic "All Threads" workspace for orphaned threads with actions/messaging disabled.
- **Why:** Keep UI in sync with the server response shape and surface unassigned threads safely.
- **Links:** commit `8363563605748ee1f10f60f9aa454365cfa6f82e`

### 2026-01-25 - Workspace list loading states
- **Outcome:** Workspace list shows explicit loading states while data fetches.
- **Why:** Make list behavior clearer on slower connections and avoid empty-state confusion.
- **Links:** commit `15384b8448827d59a6bd2e990e346f4b75b5c0a5`

### 2026-01-25 - Mobile responsive utilities in UI pages
- **Outcome:** Header, thread detail, and workspace detail views use updated responsive utility classes for better mobile layout behavior.
- **Why:** Improve phone usability by tightening layout and spacing for small screens.
- **Links:** commit `1cda25ccba612b2c4005d8f9d03f7249c795a776`

### 2026-01-25 - Offline banner for network status
- **Outcome:** UI now shows an offline/server-unreachable banner when the network status indicates the server is down.
- **Why:** Make connectivity issues obvious so users can distinguish offline states from app errors.
- **Links:** commit `20b9481bde80f4497fad3ed34f95e237ac2b737e`

### 2026-01-25 - Share draft page for shared content
- **Outcome:** UI now has a dedicated ShareDraftPage to capture shared text/URLs and route them into the draft flow.
- **Why:** Ensure share-intent payloads land in the UI with a purpose-built entry point for users coming from the OS share sheet.
- **Links:** commit `2c59303b7ad979f2db3de78c8ef0ddbec2bbb5a2`

### 2026-01-25 - Workspace detail SSE messaging
- **Outcome:** Workspace detail now sends messages with the shared MessageInput, creates a default thread if missing, and streams replies via SSE.
- **Why:** Make the workspace detail page usable for sending prompts and seeing live responses without leaving the workspace view.
- **Links:** commit `bfc013b120c773bd839ce559e3667a7b32bbabd7`

### 2026-01-25 - Workspace detail thread navigation
- **Outcome:** Linked threads on the workspace detail page now navigate directly to the thread detail view.
- **Why:** Allow faster drill-down from a workspace overview into a specific thread.
- **Links:** commit `cdd8d48c96f7641c0c3a9df2dcd809b7542e1053`

### 2026-01-25 - Thread detail route wiring
- **Outcome:** Thread detail view is reachable via the `/t/:threadId` route in the UI.
- **Why:** Enable direct navigation to a specific thread detail page.
- **Links:** commit `8cdc4346e9b204a4e3ae9451b78d79e2531e0000`

### 2026-01-25 - Shared MessageInput component with dictation
- **Outcome:** UI now has a reusable `MessageInput` component that includes dictation support for composing messages.
- **Why:** Standardize the message composer behavior across UI surfaces and keep dictation support consistent.
- **Links:** commit `779fa947296b6ffa2280a95968de3a4cd2186f22`

### 2026-01-25 - Workspace detail UI quick actions + linked threads
- **Outcome:** Workspace detail page now includes quick actions (git status/diff/tests), a main output area with message input, and a linked threads list powered by `/threads?workspace_id=...`.
- **Why:** Provide an actionable workspace home view and surface linked threads at a glance.
- **Links:** commit `0a77c803678ba0bca3ea10cdd1b67f9723559559`

### 2026-01-25 - Workspace API response shape handling
- **Outcome:** UI workspace context now supports the `/workspaces` response wrapper `{ ok, workspaces: [...] }` instead of assuming a bare array.
- **Why:** Keep workspace list and detail views aligned with the server response format.
- **Links:** commit `3fd070dfc259b50ee6c7ec6e5996e304bd0b9bfc`

### 2026-01-25 - App shell header components
- **Outcome:** UI now includes app shell header components for the main layout (header, actions menu, workspace switcher).
- **Why:** Establish the top-level navigation and controls for upcoming layout and workflow work.
- **Links:** commit `7193b6e1e4d4929497f375be4dbf7524daaadf03`

### 2026-01-25 - UI auth context
- **Outcome:** UI now has an auth context that captures `?token=` into localStorage and exposes authenticated state to consumers.
- **Why:** Centralize token handling and make auth state available to UI components.
- **Links:** commit `c0192310863a61469ce4880e328f59fbb1943be6`

### 2026-01-25 - Core shadcn/ui components
- **Outcome:** UI now has baseline shadcn/ui components (button, dialog, dropdown menu, input, scroll area).
- **Why:** Establish reusable UI primitives for upcoming interface work.
- **Links:** commit `f49189ccc6a6b2000ebba410664c1abb8e22b32c`

### 2026-01-25 - React entry point wiring
- **Outcome:** UI entry point now uses a React `main.tsx` entry with updated `index.html` wiring.
- **Why:** Align the UI bootstrapping with React conventions for upcoming component work.
- **Links:** commit `c49f33cbab533a5cbd968b23e9519325a8be498a`

### 2026-01-25 - UI React + shadcn dependencies
- **Outcome:** `apps/ui` now includes React/ReactDOM plus shadcn stack dependencies (Radix UI, CVA, Tailwind utilities).
- **Why:** Establish the UI component stack for upcoming shadcn-based work.
- **Links:** commit `22e9fa5ef2b73189c2f4462f7c2f30dce8670ea1`

### 2026-01-25 - Thread working state indicator
- **Outcome:** Thread view shows a working spinner/status during streaming replies.
- **Why:** Provide clear feedback while replies stream.
- **Links:** commit `f7cd88b5f89d6abeebd748383c85e69305fd00c8`

### 2026-01-25 - Thread streaming cleanup + refresh controls
- **Outcome:** Thread view aggregates SSE deltas to hide raw event tags, adds manual/auto refresh with no-store fetch, and README now documents PM2 stop/start/restart plus `/diag/restart`; unused `.godex/restart-run.cmd` removed.
- **Why:** Keep live thread output readable and make restart workflows clearer.
- **Links:** commit `e26f717e85c00bdee60bbc1cc8a4aab4bb3d7906`

### 2026-01-25 - Threads UI restart controls + PM2 config
- **Outcome:** Threads transcripts render more clearly, UI exposes restart controls with update toasts, and a PM2 ecosystem config was added for Windows ops.
- **Why:** Make thread context easier to scan and provide a reliable restart path for local/PM2 workflows.
- **Links:** commit `6b7c83b96dfb6e74603aa02ce3bddfb49a53eda9`

### 2026-01-25 - Reliable PM2 restart flow
- **Outcome:** Server restart uses `/diag/restart` with resolved pnpm/pm2 paths, shell execution, and logs to `.godex/restart.log`; Windows PM2 start helpers added.
- **Why:** Make the restart button reliable under PM2 on Windows for local ops.
- **Links:** commit `84183cba90f72ed6aef8f1099fd97cfefe1193b0`, bug entry `docs/project_notes/bugs.md`

### 2026-01-24 - Bootstrap command reliability
- **Outcome:** Bootstrap now supports `STRAP_BIN` overrides and spawns `.cmd`/`.bat` with Windows shell when needed.
- **Why:** Make repo bootstrap work reliably when strap is installed via a Windows shim.
- **Links:** commit `60d96b8f33e83ef02093d8b940c570625a0f163c`, bug entry `docs/project_notes/bugs.md`

### 2026-01-24 - Repo bootstrap flow
- **Outcome:** UI exposes a bootstrap modal and the server provides `/workspaces/bootstrap` to scaffold new repos (template/auto) and return workspace metadata.
- **Why:** Create new repos from the phone UI and register them as workspaces without manual setup.
- **Links:** commit `70736853291269942c060b3c578b27f4dd8580a3`

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
