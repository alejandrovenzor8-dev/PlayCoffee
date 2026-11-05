param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force

$config = Get-PlayCoffeeEnvironment -Path $ConfigPath
Set-PlayCoffeeEnvironment -Values $config
$root = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_ROOT'
$data = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_DATA'
$backend = Join-Path $root 'apps\backend'
$frontend = Join-Path $root 'apps\frontend'
$pidFile = Join-Path $data 'runtime\processes.json'
$logDirectory = Join-Path $data 'logs'

New-Item -ItemType Directory -Force -Path (Split-Path $pidFile), $logDirectory | Out-Null

if (Test-Path -LiteralPath $pidFile) {
    $stored = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $storedRecords = @($stored.backend, $stored.frontend)
    if ($stored.PSObject.Properties.Name -contains 'printAgent' -and $stored.printAgent) { $storedRecords += $stored.printAgent }
    if ($stored.PSObject.Properties.Name -contains 'https' -and $stored.https) { $storedRecords += $stored.https }
    $running = @($storedRecords | Where-Object { Test-PlayCoffeeStoredProcess $_ })
    if ($running.Count -gt 0) {
        throw 'PlayCoffee ya tiene procesos activos. Ejecuta status-local-server.ps1 para revisarlos.'
    }
    Remove-Item -LiteralPath $pidFile -Force
}

$node = (Get-Command node -ErrorAction Stop).Source
$prisma = Join-Path $backend 'node_modules\.bin\prisma.cmd'
$backendEntry = Join-Path $backend 'dist\src\main.js'
$nextEntry = Join-Path $frontend 'node_modules\next\dist\bin\next'
$proxyEntry = Join-Path $root 'scripts\local-server\https-proxy.mjs'
$printAgentEntry = Join-Path $root 'scripts\print-agent\print-agent.mjs'

foreach ($required in @($prisma, $backendEntry, $nextEntry, $printAgentEntry, (Join-Path $frontend '.next'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Falta artefacto de produccion: $required. Ejecuta install-local-server.ps1."
    }
}

Push-Location $backend
try {
    & $prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar las migraciones locales' }
} finally {
    Pop-Location
}

$backendProcess = $null
$frontendProcess = $null
$proxyProcess = $null
$printAgentProcess = $null
try {
    $backendProcess = Start-Process -FilePath $node -ArgumentList @("`"$backendEntry`"") -WorkingDirectory $backend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'backend.out.log') -RedirectStandardError (Join-Path $logDirectory 'backend.error.log')
    $frontendPort = if ($config['FRONTEND_PORT']) { $config['FRONTEND_PORT'] } else { '3000' }
    $frontendHost = if ($config['HTTPS_ENABLED'] -eq 'true') { '127.0.0.1' } else { '0.0.0.0' }
    $frontendProcess = Start-Process -FilePath $node -ArgumentList @("`"$nextEntry`"", 'start', '-H', $frontendHost, '-p', $frontendPort) -WorkingDirectory $frontend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'frontend.out.log') -RedirectStandardError (Join-Path $logDirectory 'frontend.error.log')
    if ($config['HTTPS_ENABLED'] -eq 'true') {
        foreach ($requiredTls in @($proxyEntry, $config['TLS_PFX_PATH'])) {
            if (-not (Test-Path -LiteralPath $requiredTls)) { throw "Falta archivo HTTPS: $requiredTls" }
        }
        $proxyProcess = Start-Process -FilePath $node -ArgumentList @("`"$proxyEntry`"") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'https.out.log') -RedirectStandardError (Join-Path $logDirectory 'https.error.log')
    }
    $printAgentProcess = Start-Process -FilePath $node -ArgumentList @("`"$printAgentEntry`"") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'print-agent.out.log') -RedirectStandardError (Join-Path $logDirectory 'print-agent.error.log')
} catch {
    foreach ($started in @($printAgentProcess, $proxyProcess, $frontendProcess, $backendProcess)) {
        if ($started) { Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue }
    }
    throw
}

$records = [ordered]@{
    backend = [ordered]@{ pid = $backendProcess.Id; startedAtUtcTicks = $backendProcess.StartTime.ToUniversalTime().Ticks; executable = $node }
    frontend = [ordered]@{ pid = $frontendProcess.Id; startedAtUtcTicks = $frontendProcess.StartTime.ToUniversalTime().Ticks; executable = $node }
    https = if ($proxyProcess) { [ordered]@{ pid = $proxyProcess.Id; startedAtUtcTicks = $proxyProcess.StartTime.ToUniversalTime().Ticks; executable = $node } } else { $null }
    printAgent = [ordered]@{ pid = $printAgentProcess.Id; startedAtUtcTicks = $printAgentProcess.StartTime.ToUniversalTime().Ticks; executable = $node }
}
$records | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8

$backendPort = if ($config['PORT']) { $config['PORT'] } else { '3001' }
$backendHealthy = Wait-PlayCoffeeUrl -Url "http://127.0.0.1:$backendPort/health" -TimeoutSeconds 60
$frontendHealthy = Wait-PlayCoffeeUrl -Url "http://127.0.0.1:$frontendPort" -TimeoutSeconds 60
$printAgentHealthy = $printAgentProcess -and -not $printAgentProcess.HasExited
if (-not $backendHealthy -or -not $frontendHealthy -or -not $printAgentHealthy) {
    & (Join-Path $PSScriptRoot 'stop-local-server.ps1') -ConfigPath $ConfigPath
    throw "PlayCoffee no inicio correctamente. Revisa los logs en $logDirectory"
}

Write-Host "PlayCoffee local esta listo en $($config['CORS_ORIGIN'])" -ForegroundColor Green
