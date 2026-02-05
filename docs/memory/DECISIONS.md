# Decisions

## Recent (last 30 days)
- Completed major UI rewrite from vanilla JS to React 18 + Vite (Jan 26)
- Added global workspace (`__global__`) for unlinked threads (Jan 26)
- Implemented mobile-first thread header with collapsible search (Jan 26)
- Fixed PM2 restart endpoint to use direct process name (Jan 26)
- Added PWA support with offline detection and service worker (Jan 25)
- Created LinkWorkspaceDialog for managing thread-workspace associations (Jan 26)

## 2026-02

### 2026-02-05 — Godex folder move
**Why**: Repository moved to new location, needed to update paths and add infrastructure configs
**Impact**: New repo location at `P:\software\godex`; Caddy config for HTTPS reverse proxy; Repomix for codebase documentation
**Evidence**: 4626a2cf5cb639fb531aeb37e2635da69a94705c

## 2026-01

### 2026-01-26 — Fix restart button PM2 process name
**Symptom**: Restart button in UI failed to restart server
**Root cause**: PM2 process name in worktree was `godex-ui-rewrite`, but `/diag/restart` endpoint hardcoded `godex`
**Fix**: Change PM2 process name back to `godex` in ecosystem config; document both direct and script-based approaches in PM2_CONFIG.md
**Prevention**: Always use `godex` as PM2 process name; maintain fallback config as `ecosystem.config.direct.cjs`
**Evidence**: fcc54e2bbe713a3b88ef7af138203ffd6c9faa51

### 2026-01-26 — Fix mobile workspace view overflow
**Symptom**: Workspace names truncated or overflowing on mobile
**Root cause**: Missing responsive CSS classes for text truncation
**Fix**: Add `w-full`, `flex flex-col`, `min-w-0`, `truncate` classes to workspace detail page elements
**Prevention**: Always test mobile layouts with long text content
**Evidence**: c216b1614784defb7e9c88d34d712e77b3b98441

### 2026-01-26 — Complete UI rewrite (React + Vite)
**Why**: Vanilla JS UI was unmaintainable; needed modern stack for mobile-first PWA with better state management
**Impact**: Full UI rewrite with React 18, TypeScript, Vite, Radix UI components; WorkspaceContext and AuthContext for state management; SSE streaming with proper reconnection logic; mobile-optimized header and navigation; PWA support with service worker; voice dictation and share sheet integration; modern, maintainable UI with better mobile support and offline capabilities
**Evidence**: 353a36e988f4feecce91949a6f4b8cf2e9c2a65d

### 2026-01-26 — Fix TypeScript errors before merge
**Symptom**: Type errors in ThreadDetailPage and WorkspaceDetailPage
**Root cause**: Incorrect type assertions for Message union, unused imports
**Fix**: Add type assertion for Message union, remove unused imports/state
**Prevention**: Run `pnpm typecheck` before merging branches
**Evidence**: 0070135160d28a26cc326f7fffe9bdeb94f7af53

### 2026-01-26 — Prepare PM2 config for merge
**Why**: Main branch uses script-based PM2 config; feature branch used direct approach; needed to reconcile before merge
**Impact**: Restored ecosystem.config.cjs to main's script-based approach; added ecosystem.config.direct.cjs as alternative; PM2_CONFIG.md documents how to switch between approaches
**Evidence**: b2ee190902184199d3b04aae54f324562d77f2bb

### 2026-01-26 — Revert URL routing for workspaces
**Symptom**: Infinite loop when switching workspaces
**Root cause**: Bidirectional URL/state sync causing rapid updates
**Fix**: Remove URL routing entirely; workspace switching uses setCurrentWorkspace from context
**Prevention**: Avoid bidirectional sync between URL params and React state
**Evidence**: 0c29c5de990500b9b00587782f28fec54ce47536

### 2026-01-26 — Improve link workspace dialog
**Symptom**: Modal stayed open after linking, attached workspaces not displayed
**Root cause**: API response parsing looked in wrong path, no close handler, no display of linked workspaces
**Fix**: Fix API parsing for `attached_workspace_ids`, close modal after linking, show linked workspaces with unlink buttons
**Prevention**: Verify API response structure matches expected shape; always add close handler to modals after successful actions
**Evidence**: 991e58e228adf4a63d679a8155f8e4a5aac0660f

### 2026-01-26 — Make thread header mobile-first
**Why**: Mobile-first design required; desktop-only search bar didn't fit mobile screens
**Impact**: Removed search bar from header, moved to collapsible dropdown; search appears as collapsible input below header when activated; better mobile UX with right-aligned actions menu
**Evidence**: 12d03eb031e7395c7e20c3904f58f67d6f439a6c

### 2026-01-26 — Redesign thread header with search and actions
**Why**: Thread pages needed their own navigation; workspace header was unnecessary context switch
**Impact**: Removed workspace header from thread pages; added thread-specific header with back button, title, search, and actions menu (copy ID, link workspace, delete); thread pages now standalone without workspace chrome
**Evidence**: d4d343459df7334b8588ebaac5b2bebf1756dba5

### 2026-01-26 — Filter threads for global workspace
**Why**: Global workspace needed to show only unattached threads, not all threads
**Impact**: When `workspace_id=__global__`, server filters for `attached_workspace_ids.length === 0`; global workspace shows only threads not linked to any workspace
**Evidence**: dc5276ee38efe94b40740733612fc0357283209a

### 2026-01-26 — Fix registerSW.js serving
**Symptom**: Service worker registration failed with "Unexpected token <"
**Root cause**: HTML served instead of JavaScript for `/registerSW.js`
**Fix**: Add `registerSW.js` to rootFiles list in server.ts
**Prevention**: Always serve service worker files as JavaScript, never as HTML fallback
**Evidence**: f5450d00f5cdda73eedafa18ef7a3922fd3e63d4

### 2026-01-26 — Fix thread display data structure mismatch
**Symptom**: Threads not displaying in UI
**Root cause**: Server returns `{ data: [...] }`, UI expected `{ threads: [...] }`
**Fix**: Update Thread type, fix API parsing, use correct field names (`thread_id`, `summary`)
**Evidence**: 8363563605748ee1f10f60f9aa454365cfa6f82e
**Prevention**: Verify API response structure matches UI expectations

### 2026-01-25 — Add global workspace for unlinked threads
**Why**: Users needed a way to view orphaned threads that aren't linked to any workspace
**Impact**: Created synthetic "All Threads" workspace with `id=__global__`; hides quick actions and disables message input for global workspace; shows "Unlinked Threads" label; users can view/manage threads not linked to any workspace
**Evidence**: 8363563605748ee1f10f60f9aa454365cfa6f82e

### 2026-01-25 — Add offline detection with banner
**Why**: PWA needs offline mode detection to show user when server is unreachable
**Impact**: Implemented useOnline hook and OfflineBanner component; better UX when network/server unavailable
**Evidence**: 20b9481bde80f4497fad3ed34f95e237ac2b737e, ebe275b5345dfaddfafb8a36474fd4b7e0adcd3c

### 2026-01-25 — Update PWA manifest with complete metadata
**Why**: PWA needed complete metadata for proper installation and app-like experience
**Impact**: Added full PWA manifest with name, icons, theme colors, orientation; proper PWA installation and mobile app experience
**Evidence**: d32581b926152b73e50aff6a8cb9f55d5c84cda4
