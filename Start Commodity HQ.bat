@echo off
cd /d "%~dp0"
title Commodity HQ

powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo Commodity HQ is already running.
  start "" http://localhost:3000
  echo Browser opened. Press any key to close this window.
  pause >nul
  exit /b 0
)

echo Starting Commodity HQ...
start "" http://localhost:3000
node server.js

echo.
echo Server stopped. Press any key to close this window.
pause >nul
