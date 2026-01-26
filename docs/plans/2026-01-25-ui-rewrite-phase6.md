# UI Rewrite Phase 6 - Comprehensive Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 critical UI issues: global workspace filtering, menu order, thread header redesign, restart server detection, mobile overflow, and link to workspace functionality.

**Architecture:** Two-layer approach: (1) Backend recognizes `__global__` workspace ID to filter unattached threads, (2) Frontend adds global workspace as first-class entity, rebuilds thread header without workspace chrome, and fixes mobile layout.

**Tech Stack:** React 18, TypeScript, Fastify, Tailwind CSS, Radix UI

---

## Task 1: Add Global Workspace to Context

**Files:**
- Modify: `apps/ui/src/contexts/WorkspaceContext.tsx:19-23,34,57`

**Context:** Currently "All Threads" is handled by setting `currentWorkspace` to `null`. Need to make it a real workspace object with ID `__global__`.

**Step 1: Update GLOBAL_WORKSPACE constant**

In `apps/ui/src/contexts/WorkspaceContext.tsx`, replace lines 19-23:

```typescript
// Before:
const GLOBAL_WORKSPACE: Workspace = {
  id: "__global__",
  title: "All Threads",
  repo_path: "",
};

// After:
export const GLOBAL_WORKSPACE: Workspace = {
  id: "__global__",
  title: "Unlinked Threads",
  repo_path: "Unlinked Threads",
  notify_policy: "none" as const,
  test_command_override: null,
};
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit global workspace constant**

```bash
git add apps/ui/src/contexts/WorkspaceContext.tsx
git commit -m "feat(ui): export GLOBAL_WORKSPACE and rename to Unlinked Threads

- Change from 'All Threads' to 'Unlinked Threads' for clarity
- Export constant for use in other components
- Add required workspace fields (notify_policy, test_command_override)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update WorkspaceSwitcher Menu Structure

**Files:**
- Modify: `apps/ui/src/components/layout/WorkspaceSwitcher.tsx:1,10,32-56`

**Context:** Need to reorder menu: workspaces → All Workspaces → Unlinked Threads → New Repository. Import GLOBAL_WORKSPACE from context.

**Step 1: Import GLOBAL_WORKSPACE**

In `apps/ui/src/components/layout/WorkspaceSwitcher.tsx`, update line 10:

```typescript
// Before:
import { useWorkspace } from "@/contexts/WorkspaceContext";

// After:
import { useWorkspace, GLOBAL_WORKSPACE } from "@/contexts/WorkspaceContext";
```

**Step 2: Reorder menu items**

Replace lines 32-56 with:

```typescript
<DropdownMenuContent align="start" className="w-72 bg-popover border-border">
  {workspaces.filter(w => w.id !== "__global__").map((workspace) => (
    <DropdownMenuItem
      key={workspace.id}
      onClick={() => setCurrentWorkspace(workspace)}
      className={`cursor-pointer font-mono text-sm truncate ${
        currentWorkspace?.id === workspace.id ? "bg-accent" : ""
      }`}
    >
      {workspace.repo_path}
    </DropdownMenuItem>
  ))}
  {workspaces.filter(w => w.id !== "__global__").length > 0 && (
    <DropdownMenuSeparator className="bg-border" />
  )}
  <DropdownMenuItem
    onClick={() => setCurrentWorkspace(null)}
    className="cursor-pointer"
  >
    All Workspaces
  </DropdownMenuItem>
  <DropdownMenuItem
    onClick={() => setCurrentWorkspace(GLOBAL_WORKSPACE)}
    className={`cursor-pointer ${
      currentWorkspace?.id === "__global__" ? "bg-accent" : ""
    }`}
  >
    Unlinked Threads
  </DropdownMenuItem>
  <DropdownMenuSeparator className="bg-border" />
  <DropdownMenuItem onClick={onNewRepo} className="cursor-pointer gap-2">
    <Plus className="w-4 h-4" />
    New Repository
  </DropdownMenuItem>
</DropdownMenuContent>
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Commit menu reordering**

```bash
git add apps/ui/src/components/layout/WorkspaceSwitcher.tsx
git commit -m "feat(ui): reorder workspace switcher menu

