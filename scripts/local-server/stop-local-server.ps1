param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'Process.Ownership.psm1') -Force

$config = Get-PlayCoffeeEnvironment -Path $ConfigPath
$data = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_DATA'
$pidFile = Join-Path $data 'runtime\processes.json'
if (Test-Path -LiteralPath $pidFile) {
$stored = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$storedRecords = @($stored.frontend, $stored.backend)
if ($stored.PSObject.Properties.Name -contains 'printAgent' -and $stored.printAgent) { $storedRecords = @($stored.printAgent) + $storedRecords }
if ($stored.PSObject.Properties.Name -contains 'https' -and $stored.https) { $storedRecords = @($stored.https) + $storedRecords }
foreach ($record in $storedRecords) {
    if (-not $record) { continue }
    if (Test-PlayCoffeeStoredProcess $record) {
        Stop-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
        Wait-Process -Id ([int]$record.pid) -Timeout 10 -ErrorAction SilentlyContinue
        if (Test-PlayCoffeeStoredProcess $record) {
            Stop-Process -Id ([int]$record.pid) -Force -ErrorAction SilentlyContinue
            Wait-Process -Id ([int]$record.pid) -Timeout 5 -ErrorAction SilentlyContinue
        }
    }
}
}
# A previous interrupted start/update may leave live processes without valid PID records.
Stop-PlayCoffeeOwnedProcesses -Root (Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_ROOT')
if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
Write-Host 'PlayCoffee local fue detenido.' -ForegroundColor Green
