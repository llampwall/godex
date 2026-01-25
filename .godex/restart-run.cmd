@echo off
cd /d "P:\software\godex"
echo [start] %date% %time% > "P:\software\godex\.godex\restart-run.log"
call pnpm build >> "P:\software\godex\.godex\restart-run.log" 2>&1
if errorlevel 1 exit /b %errorlevel%
echo [start] pnpm start >> "P:\software\godex\.godex\restart-run.log"
call pnpm start >> "P:\software\godex\.godex\restart-run.log" 2>&1