- Filter out __global__ from workspace list
- Show: Workspaces → All Workspaces → Unlinked Threads → New Repo
- Highlight Unlinked Threads when selected

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update WorkspaceDetailPage for Global Workspace

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceDetailPage.tsx:30-35,93,98,134,149-152,161`

**Context:** Always pass `workspace_id` to server, hide quick actions and new thread input for global workspace, update page title.

**Step 1: Always pass workspace_id parameter**

Replace lines 30-35:

```typescript
// Before:
const url =
  currentWorkspace.id === "__global__"
    ? "/threads"
    : `/threads?workspace_id=${currentWorkspace.id}`;

// After:
const url = `/threads?workspace_id=${currentWorkspace.id}`;
```

**Step 2: Update page title in header comment**

Update line 98 comment and add title display (this is visual only, actual rendering happens in line 161):

```typescript
// Line 98 - Add comment for clarity:
<div className="flex-1 container max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
  {/* Quick Actions - only show for real workspaces, not global */}
```

**Step 3: Fix New Thread card width (mobile overflow fix part 1)**

Replace line 134:

```typescript
// Before:
<Card className="flex-1 flex flex-col overflow-hidden">

// After:
<Card className="w-full">
```

**Step 4: Update global workspace message**

Replace lines 149-155:

```typescript
// Before:
{isGlobalWorkspace && (
  <Card className="p-6 text-center border-dashed">
    <CardContent className="text-muted-foreground text-sm">
      Select a workspace from the menu to interact with it, or click a thread to view it.
    </CardContent>
  </Card>
)}

// After:
{isGlobalWorkspace && (
  <Card className="p-6 text-center border-dashed">
    <CardContent className="text-muted-foreground text-sm">
      These are threads not linked to any workspace. Click a thread to view it, or link it to a workspace from the thread page.
    </CardContent>
  </Card>
)}
```

**Step 5: Update section title**

Replace line 161:

```typescript
// Before:
{isGlobalWorkspace ? "All Threads" : "Linked Threads"}

// After:
{isGlobalWorkspace ? "Unlinked Threads" : "Linked Threads"}
```

**Step 6: Fix thread list container (mobile overflow fix part 2)**

Replace line 182:

```typescript
// Before:
<div className="grid gap-2">

// After:
<div className="flex flex-col gap-2">
```

**Step 7: Fix thread card overflow (mobile overflow fix part 3)**

Replace lines 184-206:

```typescript
<Card
  key={thread.thread_id}
  onClick={() => navigate(`/t/${thread.thread_id}`)}
  className="cursor-pointer hover:bg-accent/50 transition-colors w-full"
>
  <CardContent className="p-3 flex items-center gap-3 min-w-0">
    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
      <MessageSquare className="w-4 h-4 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="font-medium text-sm truncate">
        {thread.title_override || thread.title || `Thread ${thread.thread_id.slice(0, 8)}`}
      </div>
      {thread.summary && (
        <div className="text-xs text-muted-foreground truncate">
          {thread.summary}
        </div>
      )}
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
  </CardContent>
</Card>
```

**Step 8: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 9: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 10: Commit workspace detail updates**

```bash
git add apps/ui/src/pages/WorkspaceDetailPage.tsx
git commit -m "feat(ui): update WorkspaceDetailPage for global workspace and mobile

- Always pass workspace_id to server (including __global__)
- Update global workspace help text to mention linking
- Change 'All Threads' to 'Unlinked Threads'
- Fix mobile overflow: w-full, flex flex-col, min-w-0, truncate

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update Server Thread Filtering

