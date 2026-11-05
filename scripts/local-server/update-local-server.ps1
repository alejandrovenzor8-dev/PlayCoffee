param([string]$ConfigPath = 'C:\ProgramData\PlayCoffee\server.env')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force
$lock = $null
$backupDirectory = $null
$stage = 'Comprobar instalacion'
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Ejecuta ACTUALIZAR.cmd como administrador de Windows.' }
    $config = Get-PlayCoffeeEnvironment -Path $ConfigPath
    Set-PlayCoffeeEnvironment -Values $config
    $root = (Resolve-Path -LiteralPath $config['PLAYCOFFEE_ROOT']).Path
    $data = (Resolve-Path -LiteralPath $config['PLAYCOFFEE_DATA']).Path
    if ($data -eq $root -or $data.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'La carpeta de respaldos debe estar fuera del programa para evitar copias recursivas.' }
    $source = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    if ($source -eq $root -or $source.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Extrae el paquete en Descargas, fuera de la carpeta instalada.' }
    $manifest = Get-Content -LiteralPath (Join-Path $source 'package-manifest.json') -Raw | ConvertFrom-Json
    $files = @($manifest.files | Where-Object { $_.path -notlike 'prerequisites\*' })
    foreach ($file in $files) {
        $path = [IO.Path]::GetFullPath((Join-Path $source $file.path))
        $target = [IO.Path]::GetFullPath((Join-Path $root $file.path))
        if (-not $path.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $target.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta invalida en el paquete.' }
        if ($file.path -match '(^|[\\/])\.env|\.env$|\.(dump|pfx|key|pem)$') { throw 'El paquete intenta reemplazar datos o configuracion privada.' }
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-FileHash -LiteralPath $path).Hash -ne $file.sha256) { throw "Archivo incompleto o modificado: $($file.path)" }
    }
    $pnpm = Join-Path $data 'runtime\tools\node_modules\.bin\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $pnpm)) { throw 'No se encontro pnpm de la instalacion. Requiere revisar el runtime existente.' }
    $env:Path = "$(Split-Path -Parent $pnpm);$env:Path"
    Get-Command node -ErrorAction Stop | Out-Null
    $dump = Get-PlayCoffeePostgresTool -Name 'pg_dump'
    $restore = Get-PlayCoffeePostgresTool -Name 'pg_restore'
    $uri = [Uri]$config['DATABASE_URL']
    if ($uri.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'Esta actualizacion requiere la base local del servidor.' }
    Write-Host "Actualizar PlayCoffee en $root" -ForegroundColor Cyan
    Write-Host 'Cierra caja y termina las operaciones en todos los dispositivos. Requiere Internet; el sistema estara detenido mientras se actualiza.' -ForegroundColor Yellow
    if ((Read-Host 'Escribe ACTUALIZAR para continuar') -cne 'ACTUALIZAR') { Write-Host 'Cancelado sin cambios.'; exit 0 }
    $lock = [IO.File]::Open((Join-Path $data 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $backupDirectory = Join-Path $data ('updates\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $stage = 'Detener aplicacion y respaldar'
    # Child process isolates scripts that use exit, while preserving the runtime environment.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop-local-server.ps1') -ConfigPath $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener PlayCoffee.' }
    $ports = @([int]$config['PORT'], [int]$config['FRONTEND_PORT'])
    if ($config['HTTPS_ENABLED'] -eq 'true') { $ports += [int]$config['HTTPS_PORT'] }
    foreach ($port in $ports) {
        $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        if ($listeners.Count) {
            $details = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
                $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$_" -ErrorAction Stop
                "PID $_, programa $($owner.Name), ejecutable $($owner.ExecutablePath)"
            }) -join '; '
            throw "Puerto $port ocupado por un proceso no identificado como esta instalacion: $details. No se detuvo ese proceso ni se reemplazaron archivos. Cierra la consola o servicio que lo inicia y reintenta."
        }
    }
    $previousPassword = $env:PGPASSWORD
    try {
        $userInfo = $uri.UserInfo -split ':', 2
        $env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
        $backup = Join-Path $backupDirectory 'database.dump'
        & $dump -h $uri.Host -p $uri.Port -U ([Uri]::UnescapeDataString($userInfo[0])) -d $uri.AbsolutePath.Trim('/') -Fc -f $backup
        if ($LASTEXITCODE -ne 0) { throw 'Fallo el respaldo de base; no se reemplazaran archivos.' }
        & $restore --list $backup | Out-Null
        if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $backup).Length -eq 0) { throw 'El respaldo no paso la verificacion.' }
    } finally { $env:PGPASSWORD = $previousPassword }
    Copy-Item -LiteralPath $ConfigPath -Destination (Join-Path $backupDirectory 'server.env')
    & robocopy.exe $root (Join-Path $backupDirectory 'programa-anterior') /E /NFL /NDL /NJH /NJS /NP /XD node_modules .next dist .git .turbo releases /XF '*.log'
    if ($LASTEXITCODE -ge 8) { throw 'No se pudo respaldar el programa anterior.' }
    $stage = 'Actualizar programa y compilar'
    foreach ($file in $files) {
        $target = Join-Path $root $file.path
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath (Join-Path $source $file.path) -Destination $target -Force
    }
    Push-Location $root
    try {
        & $pnpm install --frozen-lockfile --prod=false
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
        & $pnpm db:generate
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar Prisma.' }
        & $pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el programa.' }
    } finally { Pop-Location }
    $stage = 'Aplicar migraciones e iniciar'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\local-server\start-local-server.ps1') -ConfigPath $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'El sistema no pudo reiniciar. Consulta los logs.' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\local-server\verify-local-installation.ps1') -ConfigPath $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la comprobacion posterior.' }
    Invoke-WebRequest -Uri "$($config['CORS_ORIGIN'])/health" -UseBasicParsing -TimeoutSec 15 | Out-Null
    Write-Host 'ACTUALIZACION COMPLETADA. Recarga PlayCoffee en todos los dispositivos.' -ForegroundColor Green
    Write-Host "Respaldo conservado en: $backupDirectory"
} catch {
    Write-Host "ACTUALIZACION NO COMPLETADA [$stage]: $($_.Exception.Message)" -ForegroundColor Red
    if ($backupDirectory) {
        @("Paso: $stage", "Error: $($_.Exception.Message)") | Set-Content -LiteralPath (Join-Path $backupDirectory 'error.txt') -Encoding UTF8
        Write-Host "Conserva los respaldos en $backupDirectory. El sistema puede permanecer detenido. No restaures la base ni reinstales PostgreSQL automaticamente; comunica el error."
    }
    exit 1
} finally { if ($lock) { $lock.Dispose() } }
