<!-- DO: Rewrite freely. Keep under 30 lines. Current truth only. -->
<!-- DON'T: Add history, rationale, or speculation. No "we used to..." -->

# State

## Current Objective
UI rewrite merged to main; monitoring post-merge stability and minor fixes

## Active Work
- None

## Blockers
None

## Next Actions
- [ ] Monitor for any regressions from UI rewrite merge
- [ ] Address any new bugs reported from mobile/PWA usage
- [ ] Consider next feature additions (Phase 7+)

## Quick Reference
- Dev: `pnpm dev` (runs both server + UI dev server)
- Build: `pnpm build`
- Test: `pnpm test` (server + UI build verification)
- PM2 start: `pm2 start "P:\software\godex\apps\server\dist\index.js" --name godex --cwd "P:\software\godex\apps\server"`
- PM2 restart: `pm2 restart godex`
- Caddy: `start-caddy.cmd` (required for phone HTTPS access)
- UI: `http://central-command:5174/ui?token=YOUR_TOKEN` (dev) or `http://central-command:SERVER_PORT/ui?token=YOUR_TOKEN` (prod)

## Out of Scope (for now)
- Additional UI refinements beyond Phase 6 bugfixes

---
Last memory update: 2026-02-05
Commits covered through: 4626a2cf5cb639fb531aeb37e2635da69a94705c

<!-- chinvex:last-commit:4626a2cf5cb639fb531aeb37e2635da69a94705c -->
