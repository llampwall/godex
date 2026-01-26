# UI Rewrite Phase 5 - Remaining Bugfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix remaining UI issues from phase 3: restart server detection and mobile overflow

**Architecture:** Two independent fixes: (1) Update restart endpoint to detect PM2 process name dynamically, (2) Apply responsive CSS to prevent overflow on mobile viewports

**Tech Stack:** React 18, TypeScript, Fastify, Tailwind CSS

---

### Task 1: Fix Restart Server to Detect PM2 Process Name

**Files:**
- Modify: `apps/server/src/routes/diag.ts:124-134`

**Context:** The restart endpoint hardcodes `pm2 restart godex` but when running from worktree, PM2 process is named `godex-ui-rewrite`. Need to detect the correct process name dynamically by matching the current server's index.js path.

**Step 1: Update restart endpoint to detect PM2 process name**

In `apps/server/src/routes/diag.ts`, replace lines 124-134 with:

```typescript
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

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Build the server**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Test restart endpoint**

Start the server with PM2 if not already running, then test:
```bash
curl -X POST http://localhost:7777/diag/restart -H "Authorization: Bearer ${CODEX_RELAY_TOKEN}"
```

Expected: Server restarts successfully

**Step 5: Commit restart fix**

```bash
git add apps/server/src/routes/diag.ts
git commit -m "fix: detect PM2 process name dynamically for restart

- Use pm2 jlist to find process running current index.js
- Works in both main repo (godex) and worktree (godex-ui-rewrite)
- Logs process name detection for debugging"
```

---

### Task 2: Fix Mobile Overflow for Thread Cards

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceDetailPage.tsx:98,134,182-207`

**Context:** Thread cards overflow horizontally on mobile (360x880). Need responsive sizing and width constraints.

**Step 1: Update main container width constraints**

Replace line 98:

```typescript
// Before:
<div className="flex-1 container max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">

// After:
<div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
```

**Step 2: Fix New Thread card width**

Replace line 134:

```typescript
// Before:
<Card className="flex-1 flex flex-col overflow-hidden">

// After:
<Card className="w-full">
```

**Step 3: Update thread list container**

Replace line 182:

```typescript
// Before:
<div className="grid gap-2">

// After:
<div className="flex flex-col gap-2">
```

**Step 4: Fix thread card to prevent overflow**

Replace the Card component (lines 184-206) with:

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

**Step 5: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 6: Build**

Run: `pnpm build`
Expected: Build succeeds

**Step 7: Test mobile layout in Playwright**

```javascript
await page.setViewportSize({ width: 360, height: 880 });
await page.goto('http://localhost:5174/ui/?serverPort=7777&token=zflipcommand');
// Verify no horizontal scrollbar, cards fit within viewport
```

**Step 8: Commit mobile overflow fix**

```bash
git add apps/ui/src/pages/WorkspaceDetailPage.tsx
git commit -m "fix: prevent thread card overflow on mobile (360x880)

- Add w-full to main container and cards
- Change grid to flex flex-col for better mobile layout
- Add min-w-0 and overflow-hidden to text containers
- Ensures cards fit within 360px viewport"
```

---

### Task 3: Final Build and Verification

**Files:**
- All modified files

**Step 1: Clean build**

Run: `pnpm build`
Expected: Build succeeds with no errors or warnings

**Step 2: Restart PM2 server**

Run: `pm2 restart godex-ui-rewrite`
Expected: Server restarts successfully

**Step 3: Comprehensive manual testing**

Test checklist:
1. **Restart server**:
   - Click Actions menu → Restart server
   - Should restart with correct PM2 process name (godex-ui-rewrite)

2. **Mobile overflow**:
   - Resize browser to 360x880 or use Playwright
   - Verify no horizontal scroll
   - All thread cards fit within viewport
   - Text truncates properly

3. **Existing functionality**:
   - New thread creation still works
   - Message sending and streaming still works
   - Thread detail page still loads messages

**Step 4: Check for any final cleanup**

Review git diff to ensure all changes are intentional and minimal.

**Step 5: Final commit if needed**

If any last-minute adjustments were made:
```bash
git add -A
git commit -m "chore: final cleanup for phase 5 bugfixes"
```

---

## Summary

Phase 5 fixes two remaining issues from phase 3:

1. **Restart server** - Dynamically detects PM2 process name (works in both main repo and worktree)
2. **Mobile overflow** - Fixes horizontal overflow on 360x880 viewport

All changes are backwards-compatible and non-breaking.

**Testing notes:**
- Restart uses `/diag/restart` endpoint (Windows only)
- Mobile fixes are CSS-only, no behavioral changes

**Note:** Link thread functionality is handled from thread detail page and doesn't need a workspace-side modal.
