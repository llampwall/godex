# Bug Playbook

### 2026-01-25 - PM2 restart fails on Windows
- **Symptom:** Restart button fails under PM2 on Windows; server restart doesn't trigger reliably.
- **Root cause:** PM2 restart path invoked via pnpm/.cmd without Windows shell or resolved paths, causing spawn failures.
- **Fix:** Add `/diag/restart` to resolve pnpm/pm2 paths and run build+restart with shell, logging output to `.godex/restart.log`.
- **Prevention:** Use the Windows PM2 start helpers and keep restart logic shell-aware for `.cmd`/`.bat`.
- **References:** commit `84183cba90f72ed6aef8f1099fd97cfefe1193b0`

### 2026-01-24 - Windows strap spawn fails for .cmd/.bat
- **Symptom:** `POST /workspaces/bootstrap` fails when the strap command is a `.cmd`/`.bat` on Windows (spawn error).
- **Root cause:** `child_process.spawn` was invoked without `shell: true` for `.cmd`/`.bat`, which Windows requires.
- **Fix:** Detect `.cmd`/`.bat` strap command and spawn with `shell: true`.
- **Prevention:** Keep the Windows shell guard in bootstrap route; prefer `.exe` or set `STRAP_BIN` explicitly.
- **References:** commit `60d96b8f33e83ef02093d8b940c570625a0f163c`
