# UI Rewrite Phase 4: Polish & PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the UI rewrite with Share Draft page, PWA features, offline support, and responsive polish.

**Architecture:** ShareDraftPage receives shared content via query params, allows workspace selection, and sends to server. PWA manifest and service worker enable installability and offline detection. Responsive utilities ensure mobile-friendly layouts across all views.

**Tech Stack:** React 18, Vite PWA plugin, localStorage for offline state, TanStack Query for caching, Tailwind responsive utilities

---

## Task 1: Create ShareDraftPage Component

**Files:**
- Create: `apps/ui/src/pages/ShareDraftPage.tsx`

**Step 1: Create the page component**

```typescript
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, X } from "lucide-react";

export function ShareDraftPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Parse incoming share data from URL params
  useEffect(() => {
    const sharedText = searchParams.get("text");
    const sharedUrl = searchParams.get("url");
    const sharedTitle = searchParams.get("title");

    if (sharedUrl) {
      setContent(sharedTitle ? `${sharedTitle}\n${sharedUrl}` : sharedUrl);
    } else if (sharedText) {
      setContent(sharedText);
    }
  }, [searchParams]);

  // Fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>(
          "/workspaces"
        );
        setWorkspaces(response.workspaces || []);
        if (response.workspaces.length > 0) {
          setSelectedWorkspaceId(response.workspaces[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, []);

  const handleSend = async () => {
    if (!content.trim() || !selectedWorkspaceId) return;

    setLoading(true);
    try {
      const workspace = workspaces.find((w) => w.id === selectedWorkspaceId);
      if (!workspace) return;

      // Get or create default thread
      let threadId = workspace.default_thread_id;
      if (!threadId) {
        const createResponse = await api.post<{ ok: boolean; thread_id: string }>(
          "/threads/create"
        );
        threadId = createResponse.thread_id;
      }

      // Send message to thread
      await api.post(`/threads/${threadId}/message`, {
        text: content,
        workspace_id: selectedWorkspaceId,
      });

      // Navigate to workspace
      navigate("/");
    } catch (error) {
      console.error("Failed to send share:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    navigate("/");
  };

  if (loadingWorkspaces) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Share to Godex</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Shared content will appear here..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="workspace">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.title ||
                      workspace.repo_path.split(/[/\\]/).pop() ||
                      workspace.repo_path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSend}
              disabled={loading || !content.trim() || !selectedWorkspaceId}
              className="flex-1 gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </Button>
            <Button
              onClick={handleDiscard}
              variant="outline"
              disabled={loading}
              className="flex-1 gap-2"
            >
              <X className="w-4 h-4" />
              Discard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add missing shadcn Select component**

Check if Select component exists:

Run: `ls apps/ui/src/components/ui/select.tsx`

If not found, create it:

```typescript
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
```

**Step 3: Install @radix-ui/react-select if needed**

Run: `cd apps/ui && pnpm add @radix-ui/react-select`

**Step 4: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/ui/src/pages/ShareDraftPage.tsx apps/ui/src/components/ui/select.tsx package.json pnpm-lock.yaml
git commit -m "feat(ui): add ShareDraftPage for shared content"
```

---

## Task 2: Wire ShareDraftPage to Routing

**Files:**
- Modify: `apps/ui/src/App.tsx`

**Step 1: Import ShareDraftPage**

Add to imports:

```typescript
import { ShareDraftPage } from "@/pages/ShareDraftPage";
```

**Step 2: Update /share route**

Replace the placeholder `/share` route:

```typescript
<Route path="/share" element={<ShareDraftPage />} />
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/ui/src/App.tsx
git commit -m "feat(ui): wire ShareDraftPage to /share route"
```

---

## Task 3: Add Offline Detection Hook

**Files:**
- Create: `apps/ui/src/hooks/useOnline.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect } from "react";

export function useOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/hooks/useOnline.ts
git commit -m "feat(ui): add useOnline hook for offline detection"
```

---

## Task 4: Create Offline Banner Component

**Files:**
- Create: `apps/ui/src/components/layout/OfflineBanner.tsx`

**Step 1: Create the component**

```typescript
import { useOnline } from "@/hooks/useOnline";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-destructive text-destructive-foreground",
        "px-4 py-2 flex items-center justify-center gap-2",
        "text-sm font-medium shadow-md"
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}
```

**Step 2: Add OfflineBanner to App.tsx**

Import OfflineBanner:

```typescript
import { OfflineBanner } from "@/components/layout/OfflineBanner";
```

Add to AppContent and ThreadPage components (after Header):

```typescript
function AppContent() {
  const { currentWorkspace, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      <Header />
      <main className="flex-1">
        {currentWorkspace ? <WorkspaceDetailPage /> : <WorkspaceListPage />}
      </main>
    </div>
  );
}

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
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/ui/src/components/layout/OfflineBanner.tsx apps/ui/src/App.tsx
git commit -m "feat(ui): add offline banner for network status"
```

