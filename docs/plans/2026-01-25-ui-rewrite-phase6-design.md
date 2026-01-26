# UI Rewrite Phase 6 - Comprehensive Bugfixes Design

## Overview

Fix 6 critical issues with the updated UI:
1. Menu order - "Unlinked Threads" should be below "All Workspaces"
2. Global workspace filtering - "Unlinked Threads" not showing all unattached threads
3. Thread detail header - Replace workspace header with thread-specific header
4. Restart server - Detect PM2 process name dynamically
5. Mobile overflow - Thread cards overflow on 360x880 viewport
6. Link to Workspace - Missing button to link threads to workspaces

## Architecture

### Global Workspace Model

The global workspace (`__global__`) represents threads NOT attached to any repository workspace. This is a first-class workspace in the UI, not a special null state.

**Changes:**
- Add `GLOBAL_WORKSPACE` constant to WorkspaceContext
- Server recognizes `workspace_id=__global__` as "filter for empty attached_workspace_ids"
- UI always passes `workspace_id` parameter (either real ID or `__global__`)

### Thread Detail Page Architecture

Thread pages become standalone views without workspace chrome. The thread itself is the focus, with its own header, actions, and in-thread search.

**Changes:**
- Remove workspace header from thread routes
- Build complete header in ThreadDetailPage component
- Add thread-specific actions: Copy ID, Link to Workspace, Delete
- Add in-thread message search

### Workspace Switcher Menu Structure

```
┌─────────────────────────────┐
│ P:\software\godex           │ ← Current workspace
│ P:\software\other-repo      │
├─────────────────────────────┤
│ All Workspaces              │ ← Workspace list view
│ Unlinked Threads            │ ← Global workspace
├─────────────────────────────┤
│ + New Repository            │
└─────────────────────────────┘
```

## Data Flow Changes

### Before (broken):
```
User clicks "All Threads"
→ setCurrentWorkspace(null)
→ UI shows workspace list
→ WorkspaceDetailPage tries to fetch with workspace_id=__global__
→ Server fetches ALL threads (ignoring workspace_id)
→ Returns threads attached to ANY workspace
```

### After (fixed):
```
User clicks "Unlinked Threads"
→ setCurrentWorkspace(GLOBAL_WORKSPACE)
→ UI shows WorkspaceDetailPage
→ Fetches /threads?workspace_id=__global__
→ Server filters for attached_workspace_ids.length === 0
→ Returns only unattached threads
```

## Component Changes

### 1. WorkspaceContext (`apps/ui/src/contexts/WorkspaceContext.tsx`)

**Add global workspace constant:**
```typescript
export const GLOBAL_WORKSPACE = {
  id: "__global__",
  repo_path: "Unlinked Threads",
  title: "Unlinked Threads",
  notify_policy: "none" as const,
  test_command_override: null,
};
```

**Add to workspace list:**
```typescript
const allWorkspaces = [...workspacesData, GLOBAL_WORKSPACE];
```

### 2. WorkspaceSwitcher (`apps/ui/src/components/layout/WorkspaceSwitcher.tsx`)

**New menu structure:**
```typescript
{workspaces.filter(w => w.id !== "__global__").map((workspace) => (
  <DropdownMenuItem key={workspace.id} onClick={() => setCurrentWorkspace(workspace)}>
    {workspace.repo_path}
  </DropdownMenuItem>
))}
<DropdownMenuSeparator />
<DropdownMenuItem onClick={() => setCurrentWorkspace(null)}>
  All Workspaces
</DropdownMenuItem>
<DropdownMenuItem onClick={() => setCurrentWorkspace(GLOBAL_WORKSPACE)}>
  Unlinked Threads
</DropdownMenuItem>
<DropdownMenuSeparator />
<DropdownMenuItem onClick={onNewRepo}>
  <Plus className="w-4 h-4" />
  New Repository
</DropdownMenuItem>
```

### 3. WorkspaceDetailPage (`apps/ui/src/pages/WorkspaceDetailPage.tsx`)

**Always pass workspace_id:**
```typescript
const url = `/threads?workspace_id=${currentWorkspace.id}`;
```

**Hide quick actions and new thread for global workspace:**
```typescript
const isGlobalWorkspace = currentWorkspace.id === "__global__";

// Don't show Quick Actions or New Thread card for global workspace
{!isGlobalWorkspace && (
  // ... quick actions and new thread UI
)}
```

