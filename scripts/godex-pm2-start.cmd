@echo off
setlocal
set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%"

set "LOG=%REPO_ROOT%\.godex\pm2-start.log"
if not exist "%REPO_ROOT%\.godex" mkdir "%REPO_ROOT%\.godex"
echo [%date% %time%] starting > "%LOG%"
echo repo=%REPO_ROOT%>> "%LOG%"
echo path=%PATH%>> "%LOG%"

for %%i in (pnpm.cmd) do set "PNPM_CMD=%%~$PATH:i"
if not defined PNPM_CMD set "PNPM_CMD=C:\nvm4w\nodejs\pnpm.cmd"
echo pnpm=%PNPM_CMD%>> "%LOG%"

call "%PNPM_CMD%" start >> "%LOG%" 2>&1
echo [%date% %time%] exit=%errorlevel%>> "%LOG%"
exit /b %errorlevel%
