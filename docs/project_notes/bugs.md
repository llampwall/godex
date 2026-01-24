# Bug Playbook

### 2026-01-24 - Windows strap spawn fails for .cmd/.bat
- **Symptom:** `POST /workspaces/bootstrap` fails when the strap command is a `.cmd`/`.bat` on Windows (spawn error).
- **Root cause:** `child_process.spawn` was invoked without `shell: true` for `.cmd`/`.bat`, which Windows requires.
- **Fix:** Detect `.cmd`/`.bat` strap command and spawn with `shell: true`.
- **Prevention:** Keep the Windows shell guard in bootstrap route; prefer `.exe` or set `STRAP_BIN` explicitly.
- **References:** commit `60d96b8f33e83ef02093d8b940c570625a0f163c`
