param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskName = 'PlayCoffee Local Server'
$startScript = (Resolve-Path (Join-Path $PSScriptRoot 'start-local-server.ps1')).Path
$resolvedConfig = (Resolve-Path $ConfigPath).Path
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$startScript`" -ConfigPath `"$resolvedConfig`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Inicia el servidor local de PlayCoffee al entrar a Windows.' -Force | Out-Null
Write-Host "Tarea automatica registrada: $taskName" -ForegroundColor Green
