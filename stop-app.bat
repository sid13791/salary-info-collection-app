@echo off
title Stop Salary Info App
echo Stopping the app...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
  echo The app was not running.
) else (
  echo Stopped.
)
timeout /t 2 /nobreak >nul
