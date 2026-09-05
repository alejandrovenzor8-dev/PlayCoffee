param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env'),
    [string]$At = '02:00'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskName = 'PlayCoffee Local Backup'
$backupScript = (Resolve-Path (Join-Path $PSScriptRoot 'backup-local-server.ps1')).Path
$resolvedConfig = (Resolve-Path $ConfigPath).Path
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$backupTime = [DateTime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$backupScript`" -ConfigPath `"$resolvedConfig`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $backupTime
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Crea el respaldo diario de PostgreSQL para PlayCoffee.' -Force | Out-Null
Write-Host "Respaldo automatico registrado: $taskName a las $At" -ForegroundColor Green