**Files:**
- Modify: `apps/server/src/routes/threads.ts:284-287`

**Context:** Server needs to recognize `workspace_id=__global__` as "filter for threads with empty attached_workspace_ids".

**Step 1: Update filtering logic**

Replace lines 284-287:

```typescript
// Before:
const workspaceId = query?.workspace_id;
const filtered = workspaceId
  ? merged.filter((thread) => thread.attached_workspace_ids.includes(workspaceId))
  : merged;

// After:
const workspaceId = query?.workspace_id;
const filtered = workspaceId === "__global__"
  ? merged.filter((thread) => thread.attached_workspace_ids.length === 0)
  : workspaceId
  ? merged.filter((thread) => thread.attached_workspace_ids.includes(workspaceId))
  : merged;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Test global workspace filtering**

Start server if not running:
```bash
pm2 restart godex-ui-rewrite
```

Test in browser at http://localhost:7777/ui:
1. Select "Unlinked Threads" from menu
2. Verify only threads with no workspace attachments appear
3. Click on a workspace (e.g., "test3")
4. Verify only threads linked to that workspace appear

Expected: Filtering works correctly

**Step 5: Commit server filtering**

```bash
git add apps/server/src/routes/threads.ts
git commit -m "feat(server): filter threads for __global__ workspace

- When workspace_id=__global__, return only unattached threads
- Filter for attached_workspace_ids.length === 0
- Preserves existing behavior for real workspace IDs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Remove Header from Thread Routes

**Files:**
- Modify: `apps/ui/src/App.tsx:33-42`

**Context:** Thread detail pages should not show the workspace header. Remove `<Header />` from ThreadPage component.

**Step 1: Remove Header from ThreadPage**

Replace lines 33-42:

```typescript
// Before:
function ThreadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      <Header />
      <main className="flex-1">
        <ThreadDetailPage />
      </main>
    </div>
  );
}

// After:
function ThreadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      <main className="flex-1">
        <ThreadDetailPage />
      </main>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit header removal**

```bash
git add apps/ui/src/App.tsx
git commit -m "feat(ui): remove workspace header from thread pages

- Thread pages are now standalone without workspace chrome
- Prepares for thread-specific header with search and actions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Redesign ThreadDetailPage Header

**Files:**
- Modify: `apps/ui/src/pages/ThreadDetailPage.tsx:1-10,19,212-219`
- Create: `apps/ui/src/components/thread/LinkWorkspaceDialog.tsx`

**Context:** Replace simple header with comprehensive thread header: back button, title, search, and actions menu (Copy ID, Link to Workspace, Delete).

**Step 1: Add imports**

Update lines 1-10:

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, ThreadDetail } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, User, Bot, Loader2, MoreVertical, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkWorkspaceDialog } from "@/components/thread/LinkWorkspaceDialog";
```

**Step 2: Add state for search and dialog**

After line 19 (after `const navigate = useNavigate();`), add:

```typescript
const [searchQuery, setSearchQuery] = useState("");
const [linkWorkspaceOpen, setLinkWorkspaceOpen] = useState(false);
```

**Step 3: Add action handlers before the return statement**

Before line 186 (before `const threadTitle = ...`), add:

```typescript
const handleCopyThreadId = () => {
  if (threadId) {
    navigator.clipboard.writeText(threadId);
    // Could add toast notification here if available
  }
};

const handleDelete = async () => {
  if (!threadId) return;
  if (!confirm("Are you sure you want to delete this thread?")) return;

  try {
    await api.delete(`/threads/${threadId}`);
    navigate(-1);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to delete thread");
  }
};

