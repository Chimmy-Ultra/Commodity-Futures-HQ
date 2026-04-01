@echo off
title Commodity HQ
cd /d "%~dp0"

echo Starting Commodity HQ...
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

node server.js

echo.
echo Server stopped. Press any key to close...
pause >nul
