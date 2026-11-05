@echo off
setlocal
title Reparar verificacion de PlayCoffee
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-installation-verification.ps1"
echo.
pause
