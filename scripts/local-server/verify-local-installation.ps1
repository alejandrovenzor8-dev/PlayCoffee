param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env'),
    [switch]$TestBackup
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force

$config = Get-PlayCoffeeEnvironment -Path $ConfigPath
$data = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_DATA'
& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'status-local-server.ps1') -ConfigPath $ConfigPath
if ($LASTEXITCODE -ne 0) { throw 'Los procesos locales no estan saludables' }

if ($config['HTTPS_ENABLED'] -eq 'true') {
    foreach ($name in @('TLS_PFX_PATH', 'TLS_ROOT_CERT_PATH')) {
        if (-not (Test-Path -LiteralPath $config[$name] -PathType Leaf)) {
            throw "Falta $name en $($config[$name])"
        }
    }
}

if ($TestBackup) {
    & (Join-Path $PSScriptRoot 'backup-local-server.ps1') -ConfigPath $ConfigPath
    $latestBackup = Get-ChildItem -LiteralPath (Join-Path $data 'backups') -Filter 'playcoffee-*.dump' -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latestBackup -or $latestBackup.Length -le 0) {
        throw 'La prueba de respaldo no produjo un archivo valido'
    }
    Write-Host "Respaldo verificado: $($latestBackup.FullName)" -ForegroundColor Green
}

Write-Host 'Instalacion local verificada correctamente.' -ForegroundColor Green
