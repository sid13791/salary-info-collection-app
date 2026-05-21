@echo off
setlocal enabledelayedexpansion
title Reset Admin Password
cd /d "%~dp0"

echo.
echo This will reset an admin user's password.
echo.
set /p ADMIN_EMAIL=  Admin email:
set /p ADMIN_PW=  New password (min 8 chars):
echo.
call npm run db:create-admin -- "!ADMIN_EMAIL!" "!ADMIN_PW!"
echo.
pause
