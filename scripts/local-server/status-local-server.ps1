param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force

$config = Get-PlayCoffeeEnvironment -Path $ConfigPath
$data = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_DATA'
$pidFile = Join-Path $data 'runtime\processes.json'
$backendPort = if ($config['PORT']) { $config['PORT'] } else { '3001' }
$frontendPort = if ($config['FRONTEND_PORT']) { $config['FRONTEND_PORT'] } else { '3000' }

$processStatus = [ordered]@{ backend = $false; frontend = $false; https = $null; printAgent = $false }
if (Test-Path -LiteralPath $pidFile) {
    $stored = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $processStatus.backend = Test-PlayCoffeeStoredProcess $stored.backend
    $processStatus.frontend = Test-PlayCoffeeStoredProcess $stored.frontend
    if ($stored.PSObject.Properties.Name -contains 'https' -and $stored.https) {
        $processStatus.https = Test-PlayCoffeeStoredProcess $stored.https
    }
    if ($stored.PSObject.Properties.Name -contains 'printAgent' -and $stored.printAgent) {
        $processStatus.printAgent = Test-PlayCoffeeStoredProcess $stored.printAgent
    }
}

$database = $false
$frontend = $false
try { $database = (Invoke-WebRequest -Uri "http://127.0.0.1:$backendPort/health" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
try { $frontend = (Invoke-WebRequest -Uri "http://127.0.0.1:$frontendPort" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}

[pscustomobject]@{
    BackendProcess = $processStatus.backend
    FrontendProcess = $processStatus.frontend
    HttpsProcess = $processStatus.https
    PrintAgentProcess = $processStatus.printAgent
    DatabaseHealth = $database
    FrontendHealth = $frontend
    TabletUrl = $config['CORS_ORIGIN']
    Logs = (Join-Path $data 'logs')
} | Format-List

$httpsHealthy = $config['HTTPS_ENABLED'] -ne 'true' -or $processStatus.https -eq $true
if (-not ($processStatus.backend -and $processStatus.frontend -and $processStatus.printAgent -and $httpsHealthy -and $database -and $frontend)) { exit 1 }
