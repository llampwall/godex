# UI Rewrite Design

Replace the current vanilla TypeScript UI with a React + shadcn/ui implementation based on v0 mockups.

## Background

The current UI is functional but getting in the way of adding features. Two key views have been mocked up with v0/shadcn (new-repo-modal, workspace-main-page) and the rest can be extrapolated from that design language.

## Tech Stack

- React 18 + Vite (replacing vanilla TS)
- shadcn/ui components
- Tailwind CSS
- lucide-react icons
- TypeScript throughout
- react-router-dom for routing

## Package Structure

```
apps/ui/src/
  components/
    ui/           # shadcn primitives (button, input, dropdown, etc.)
    layout/       # AppShell, Header, WorkspaceSwitcher
    workspace/    # WorkspaceList, WorkspaceDetail, NewRepoModal
    thread/       # ThreadDetail, ThreadCard, MessageInput
    share/        # ShareDraft page
  hooks/          # useWorkspace, useThread, useApi, useDictation
  lib/            # utils, api client, localStorage helpers
  pages/          # route components
  App.tsx
  main.tsx
```

## Navigation Model

### Entry Flow

1. App loads → check localStorage for `lastWorkspaceId` + `lastVisitedAt`
2. If exists and recent (< 24 hours) → load that workspace directly
3. Otherwise → show workspace list

### App Shell

```
┌─────────────────────────────────────┐
│ Header                              │
│ ┌─────────────┐  ┌───┐  ┌───┐      │
│ │ Workspace ▼ │  │🔔▼│  │⋮  │      │
│ └─────────────┘  └───┘  └───┘      │
├─────────────────────────────────────┤
│                                     │
│ Main Content Area                   │
│ (workspace detail, thread, etc.)    │
│                                     │
└─────────────────────────────────────┘
```

### Header Components

- **Workspace selector** (left): Current workspace path, click to open dropdown with all workspaces + "+ New repo" at bottom. Pure list — no other items mixed in.
- **Notification dropdown** (right): Bell icon with mode selector (never / input-needed / all)
- **Actions menu** (right): Kebab menu with workspace actions (Open folder, Open in VS Code, Open default thread) and global actions (Restart server, Delete workspace)

When on workspace list view, header shows app name instead of workspace path.

## Views

### 1. Workspace List

Landing page when no recent workspace selected.

- Grid or list of workspace cards
- Each card: repo name, path, last activity indicator
- Click → navigate to workspace detail
- Header shows app name, actions menu has global items only

### 2. Workspace Detail

Primary view (mocked as "repo-main-page").

- **Main Thread section**: Terminal-style output, message input with mic + send
- **Quick action buttons**: git status, git diff, run tests (expandable later — this is the killer feature)
- **Linked Threads section**: Scrollable list of thread cards (title, date, preview)
- **"+ Link new thread" button** at bottom

### 3. Thread Detail

Conversation view for a specific thread.

- Full message history with streaming support
- Message input at bottom with mic + send
- Back navigation to workspace detail
- Thread-specific actions in header menu (archive, set as default, etc.)

### 4. New Repo Modal

Triggered from workspace switcher dropdown.

- Two tabs: "Choose template" / "Describe your project"
- Template cards with icons and descriptions
- Name + optional path inputs
- Create button

### 5. Share Draft

Route: `/ui/share`

- Simple form showing incoming shared text/URL
- Workspace selector dropdown
- Send or discard buttons

## Data Flow

### API Client

Centralized fetch wrapper (`lib/api.ts`):
- Auth header: `Authorization: Bearer <token>`
- Token stored in localStorage, set via `?token=` query param on first load
- Base URL from current host or `serverPort` query param

### Key API Calls

- `GET /workspaces` → workspace list
- `GET /workspaces/:id` → workspace detail
- `POST /workspaces` → create workspace
- `PATCH /workspaces/:id` → update notify policy, default thread, etc.
- `POST /workspaces/:id/git/status` → git status
- `POST /workspaces/:id/git/diff` → git diff
- `POST /workspaces/:id/test` → run tests
- `GET /threads` → threads list (filtered by workspace)
- `POST /threads/:id/message` → send message
- `GET /runs/:id/stream?token=` → SSE for run output

### State Management

- React context for current workspace + auth token
- Local component state for UI (modals, inputs)
- No Redux/Zustand — app is simple enough

### SSE Streaming

- EventSource for `/runs/:id/stream` with token in query string
- Accumulate deltas into message content

## Implementation Phases

### Phase 1 — Foundation

- Set up React + Vite (replace vanilla TS entry point)
- Port shadcn/ui components from mockups (`components/ui/`)
- Build app shell: Header, WorkspaceSwitcher, actions menu
- Set up routing (react-router-dom)
- API client + auth context

### Phase 2 — Core Views

- Workspace List page
- Workspace Detail page (port from mockup)
- New Repo Modal (port from mockup)

### Phase 3 — Threads

- Thread Detail page with message history
- SSE streaming integration
- Message input with dictation

### Phase 4 — Polish

- Share Draft page
- PWA manifest + service worker (port existing)
- Offline banner
- Final responsive tweaks

## Migration Notes

**Deleted:** All current vanilla TS UI code in `apps/ui/src/`

**Unchanged:**
- `apps/server` — no changes
- API contracts — no changes
- `.env` config — no changes

## Reference Mockups

Located in `apps/ui/public/`:
- `new-repo-modal/` — New repo creation modal
- `repo-main-page/` — Workspace detail view

Before/after comparisons:
- `new-repo-modal-before.jpg` vs `new-repo-modal/new-repo-modal-after.png`
- `repo-main-page/workspace-main-page-before.jpg` vs `repo-main-page/workspace-main-page-after.jpg`
