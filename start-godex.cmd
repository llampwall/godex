@echo off
pnpm build
if errorlevel 1 exit /b %errorlevel%
pnpm start