---

## Task 5: Update PWA Manifest

**Files:**
- Modify: `apps/ui/vite.config.ts`

**Step 1: Review current PWA config**

Read the current vite.config.ts to see PWA plugin configuration.

**Step 2: Update manifest with proper metadata**

Ensure the PWA plugin has a complete manifest:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
  manifest: {
    name: 'Godex',
    short_name: 'Godex',
    description: 'AI-powered development assistant',
    theme_color: '#000000',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'any',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\./i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60 // 5 minutes
          },
          networkTimeoutSeconds: 10
        }
      }
    ]
  }
})
```

**Step 3: Verify build includes PWA assets**

Run: `cd apps/ui && pnpm build`
Expected: Build succeeds, mentions PWA generation

**Step 4: Commit**

```bash
git add apps/ui/vite.config.ts
git commit -m "feat(ui): update PWA manifest with complete metadata"
```

---

## Task 6: Add Responsive Utilities

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceDetailPage.tsx`
- Modify: `apps/ui/src/pages/ThreadDetailPage.tsx`
- Modify: `apps/ui/src/components/layout/Header.tsx`

**Step 1: Add mobile-friendly padding to WorkspaceDetailPage**

Update the main container classes:

```typescript
// Change from:
<div className="flex-1 container max-w-5xl mx-auto p-6 flex flex-col gap-6 overflow-hidden">

// To:
<div className="flex-1 container max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
```

**Step 2: Add mobile-friendly padding to ThreadDetailPage**

Update the messages container:

```typescript
// Change from:
<div className="container max-w-3xl mx-auto p-4 space-y-4">

// To:
<div className="container max-w-3xl mx-auto p-3 md:p-4 space-y-3 md:space-y-4">
```

Update the input container:

```typescript
// Change from:
<div className="border-t border-border p-4">

// To:
<div className="border-t border-border p-3 md:p-4">
```

**Step 3: Make Header workspace switcher responsive**

Update Header component to truncate on mobile:

```typescript
// In Header component, update the workspace switcher container:
<div className="flex-1 min-w-0 mr-2 md:mr-3">
  <WorkspaceSwitcher onNewRepo={() => setNewRepoOpen(true)} />
</div>
```

**Step 4: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 5: Test responsive behavior**

Run: `cd apps/ui && pnpm dev`

Open in browser and test:
- Resize window to mobile width (375px)
- Verify padding adjusts
- Verify text truncates properly
- Verify buttons remain accessible

**Step 6: Commit**

```bash
git add apps/ui/src/pages/WorkspaceDetailPage.tsx apps/ui/src/pages/ThreadDetailPage.tsx apps/ui/src/components/layout/Header.tsx
git commit -m "feat(ui): add responsive utilities for mobile support"
```

---

## Task 7: Add Loading States to API Calls

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceListPage.tsx`

**Step 1: Add loading state to workspace list**

Check if WorkspaceListPage has a loading spinner during fetch.

If not, add:

```typescript
// In WorkspaceListPage component
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      // ... fetch logic
    } finally {
      setLoading(false);
    }
  };
  fetchWorkspaces();
}, []);

// In render:
if (loading) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/pages/WorkspaceListPage.tsx
git commit -m "feat(ui): add loading states to workspace list"
```

---

## Task 8: Build and Verify

**Step 1: Run full build**

```bash
cd apps/ui && pnpm build
```

Expected: Build succeeds with no errors, PWA assets generated

**Step 2: Start dev server and manual test**

```bash
pnpm dev
```

Manual verification checklist:
- [ ] Navigate to /share with ?text=hello query param
- [ ] See "hello" in textarea
- [ ] Select workspace and click Send
- [ ] Navigate back to workspace, see message
- [ ] Disconnect network (browser DevTools)
- [ ] See offline banner appear
- [ ] Reconnect network
- [ ] See offline banner disappear
- [ ] Resize to mobile width
- [ ] Verify responsive padding works
- [ ] Verify all pages remain usable on mobile

**Step 3: Commit final verification**

```bash
git add -A
git commit -m "feat(ui): complete Phase 4 - polish and PWA"
```

---

## Summary

Phase 4 adds:
- **ShareDraftPage**: Receive shared content via query params, send to workspace
- **Select component**: shadcn/ui dropdown for workspace selection
- **useOnline hook**: Detect online/offline status
- **OfflineBanner**: Visual indicator when offline
- **PWA manifest**: Complete metadata for installability
- **Responsive utilities**: Mobile-friendly padding and layouts
- **Loading states**: Improved UX during async operations

All core UI rewrite phases are now complete!
