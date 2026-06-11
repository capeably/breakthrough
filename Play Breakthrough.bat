@echo off
setlocal
cd /d "%~dp0"
title Breakthrough

where npx >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this PC.
  echo   Install it from https://nodejs.org  then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo      BREAKTHROUGH  -  local game server
echo   ============================================
echo.
echo   Your browser opens automatically in a moment.
echo   If a tab doesn't appear, go to:  http://localhost:8787
echo   (If the page looks blank, refresh it once.)
echo.
echo   KEEP THIS WINDOW OPEN while you play.
echo   Close it, or press Ctrl+C, to stop the server.
echo.

rem Wait until the server answers, then open the default browser.
start "" powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:8787'; for($i=0;$i -lt 90;$i++){try{$null=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2; break}catch{Start-Sleep -Milliseconds 500}}; Start-Process $u"

npx -y serve . -l 8787

echo.
echo   Server stopped.
pause