// Filter messages by search query
const filteredMessages = searchQuery.trim()
  ? messages.filter(m =>
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : messages;
```

**Step 4: Replace header**

Replace lines 212-219 with:

```typescript
<div className="flex flex-col h-screen">
  {/* Thread Header */}
  <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card">
    {/* Left: Back + Title */}
    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4" />
    </Button>
    <h1 className="font-medium truncate min-w-0">{threadTitle}</h1>

    {/* Center: Search */}
    <div className="flex-1 max-w-md mx-4 hidden md:block">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
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

**Step 5: Update messages rendering to use filteredMessages**

Find line 230 (the `{messages.map((message) => (`), replace with:

```typescript
{filteredMessages.map((message) => (
```

**Step 6: Add LinkWorkspaceDialog before closing div**

Before the final `</div>` (after the Input section around line 267), add:

```typescript
{/* Link to Workspace Dialog */}
<LinkWorkspaceDialog
  open={linkWorkspaceOpen}
  onOpenChange={setLinkWorkspaceOpen}
  threadId={threadId || ""}
/>
```

**Step 7: Create LinkWorkspaceDialog component**

Create `apps/ui/src/components/thread/LinkWorkspaceDialog.tsx`:

```typescript
import { useState, useEffect } from "react";
import { api, Workspace } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface LinkWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
}

export function LinkWorkspaceDialog({ open, onOpenChange, threadId }: LinkWorkspaceDialogProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [linkedWorkspaceIds, setLinkedWorkspaceIds] = useState<string[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchWorkspaces();
      fetchLinkedWorkspaces();
    }
  }, [open, threadId]);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>("/workspaces");
      setWorkspaces(response.workspaces.filter(w => w.id !== "__global__"));
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchLinkedWorkspaces = async () => {
    try {
      const response = await api.get<{ data: { attached_workspace_ids: string[] } }>(
        `/threads/${threadId}`
      );
      setLinkedWorkspaceIds(response.data?.attached_workspace_ids || []);
    } catch (error) {
      console.error("Failed to fetch linked workspaces:", error);
    }
  };

  const handleLink = async () => {
    if (!selectedWorkspaceId) return;
    setLoading(true);
    try {
      await api.post(`/workspaces/${selectedWorkspaceId}/threads`, { thread_id: threadId });
      await fetchLinkedWorkspaces();
      setSelectedWorkspaceId("");
    } catch (error) {
      console.error("Failed to link workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (workspaceId: string) => {
    setLoading(true);
    try {
      await api.delete(`/workspaces/${workspaceId}/threads/${threadId}`);
      await fetchLinkedWorkspaces();
    } catch (error) {
      console.error("Failed to unlink workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const linkedWorkspaces = workspaces.filter(w => linkedWorkspaceIds.includes(w.id));
  const availableWorkspaces = workspaces.filter(w => !linkedWorkspaceIds.includes(w.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to Workspace</DialogTitle>
          <DialogDescription>
            Link this thread to one or more workspaces to organize your conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Currently Linked Workspaces */}
          {linkedWorkspaces.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Linked Workspaces</p>
              <div className="flex flex-wrap gap-2">
                {linkedWorkspaces.map(workspace => (
                  <div
                    key={workspace.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded text-sm"
                  >
                    <span className="font-mono">{workspace.repo_path}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => handleUnlink(workspace.id)}
                      disabled={loading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Workspace */}
          {availableWorkspaces.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Add Workspace</p>
              <div className="flex gap-2">
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkspaces.map(workspace => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.repo_path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleLink} disabled={!selectedWorkspaceId || loading}>
                  Link
                </Button>
              </div>
            </div>
          )}

          {linkedWorkspaces.length === 0 && availableWorkspaces.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No workspaces available. Create a workspace first.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 8: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 9: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 10: Test thread header**

Test in browser at http://localhost:7777/ui:
1. Navigate to any thread
2. Verify workspace header is gone
3. Verify new thread header appears with search box
4. Test search - type text and verify messages filter
5. Click actions menu (three dots)
6. Test "Copy Thread ID" - should copy to clipboard
7. Test "Link to Workspace" - dialog should open
8. Test "Delete Thread" - should show confirmation

Expected: All features work correctly

**Step 11: Commit thread header redesign**

```bash
git add apps/ui/src/pages/ThreadDetailPage.tsx apps/ui/src/components/thread/LinkWorkspaceDialog.tsx
git commit -m "feat(ui): redesign thread header with search and actions

- Remove workspace header from thread pages
- Add thread-specific header with back, title, search, actions
- Implement in-thread message search (filters displayed messages)
- Add actions menu: Copy Thread ID, Link to Workspace, Delete Thread
- Create LinkWorkspaceDialog for managing workspace links
- Shows currently linked workspaces as removable chips
- Allows adding new workspace links via dropdown

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Fix Restart Server Endpoint

**Files:**
- Modify: `apps/server/src/routes/diag.ts:124-134`

**Context:** Restart endpoint hardcodes PM2 process name "godex". Need to detect correct process name dynamically using `pm2 jlist`.

**Step 1: Add import for resolve**

At top of file (after existing imports around line 1-5), verify `resolve` is imported:

```typescript
import { resolve } from "node:path";
```

**Step 2: Replace restart logic**

Replace lines 124-134:

```typescript
// Before:
appendFileSync(logPath, `[${new Date().toISOString()}] pm2 restart starting (shell)\n`);
const restartResult = await runCommand(pm2Path, ["restart", "godex"], { cwd: repoRoot, shell: true });
appendFileSync(
  logPath,
  `[${new Date().toISOString()}] pm2 restart ok=${restartResult.ok} code=${restartResult.code ?? "null"}\n` +
    `stdout:\n${truncate(restartResult.stdout, 20000)}\n` +
    `stderr:\n${truncate(restartResult.stderr, 20000)}\n`
);
if (!restartResult.ok) {
  return reply.code(500).send({ ok: false, error: "pm2 restart failed; see restart.log" });
}

// After:
appendFileSync(logPath, `[${new Date().toISOString()}] pm2 jlist starting (shell)\n`);
const jlistResult = await runCommand(pm2Path, ["jlist"], { cwd: repoRoot, shell: true });
appendFileSync(
  logPath,
  `[${new Date().toISOString()}] pm2 jlist ok=${jlistResult.ok} code=${jlistResult.code ?? "null"}\n` +
    `stdout:\n${truncate(jlistResult.stdout, 20000)}\n` +
    `stderr:\n${truncate(jlistResult.stderr, 20000)}\n`
);

let processName = "godex";
if (jlistResult.ok) {
  try {
    const processes = JSON.parse(jlistResult.stdout);
    const serverIndexPath = resolve(repoRoot, "apps", "server", "dist", "index.js");
    const match = processes.find((p: any) => {
      const script = p?.pm2_env?.pm_exec_path ?? "";
      return script.toLowerCase().replace(/\\/g, "/") === serverIndexPath.toLowerCase().replace(/\\/g, "/");
    });
    if (match?.name) {
      processName = match.name;
      appendFileSync(logPath, `[${new Date().toISOString()}] detected PM2 process name: ${processName}\n`);
    }
  } catch (err: any) {
    appendFileSync(logPath, `[${new Date().toISOString()}] pm2 jlist parse failed: ${err?.message ?? "unknown"}\n`);
  }
}

appendFileSync(logPath, `[${new Date().toISOString()}] pm2 restart ${processName} starting (shell)\n`);
const restartResult = await runCommand(pm2Path, ["restart", processName], { cwd: repoRoot, shell: true });
appendFileSync(
  logPath,
  `[${new Date().toISOString()}] pm2 restart ok=${restartResult.ok} code=${restartResult.code ?? "null"}\n` +
    `stdout:\n${truncate(restartResult.stdout, 20000)}\n` +
    `stderr:\n${truncate(restartResult.stderr, 20000)}\n`
);
if (!restartResult.ok) {
  return reply.code(500).send({ ok: false, error: "pm2 restart failed; see restart.log" });
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Restart server**

```bash
pm2 restart godex-ui-rewrite
```

**Step 6: Test restart endpoint**

Test in browser at http://localhost:7777/ui:
1. Click workspace switcher
2. Click Actions menu (three dots)
3. Click "Restart Server"
4. Wait a few seconds
5. Verify server restarts successfully

Check logs:
```bash
type C:\Users\Jordan\.pm2\logs\godex-ui-rewrite-restart.log
```

Expected: Log shows "detected PM2 process name: godex-ui-rewrite" and restart succeeds

**Step 7: Commit restart fix**

```bash
git add apps/server/src/routes/diag.ts
git commit -m "fix(server): detect PM2 process name dynamically for restart

- Use pm2 jlist to find process running current index.js
- Match by comparing pm_exec_path to server index.js path
- Works in both main repo (godex) and worktree (godex-ui-rewrite)
- Logs process name detection for debugging
- Falls back to 'godex' if detection fails

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Final Build and Manual Testing

**Files:**
- All modified files

**Step 1: Clean build**

Run: `pnpm build`
Expected: Build succeeds with no errors or warnings

**Step 2: Restart PM2 server**

```bash
pm2 restart godex-ui-rewrite
```

Expected: Server restarts successfully

**Step 3: Comprehensive manual testing**

Test checklist:

1. **Menu order**:
   - Open workspace switcher
   - Verify order: workspaces → All Workspaces → Unlinked Threads → New Repository

2. **Global workspace filtering**:
   - Select "Unlinked Threads"
   - Verify only threads with no workspace attachments appear
   - Navigate to a thread
   - Link it to a workspace via "Link to Workspace" dialog
   - Go back to "Unlinked Threads"
   - Verify thread no longer appears

3. **Thread header**:
   - Navigate to any thread
   - Verify workspace header is NOT shown
   - Verify thread header shows: back button, title, search box, actions menu
   - Type in search box
   - Verify messages filter correctly
   - Clear search
   - Verify all messages return
   - Click actions menu
   - Test "Copy Thread ID"
   - Test "Link to Workspace" - verify dialog works
   - Test "Delete Thread" (on a test thread)

4. **Mobile overflow**:
   - Resize browser to 360x880 or use Playwright:
     ```javascript
     await page.setViewportSize({ width: 360, height: 880 });
     await page.goto('http://localhost:7777/ui');
     ```
   - Select a workspace
   - Verify no horizontal scrollbar
   - Verify thread cards fit within viewport
   - Verify text truncates properly

5. **Restart server**:
   - Click workspace switcher → Actions → Restart Server
   - Should restart with correct PM2 process name (godex-ui-rewrite)
   - Check logs to verify

6. **Existing functionality**:
   - New thread creation still works
   - Message sending and streaming still works
   - Thread detail page still loads messages

**Step 4: Check git status**

Run: `git status`
Expected: Working directory clean (all changes committed)

**Step 5: Review commit history**

Run: `git log --oneline -10`
Expected: See all 7 commits from this phase

---

## Summary

Phase 6 fixes all 6 critical UI issues:

1. **Global workspace filtering** - Server filters for `attached_workspace_ids.length === 0` when `workspace_id=__global__`
2. **Menu order** - Unlinked Threads appears below All Workspaces
3. **Thread header redesign** - Standalone header with search and actions (Copy ID, Link to Workspace, Delete)
4. **Restart server** - Dynamically detects PM2 process name (works in both main repo and worktree)
5. **Mobile overflow** - Cards fit within 360x880 viewport with proper truncation
6. **Link to Workspace** - Dialog shows current links and allows adding/removing

All changes are backwards-compatible and non-breaking.

**Testing notes:**
- Restart uses `/diag/restart` endpoint (Windows only)
- Mobile fixes are CSS-only
- Thread header uses existing API endpoints for link/delete
- Global workspace is a synthetic workspace (not stored in DB)
