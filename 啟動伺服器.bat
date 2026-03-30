@echo off
chcp 65001 >nul
title AgriAnalytics HQ

echo ============================================
echo    AgriAnalytics HQ 啟動中...
echo ============================================
echo.

:: 等 1 秒後開瀏覽器
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 啟動 server
cd /d "%~dp0"
node server.js

:: 如果 server 停了，暫停讓使用者看到錯誤訊息
echo.
echo Server 已停止。按任意鍵關閉...
pause >nul
