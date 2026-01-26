# Bug Playbook

### 2026-01-26 - Service worker register script served as HTML
- **Symptom:** Service worker registration fails with `Unexpected token <` in `registerSW.js`.
- **Root cause:** `registerSW.js` was not included in the server root static file list, so the UI path returned HTML instead of JavaScript.
- **Fix:** Add `registerSW.js` to the server root files list so it is served as JavaScript.
- **Prevention:** Keep PWA/static root file allowlists in sync with UI build assets when adding new root-level scripts.
- **References:** commit `f5450d00f5cdda73eedafa18ef7a3922fd3e63d4`

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
