@echo off
setlocal
title Instalador de PlayCoffee
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-server\install-new-computer.ps1"
if errorlevel 1 (
  echo.
  echo Revisa el error indicado arriba. Si faltan permisos, ejecuta este archivo como administrador.
)
echo.
pause
