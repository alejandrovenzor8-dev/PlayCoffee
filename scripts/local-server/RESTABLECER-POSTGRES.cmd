@echo off
setlocal
title Restablecer contrasena PostgreSQL - PlayCoffee
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-postgres-password.ps1"
echo.
pause
