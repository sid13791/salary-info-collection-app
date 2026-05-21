@echo off
setlocal enabledelayedexpansion
title Salary Info Collection App
cd /d "%~dp0"

REM ============================================================
REM  One-click launcher. Double-click this file to run the app.
REM  Close this window to stop the app.
REM ============================================================

REM --- First run: install dependencies if node_modules is missing ---
if not exist "node_modules\" (
  echo.
  echo [First run] Installing dependencies. This takes ~1 minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Check that Node.js 24+ is installed.
    pause
    exit /b 1
  )
)

REM --- First run: initialize the database with sample data ---
if not exist "data\app.db" (
  echo.
  echo [First run] Setting up local database...
  call npm run db:init
  echo.
  echo [First run] Create your admin login.
  set /p ADMIN_EMAIL=  Admin email:
  set /p ADMIN_PW=  Admin password (min 8 chars):
  call npm run db:create-admin -- "!ADMIN_EMAIL!" "!ADMIN_PW!"
  if errorlevel 1 (
    echo.
    echo ERROR: Admin creation failed. Try running this script again.
    pause
    exit /b 1
  )
)

REM --- First run: build the production bundle (~30 seconds) ---
if not exist ".next\" (
  echo.
  echo [First run] Building app. This takes ~30 seconds...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo ERROR: Build failed.
    pause
    exit /b 1
  )
)

REM --- Detect local IP for managers on the same network ---
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "127.0.0.1"') do (
  set "LOCAL_IP=%%i"
  set "LOCAL_IP=!LOCAL_IP: =!"
  goto :got_ip
)
:got_ip

echo.
echo ============================================================
echo   Salary Info Collection App is starting...
echo.
echo   On THIS computer:   http://localhost:3000
if defined LOCAL_IP echo   On your network:    http://!LOCAL_IP!:3000
echo.
echo   Managers on the same WiFi can use the network URL.
echo   Close this window to stop the app.
echo ============================================================
echo.

REM --- Open the browser after 4 seconds (gives server time to bind) ---
start "" /B cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

REM --- Run the server in this window. Ctrl+C or close window stops it. ---
call npm run start
