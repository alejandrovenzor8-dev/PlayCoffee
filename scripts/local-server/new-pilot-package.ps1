param(
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmm'),
    [string]$OutputDirectory = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'releases')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
$staging = [IO.Path]::GetFullPath((Join-Path $output ".staging-$Version"))
$packageRoot = Join-Path $staging 'PlayCoffee'
$zipPath = Join-Path $output "PlayCoffee-Pilot-$Version.zip"
$hashPath = "$zipPath.sha256"

if (-not $staging.StartsWith($output + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La carpeta temporal debe permanecer dentro del directorio de salida.'
}
if (Test-Path -LiteralPath $staging) {
    throw "Ya existe la carpeta temporal: $staging"
}
if (Test-Path -LiteralPath $zipPath) {
    throw "Ya existe el paquete: $zipPath"
}

New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
try {
    $rootFiles = @(
        '.dockerignore',
        '.env.example',
        '.gitignore',
        'docker-compose.yml',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'turbo.json',
        'README.md',
        'SERVIDOR-LOCAL-WINDOWS.md'
    )
    foreach ($name in $rootFiles) {
        $source = Join-Path $root $name
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $name)
        }
    }

    foreach ($directory in @('apps', 'packages', 'scripts')) {
        $source = Join-Path $root $directory
        $destination = Join-Path $packageRoot $directory
        & robocopy.exe $source $destination /E /NFL /NDL /NJH /NJS /NP /XD node_modules .next dist coverage .turbo .playwright-cli /XF .env '.env.*' server.env '*.log'
        if ($LASTEXITCODE -ge 8) { throw "No se pudo copiar $directory (robocopy $LASTEXITCODE)" }
    }

    $forbidden = @(
        Get-ChildItem -LiteralPath $packageRoot -Recurse -Force -File |
            Where-Object {
                ($_.Name -like '.env*' -and $_.Name -ne '.env.example') -or
                $_.Name -eq 'server.env' -or
                $_.FullName -match '\\node_modules\\|\\\.next\\|\\dist\\'
            }
    )
    if ($forbidden.Count) {
        throw "El paquete contiene archivos prohibidos: $($forbidden.FullName -join ', ')"
    }

    Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath $hashPath -Encoding ASCII
    Write-Host "Paquete creado: $zipPath" -ForegroundColor Green
    Write-Host "SHA-256: $hash" -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}
