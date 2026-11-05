@echo off
setlocal
title Actualizar PlayCoffee
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-server\update-local-server.ps1"
echo.
pause