**Update page title:**
```typescript
const pageTitle = currentWorkspace.id === "__global__"
  ? "Unlinked Threads"
  : currentWorkspace.repo_path;
```

### 4. Server Threads Route (`apps/server/src/routes/threads.ts`)

**Update filtering logic:**
```typescript
// Filter by workspace_id if provided
const workspaceId = query?.workspace_id;
const filtered = workspaceId === "__global__"
  ? merged.filter((thread) => thread.attached_workspace_ids.length === 0)
  : workspaceId
  ? merged.filter((thread) => thread.attached_workspace_ids.includes(workspaceId))
  : merged;
```

### 5. ThreadDetailPage Header (`apps/ui/src/pages/ThreadDetailPage.tsx`)

**New header structure:**
```tsx
<header className="border-b border-border px-4 py-3 flex items-center gap-3">
  {/* Left: Back + Title */}
  <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
    <ArrowLeft className="w-4 h-4" />
  </Button>
  <h1 className="font-medium truncate">{threadTitle}</h1>

  {/* Center: Search */}
  <div className="flex-1 max-w-md mx-4">
    <Input
      placeholder="Search messages..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* Right: Actions Menu */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreVertical className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={handleCopyThreadId}>
        Copy Thread ID
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setLinkWorkspaceOpen(true)}>
        Link to Workspace
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
        Delete Thread
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</header>
```

**Search implementation:**
```typescript
const [searchQuery, setSearchQuery] = useState("");

const filteredMessages = searchQuery.trim()
  ? messages.filter(m =>
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : messages;
```

**Link to Workspace dialog:**
- Show current linked workspaces as chips
- Dropdown to select workspace to add
- Button to unlink from workspace
- Uses existing `/workspaces/:id/threads` endpoints

### 6. App Routes (`apps/ui/src/App.tsx`)

**Remove Header from thread routes:**
```tsx
function ThreadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      {/* No <Header /> here */}
      <main className="flex-1">
        <ThreadDetailPage />
      </main>
    </div>
  );
}
```

### 7. Restart Server Fix (`apps/server/src/routes/diag.ts`)

Already detailed in Phase 5 plan - use `pm2 jlist` to detect process name dynamically.

### 8. Mobile Overflow Fix (`apps/ui/src/pages/WorkspaceDetailPage.tsx`)

Already detailed in Phase 5 plan - add `w-full`, `min-w-0`, `truncate` classes.

## API Endpoints

### Existing (used by Link to Workspace):
- `POST /workspaces/:workspace_id/threads` - Link thread to workspace
- `DELETE /workspaces/:workspace_id/threads/:thread_id` - Unlink thread
- `DELETE /threads/:thread_id` - Delete thread

### Modified:
- `GET /threads?workspace_id=__global__` - Returns threads with empty `attached_workspace_ids`

## Testing Plan

1. **Global workspace filtering:**
   - Create threads without linking to workspace
   - Verify they appear in "Unlinked Threads"
   - Link thread to workspace
   - Verify it disappears from "Unlinked Threads"

2. **Menu order:**
   - Open workspace switcher
   - Verify "All Workspaces" appears before "Unlinked Threads"

3. **Thread header:**
   - Navigate to thread detail page
   - Verify workspace header is NOT shown
   - Verify thread header has search box
   - Verify dropdown menu works
   - Test Copy Thread ID
   - Test Link to Workspace
   - Test Delete Thread

4. **In-thread search:**
   - Type in search box
   - Verify messages filter correctly
   - Clear search
   - Verify all messages return

5. **Restart server:**
   - Click Actions → Restart Server
   - Verify server restarts (check PM2 logs)
   - Works for both "godex" and "godex-ui-rewrite" processes

6. **Mobile overflow:**
   - Resize to 360x880
   - Verify no horizontal scroll
   - Verify thread cards fit within viewport

## Success Criteria

- [ ] "Unlinked Threads" shows only threads with no workspace attachments
- [ ] "Unlinked Threads" appears below "All Workspaces" in menu
- [ ] Thread detail pages show thread header, not workspace header
- [ ] Can copy thread ID from thread page
- [ ] Can link/unlink thread to workspaces from thread page
- [ ] Can delete thread from thread page
- [ ] Can search messages within thread
- [ ] Restart server works for both main and worktree
- [ ] No UI overflow on 360x880 mobile viewport
