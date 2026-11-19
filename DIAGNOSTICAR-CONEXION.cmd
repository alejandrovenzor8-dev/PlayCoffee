@echo off
setlocal
title Diagnostico de conexion PlayCoffee
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-server\diagnose-client-connection.ps1" -AskPublicUrl -ReportPath "%~dp0diagnostico-conexion.txt"
echo.
echo Informe guardado en diagnostico-conexion.txt junto a este archivo.
echo.
pause
