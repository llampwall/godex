# PM2 Management for Worktree

## Current Setup
PM2 is running the UI rewrite from the worktree:
```bash
pm2 list  # Shows "godex-ui-rewrite"
```

## Switch Back to Main
When ready to merge or abandon this worktree:

```bash
# Stop worktree server
pm2 delete godex-ui-rewrite

# Build and start from main
cd P:\software\godex
pnpm build
pm2 start "P:\software\godex\apps\server\dist\index.js" --name godex --cwd "P:\software\godex\apps\server"
pm2 save
```

## Switch to Worktree (if needed again)
```bash
pm2 delete godex
cd P:\software\godex\.worktrees\ui-rewrite
pnpm build
pm2 start "P:\software\godex\.worktrees\ui-rewrite\apps\server\dist\index.js" --name godex-ui-rewrite --cwd "P:\software\godex\.worktrees\ui-rewrite\apps\server"
pm2 save
```
