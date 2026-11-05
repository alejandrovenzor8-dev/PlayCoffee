param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env'),
    [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force
if ($RetentionDays -lt 1) { throw 'RetentionDays debe ser mayor o igual a 1' }

$config = Get-PlayCoffeeEnvironment -Path $ConfigPath
Set-PlayCoffeeEnvironment -Values $config
$data = Get-PlayCoffeeRuntimePath -Config $config -Name 'PLAYCOFFEE_DATA'
$databaseUrl = [Uri]$config['DATABASE_URL']
$userInfo = $databaseUrl.UserInfo -split ':', 2
if ($userInfo.Count -ne 2) { throw 'DATABASE_URL debe incluir usuario y contrasena' }

$pgDump = Get-PlayCoffeePostgresTool -Name 'pg_dump'

$backupDirectory = Join-Path $data 'backups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$databaseName = $databaseUrl.AbsolutePath.Trim('/')
$destination = Join-Path $backupDirectory ("playcoffee-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
    & $pgDump --host $databaseUrl.Host --port $databaseUrl.Port --username ([Uri]::UnescapeDataString($userInfo[0])) --dbname $databaseName --format custom --file $destination
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump no pudo crear el respaldo' }
} finally {
    $env:PGPASSWORD = $previousPassword
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $backupDirectory -Filter 'playcoffee-*.dump' -File | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
Write-Host "Respaldo creado: $destination" -ForegroundColor Green
