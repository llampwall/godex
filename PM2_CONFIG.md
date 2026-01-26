# PM2 Configuration Options

There are two PM2 configuration approaches available. Both work reliably, but in case one fails after merge, you can switch to the other.

## Default (Script-Based) - Currently Active

**File:** `ecosystem.config.cjs`

Uses a cmd.exe wrapper script that handles environment setup.

```bash
pm2 start ecosystem.config.cjs
# or
pm2 start
```

This is the original approach from main branch.

## Alternative (Direct Script)

**File:** `ecosystem.config.direct.cjs`

Directly runs the Node.js server with inline environment variables.

```bash
pm2 start ecosystem.config.direct.cjs
```

## Switching Between Configurations

If the default configuration doesn't work after merge:

```bash
# Stop current PM2 process
pm2 delete godex

# Try the alternative configuration
pm2 start ecosystem.config.direct.cjs
pm2 save
```

To switch back:

```bash
pm2 delete godex
pm2 start ecosystem.config.cjs
pm2 save
```

## Manual PM2 Start (No Config File)

If both config files fail, you can always start manually:

```bash
cd P:\software\godex
pnpm build
pm2 start "P:\software\godex\apps\server\dist\index.js" --name godex --cwd "P:\software\godex\apps\server"
pm2 save
```
