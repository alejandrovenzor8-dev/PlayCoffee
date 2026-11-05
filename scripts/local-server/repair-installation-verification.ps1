param([string]$ConfigPath = 'C:\ProgramData\PlayCoffee\server.env')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Ejecuta REPARAR-VERIFICACION.cmd como administrador.' }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $ConfigPath) {
        if ($line.Trim() -and -not $line.Trim().StartsWith('#')) {
            $parts = $line -split '=', 2
            if ($parts.Count -eq 2) { $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"') }
        }
    }
    $root = (Resolve-Path -LiteralPath $values['PLAYCOFFEE_ROOT']).Path
    $data = (Resolve-Path -LiteralPath $values['PLAYCOFFEE_DATA']).Path
    $destination = Join-Path $root 'scripts\local-server'
    $backup = Join-Path $data ('updates\reparacion-verificacion-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    foreach ($name in @('verify-local-installation.ps1', 'status-local-server.ps1')) {
        $target = Join-Path $destination $name
        if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Falta $target. No se reconoce la instalacion." }
        Copy-Item -LiteralPath $target -Destination (Join-Path $backup $name)
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target -Force
    }
    & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $destination 'verify-local-installation.ps1') -ConfigPath $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Se corrigio el verificador, pero detecta servicios no saludables. Comparte los resultados mostrados arriba.' }
    if ($values['HTTPS_ENABLED'] -eq 'true') {
        Invoke-WebRequest -Uri "$($values['CORS_ORIGIN'])/health" -UseBasicParsing -TimeoutSec 15 | Out-Null
    }
    Write-Host 'REPARACION Y VERIFICACION COMPLETADAS. Recarga PlayCoffee en todos los dispositivos.' -ForegroundColor Green
    Write-Host 'No se cambiaron datos, contrasenas ni configuracion. No es necesario repetir la actualizacion por este error.'
} catch {
    Write-Host "VERIFICACION NO COMPLETADA: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
