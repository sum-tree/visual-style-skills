@echo off
setlocal
title Visual Style Atelier

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20.9 or newer first.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [ERROR] Dependencies are missing.
  echo Run npm install in this folder, then start again.
  pause
  exit /b 1
)

netstat -ano -p TCP | findstr /R /C:":7777 .*LISTENING" >nul
if not errorlevel 1 (
  echo [INFO] Port 7777 is already running. Opening the UI...
  start "" "http://localhost:7777/"
  exit /b 0
)

netstat -ano -p TCP | findstr /R /C:"127.0.0.1:7897 .*LISTENING" >nul
if errorlevel 1 (
  echo [WARN] Clash proxy 127.0.0.1:7897 is not listening.
  echo [WARN] The UI will start, but OpenAI requests may fail on this network.
) else (
  set "HTTP_PROXY=http://127.0.0.1:7897"
  set "HTTPS_PROXY=http://127.0.0.1:7897"
  set "NODE_USE_ENV_PROXY=1"
  echo [INFO] OpenAI traffic will use Clash proxy 127.0.0.1:7897.
)

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$deadline = (Get-Date).AddSeconds(45); while ((Get-Date) -lt $deadline) { try { $response = Invoke-WebRequest -Uri 'http://localhost:7777/' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { Start-Process 'http://localhost:7777/'; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

echo [INFO] Starting Visual Style Atelier at http://localhost:7777/ ...
call npm run dev
set "appExitCode=%ERRORLEVEL%"

if not "%appExitCode%"=="0" (
  echo.
  echo [ERROR] The app stopped with exit code %appExitCode%.
  pause
)

exit /b %appExitCode%
