param(
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [string]$OutputDirectory = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'releases'),
    [string]$PrerequisiteDirectory,
    [switch]$UpdateOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($Version -notmatch '^[a-zA-Z0-9._-]+$') { throw 'Version invalida.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$output = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
$staging = [IO.Path]::GetFullPath((Join-Path $output ".installer-$Version"))
$packageName = if ($UpdateOnly) { 'PlayCoffee-Actualizacion' } else { 'PlayCoffee-Instalador' }
$package = Join-Path $staging $packageName
$zip = Join-Path $output "$packageName-$Version.zip"
if ($UpdateOnly -and $PrerequisiteDirectory) { throw 'Una actualizacion no incluye instaladores de PostgreSQL o Node.' }
if (-not $staging.StartsWith($output + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'La carpeta temporal debe estar dentro de releases.' }
if ((Test-Path -LiteralPath $staging) -or (Test-Path -LiteralPath $zip)) { throw 'Ya existe un paquete con esta version.' }
New-Item -ItemType Directory -Force -Path $package | Out-Null
try {
    $rootFiles = @('ACTUALIZAR.cmd', 'ACTUALIZACION.md', 'DIAGNOSTICO-PRODUCCION.md', 'GUIA-TRES-IMPRESORAS.md', 'SERVIDOR-LOCAL-WINDOWS.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json')
    if (-not $UpdateOnly) { $rootFiles += @('INSTALAR.cmd', 'INSTALACION-EQUIPO-NUEVO.md') }
    foreach ($name in $rootFiles) {
        Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $package $name)
    }
    foreach ($directory in @('apps', 'packages', 'scripts')) {
        & robocopy.exe (Join-Path $root $directory) (Join-Path $package $directory) /E /NFL /NDL /NJH /NJS /NP /XD node_modules .next dist coverage .turbo .playwright-cli .git /XF '.env*' 'server*.env' '*.log' '*.dump' '*.pfx' '*.key' '*.pem' '*.tsbuildinfo' '*.pid' 'tsconfig.build.tsbuildinfo'
        if ($LASTEXITCODE -ge 8) { throw "No se pudo copiar $directory." }
    }
    if ($PrerequisiteDirectory) {
        $prerequisites = @{
            'postgresql-18.6-5-windows-x64.exe' = '227E2BC08091B4C2B8338C7D61B11D057F895711480B006F90BFCFCD2410A58A'
            'node-v22.23.4-win-x64.zip' = 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'
        }
        $bundledDirectory = Join-Path $package 'prerequisites'
        New-Item -ItemType Directory -Path $bundledDirectory -Force | Out-Null
        foreach ($entry in $prerequisites.GetEnumerator()) {
            $prerequisite = Join-Path $PrerequisiteDirectory $entry.Key
            if (-not (Test-Path -LiteralPath $prerequisite -PathType Leaf)) { throw "Falta $prerequisite" }
            if ((Get-FileHash -LiteralPath $prerequisite -Algorithm SHA256).Hash -ne $entry.Value) { throw "SHA-256 incorrecto: $($entry.Key)" }
            Copy-Item -LiteralPath $prerequisite -Destination $bundledDirectory
        }
    }
    $files = @(Get-ChildItem -LiteralPath $package -Recurse -Force -File)
    $forbidden = @($files | Where-Object { $_.Name -like '*.env' -or $_.Name -like '.env*' -or $_.Extension -in @('.dump', '.pfx', '.key', '.pem') -or $_.FullName -match '\\(node_modules|\.next|\.git|dist|coverage)\\' })
    if ($forbidden.Count) { throw "Archivos no permitidos: $($forbidden.Name -join ', ')" }
    $entries = @($files | Sort-Object FullName | ForEach-Object { [ordered]@{ path = $_.FullName.Substring($package.Length + 1); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } })
    [ordered]@{ version = $Version; kind = $(if ($UpdateOnly) { 'update' } else { 'installer' }); database = $(if ($UpdateOnly) { 'preserve-existing' } else { 'empty' }); files = $entries } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $package 'package-manifest.json') -Encoding UTF8
    Compress-Archive -LiteralPath $package -DestinationPath $zip -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($zip))" | Set-Content -LiteralPath "$zip.sha256" -Encoding ASCII
    Write-Host "Paquete creado: $zip" -ForegroundColor Green
    Write-Host "Archivos: $($files.Count). SHA-256: $hash"
} finally {
    # Resolve again before recursively deleting only this invocation's staging tree.
    if (Test-Path -LiteralPath $staging) {
        $resolved = (Resolve-Path -LiteralPath $staging).Path
        if (-not $resolved.StartsWith($output + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta temporal fuera del directorio de salida.' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
