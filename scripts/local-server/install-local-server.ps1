param(
    [Parameter(Mandatory)][string]$LanAddress,
    [string]$DatabaseUrl,
    [string]$DataDirectory = 'C:\ProgramData\PlayCoffee',
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'server.env'),
    [int]$HttpsPort = 3443,
    [switch]$DisableHttps,
    [switch]$SkipCertificateTrust,
    [switch]$RegisterStartup,
    [switch]$ConfigureFirewall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function New-RandomSecret {
    $bytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
        return [Convert]::ToBase64String($bytes)
    } finally {
        $generator.Dispose()
    }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $backendEnv = Join-Path $root 'apps\backend\.env'
    if (-not (Test-Path -LiteralPath $backendEnv)) {
        throw 'Indica -DatabaseUrl o configura apps\backend\.env'
    }
    $databaseLine = Get-Content -LiteralPath $backendEnv | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $databaseLine) { throw 'DATABASE_URL no existe en apps\backend\.env' }
    $DatabaseUrl = ($databaseLine -split '=', 2)[1].Trim().Trim('"')
}

$databaseUri = [Uri]$DatabaseUrl
if ($databaseUri.Host -notin @('localhost', '127.0.0.1', '::1')) {
    throw 'El servidor de sucursal requiere PostgreSQL local. DATABASE_URL no apunta a localhost.'
}

$requiresAdministrator = [bool]($RegisterStartup -or $ConfigureFirewall)
& (Join-Path $PSScriptRoot 'test-installation-readiness.ps1') `
    -LanAddress $LanAddress `
    -DatabaseUrl $DatabaseUrl `
    -HttpsPort $HttpsPort `
    -RequireAdministrator:$requiresAdministrator

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js no esta instalado o no esta en PATH' }
if (-not (Get-Command corepack.cmd -ErrorAction SilentlyContinue)) { throw 'Corepack no esta disponible' }
if (-not (Get-Service postgresql* -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running')) {
    throw 'PostgreSQL no esta ejecutandose como servicio de Windows'
}

$certificate = $null
if (-not $DisableHttps) {
    $certificate = & (Join-Path $PSScriptRoot 'new-local-certificate.ps1') -LanAddress $LanAddress -OutputDirectory (Join-Path $DataDirectory 'certificates') -SkipTrust:$SkipCertificateTrust
}
$frontendUrl = if ($DisableHttps) { "http://${LanAddress}:3000" } else { "https://${LanAddress}:$HttpsPort" }
$apiUrl = if ($DisableHttps) { "http://${LanAddress}:3001" } else { $frontendUrl }
$lines = @(
    "PLAYCOFFEE_ROOT=$root",
    "PLAYCOFFEE_DATA=$DataDirectory",
    "DATABASE_URL=$DatabaseUrl",
    'REDIS_URL=redis://localhost:6379',
    "JWT_SECRET=$(New-RandomSecret)",
    "JWT_REFRESH_SECRET=$(New-RandomSecret)",
    "PRINT_AGENT_TOKEN=$(New-RandomSecret)",
    'PRINT_AGENT_ID=playcoffee-local',
    'PRINT_AGENT_API_URL=http://127.0.0.1:3001/api/v1',
    'PRINT_AGENT_POLL_MS=1000',
    'JWT_EXPIRES_IN=15m',
    'JWT_REFRESH_EXPIRES_IN=7d',
    'NODE_ENV=production',
    'PORT=3001',
    'FRONTEND_PORT=3000',
    "HTTPS_ENABLED=$((-not $DisableHttps).ToString().ToLowerInvariant())",
    "HTTPS_PORT=$HttpsPort",
    "CORS_ORIGIN=$frontendUrl",
    "NEXT_PUBLIC_API_URL=$apiUrl",
    "NEXT_PUBLIC_WS_URL=$apiUrl"
)
if ($certificate) {
    $lines += "TLS_PFX_PATH=$($certificate.PfxPath)"
    $lines += "TLS_PFX_PASSWORD=$($certificate.PfxPassword)"
    $lines += "TLS_ROOT_CERT_PATH=$($certificate.RootCertificatePath)"
    $lines += "TLS_ROOT_CERT_THUMBPRINT=$($certificate.RootCertificateThumbprint)"
}
$configParent = Split-Path -Parent $ConfigPath
if ($configParent) { New-Item -ItemType Directory -Force -Path $configParent | Out-Null }
$lines | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

New-Item -ItemType Directory -Force -Path (Join-Path $DataDirectory 'logs'), (Join-Path $DataDirectory 'runtime'), (Join-Path $DataDirectory 'backups') | Out-Null

$corepackDirectory = Join-Path $DataDirectory 'runtime\corepack'
New-Item -ItemType Directory -Force -Path $corepackDirectory | Out-Null
& corepack.cmd enable --install-directory $corepackDirectory pnpm
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la version controlada de pnpm' }
$env:Path = "$corepackDirectory;$env:Path"

$env:NEXT_PUBLIC_API_URL = $apiUrl
$env:NEXT_PUBLIC_WS_URL = $apiUrl
$frontendProductionEnv = Join-Path $root 'apps\frontend\.env.production.local'
@(
    "NEXT_PUBLIC_API_URL=$apiUrl",
    "NEXT_PUBLIC_WS_URL=$apiUrl"
) | Set-Content -LiteralPath $frontendProductionEnv -Encoding UTF8
Push-Location $root
try {
    # --force evita que pnpm deje la instalacion a medias esperando una
    # confirmacion interactiva cuando debe reconstruir node_modules.
    & corepack.cmd pnpm install --frozen-lockfile --force --prod=false
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias' }
    & corepack.cmd pnpm db:generate
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar Prisma Client' }
    & corepack.cmd pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar PlayCoffee' }
} finally {
    Pop-Location
}

& (Join-Path $PSScriptRoot 'start-local-server.ps1') -ConfigPath $ConfigPath
if ($RegisterStartup) {
    & (Join-Path $PSScriptRoot 'register-startup.ps1') -ConfigPath $ConfigPath
    & (Join-Path $PSScriptRoot 'register-backup.ps1') -ConfigPath $ConfigPath
}
if ($ConfigureFirewall) {
    & (Join-Path $PSScriptRoot 'configure-firewall.ps1') -HttpsPort $HttpsPort
}

& (Join-Path $PSScriptRoot 'verify-local-installation.ps1') -ConfigPath $ConfigPath -TestBackup

Write-Host "Instalacion local terminada. Abre $frontendUrl desde las tablets." -ForegroundColor Green
if ($certificate) {
    Write-Host "Instala y confia este certificado en cada tablet: $($certificate.RootCertificatePath)" -ForegroundColor Yellow
}
