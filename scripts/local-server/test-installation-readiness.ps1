param(
    [string]$LanAddress,
    [string]$DatabaseUrl,
    [int]$HttpsPort = 3443,
    [switch]$RequireAdministrator
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force

$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name, [bool]$Passed, [string]$Detail) {
    $checks.Add([pscustomobject]@{ Check = $Name; Passed = $Passed; Detail = $Detail })
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = Get-Command node -ErrorAction SilentlyContinue
$corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
Add-Check 'Node.js' ([bool]$node) $(if ($node) { (& node --version) } else { 'No encontrado en PATH' })
Add-Check 'Corepack' ([bool]$corepack) $(if ($corepack) { (& corepack.cmd --version) } else { 'No encontrado en PATH' })

$postgresService = Get-Service postgresql* -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running' | Select-Object -First 1
Add-Check 'Servicio PostgreSQL' ([bool]$postgresService) $(if ($postgresService) { $postgresService.Name } else { 'No hay un servicio PostgreSQL activo' })

foreach ($toolName in @('psql', 'pg_dump', 'pg_restore')) {
    try {
        $toolPath = Get-PlayCoffeePostgresTool -Name $toolName
        Add-Check $toolName $true $toolPath
    } catch {
        Add-Check $toolName $false $_.Exception.Message
    }
}

$requiredFiles = @(
    'package.json',
    'pnpm-lock.yaml',
    'apps\backend\prisma\schema.prisma',
    'scripts\print-agent\print-agent.mjs',
    'scripts\local-server\https-proxy.mjs'
)
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $root $_)) })
Add-Check 'Archivos del proyecto' ($missingFiles.Count -eq 0) $(if ($missingFiles.Count) { "Faltan: $($missingFiles -join ', ')" } else { 'Completos' })

if ($LanAddress) {
    $parsedAddress = $null
    $validAddress = [Net.IPAddress]::TryParse($LanAddress, [ref]$parsedAddress) -and $parsedAddress.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork
    Add-Check 'IP del servidor' $validAddress $(if ($validAddress) { $LanAddress } else { 'Debe ser una IPv4 valida' })
}

$portInUse = Get-NetTCPConnection -LocalPort $HttpsPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
Add-Check "Puerto HTTPS $HttpsPort" (-not [bool]$portInUse) $(if ($portInUse) { "Ocupado por PID $($portInUse.OwningProcess)" } else { 'Disponible' })

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Add-Check 'Administrador' ((-not $RequireAdministrator) -or $isAdministrator) $(if ($isAdministrator) { 'Si' } else { 'No; necesario para firewall y tareas automaticas' })

if ($DatabaseUrl) {
    try {
        $databaseUri = [Uri]$DatabaseUrl
        $localDatabase = $databaseUri.Host -in @('localhost', '127.0.0.1', '::1')
        Add-Check 'PostgreSQL local' $localDatabase $(if ($localDatabase) { $databaseUri.Host } else { 'DATABASE_URL no apunta a esta computadora' })
        $userInfo = $databaseUri.UserInfo -split ':', 2
        $previousPassword = $env:PGPASSWORD
        try {
            $env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
            $psql = Get-PlayCoffeePostgresTool -Name 'psql'
            $output = & $psql --host $databaseUri.Host --port $databaseUri.Port --username ([Uri]::UnescapeDataString($userInfo[0])) --dbname $databaseUri.AbsolutePath.Trim('/') --tuples-only --no-align --command 'SELECT 1' 2>&1
            Add-Check 'Conexion a la base' ($LASTEXITCODE -eq 0 -and ($output -join '').Trim() -eq '1') $(if ($LASTEXITCODE -eq 0) { 'Correcta' } else { 'No se pudo conectar' })
        } finally {
            $env:PGPASSWORD = $previousPassword
        }
    } catch {
        Add-Check 'Conexion a la base' $false $_.Exception.Message
    }
}

$checks | Format-Table -AutoSize
$failed = @($checks | Where-Object { -not $_.Passed })
if ($failed.Count) {
    Write-Error "Diagnostico no aprobado: $($failed.Count) requisito(s) pendiente(s)."
    exit 1
}
Write-Host 'Diagnostico aprobado. La computadora esta lista para instalar PlayCoffee.' -ForegroundColor Green
