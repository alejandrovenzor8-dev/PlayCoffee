param([string]$ServiceName = 'postgresql-x64-18', [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-RecoveryConfiguration([string]$Directory) {
    # postgres.exe refuses even -C when elevated on Windows. Read the standard
    # installation's files instead; never start postgres.exe from this console.
    $port = 5432
    $hba = Join-Path $Directory 'pg_hba.conf'
    foreach ($name in @('postgresql.conf', 'postgresql.auto.conf')) {
        $file = Join-Path $Directory $name
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            if ($name -eq 'postgresql.conf') { throw "No existe $file. No se modifico nada." }
            continue
        }
        foreach ($rawLine in Get-Content -LiteralPath $file) {
            $line = $rawLine.Trim()
            if (-not $line -or $line.StartsWith('#')) { continue }
            if ($line -match '^(?i:include|include_dir|include_if_exists)\b') {
                throw 'Esta instalacion usa archivos de configuracion adicionales. Se requiere revisar su configuracion; no se modifico nada.'
            }
            if ($line -notmatch '^(?i:port|hba_file|data_directory)\b') { continue }
            if ($line -notmatch '^(?i)(port|hba_file|data_directory)\s*(?:=\s*)?(.+)$') { throw "Configuracion no reconocida en $file." }
            $key = $Matches[1].ToLowerInvariant()
            $value = $Matches[2].Trim()
            if ($key -eq 'port') {
                if ($value -notmatch "^(?:([1-9][0-9]{0,4})|'([1-9][0-9]{0,4})')\s*(?:#.*)?$") { throw 'Formato de puerto PostgreSQL no reconocido. No se modifico nada.' }
                $port = if ($Matches[1]) { [int]$Matches[1] } else { [int]$Matches[2] }
                if ($port -gt 65535) { throw 'Puerto PostgreSQL invalido.' }
            } else {
                if ($value -notmatch "^'((?:[^']|'')*)'\s*(?:#.*)?$") { throw "Ruta $key no reconocida. No se modifico nada." }
                $configuredPath = $Matches[1].Replace("''", "'").Replace('\\', '/')
                if ($configuredPath.Contains('\') -or -not [IO.Path]::IsPathRooted($configuredPath)) { throw "La ruta $key requiere revision manual. No se modifico nada." }
                $configuredPath = (Resolve-Path -LiteralPath $configuredPath).Path
                if ($key -eq 'data_directory' -and $configuredPath -ne $Directory) { throw 'La carpeta de datos esta separada de la configuracion. Se requiere revision manual; no se modifico nada.' }
                if ($key -eq 'hba_file') { $hba = $configuredPath }
            }
        }
    }
    return [pscustomobject]@{ Port = $port; HbaPath = (Resolve-Path -LiteralPath $hba).Path }
}

function Stop-DatabaseService {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($service.Status -ne 'Stopped') {
        Stop-Service -Name $ServiceName -ErrorAction Stop
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
    }
}
function Start-DatabaseService {
    Start-Service -Name $ServiceName -ErrorAction Stop
    (Get-Service -Name $ServiceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(45))
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Ejecuta RESTABLECER-POSTGRES.cmd como administrador de Windows.' }
    if ($ServiceName -notmatch '^postgresql[-a-zA-Z0-9_]+$') { throw 'Nombre de servicio PostgreSQL invalido.' }
    $serviceConfig = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
    if (-not $serviceConfig) { throw "No existe el servicio $ServiceName. PostgreSQL debe estar instalado antes de restablecer su contrasena." }
    $command = $serviceConfig.PathName
    if ($command -notmatch '(?i)^"([^"]+\\pg_ctl\.exe)"') { throw 'No se reconoce la ruta del servicio PostgreSQL. No se modifico nada.' }
    $bin = Split-Path -Parent $Matches[1]
    if ($command -match '(?i)\s-o\s') { throw 'El servicio usa opciones de arranque personalizadas. Requiere revisar su configuracion antes de restablecer.' }
    if ($command -notmatch '(?i)\s-D\s+(?:"([^"]+)"|(\S+))') { throw 'No se encontro la carpeta de datos en el servicio. No se modifico nada.' }
    $data = if ($Matches[1]) { $Matches[1] } else { $Matches[2] }
    $data = (Resolve-Path -LiteralPath $data).Path
    $psql = Join-Path $bin 'psql.exe'
    $configuration = Get-RecoveryConfiguration -Directory $data
    $hba = $configuration.HbaPath
    $port = $configuration.Port
    if ($CheckOnly) {
        Write-Host "Diagnostico correcto. Servicio: $ServiceName. Puerto: $port. Autenticacion: $hba. Sin cambios ni reinicios." -ForegroundColor Green
        exit 0
    }
    $backup = "$hba.playcoffee-password-backup"
    Write-Host "Restablecer usuario postgres en $ServiceName (puerto $port)" -ForegroundColor Cyan
    Write-Host "Carpeta de datos: $data"
    Write-Host 'Se detendra brevemente PostgreSQL. No uses esta herramienta durante ventas.' -ForegroundColor Yellow
    Write-Host 'No borra bases ni cambia la contrasena del administrador de PlayCoffee.'
    if ((Read-Host 'Escribe RESTABLECER para continuar') -cne 'RESTABLECER') { Write-Host 'Cancelado. Sin cambios.'; exit 0 }

    # Recover a prior interrupted attempt before opening a new recovery window.
    if (Test-Path -LiteralPath $backup -PathType Leaf) {
        Stop-DatabaseService
        [IO.File]::WriteAllBytes($hba, [IO.File]::ReadAllBytes($backup))
        Start-DatabaseService
        Remove-Item -LiteralPath $backup -Force
        Write-Host 'Se restauro la autenticacion de un intento anterior.'
    }
    $original = [IO.File]::ReadAllBytes($hba)
    $header = [Text.Encoding]::ASCII.GetBytes("# Temporary PlayCoffee password recovery - local postgres database/user only`r`nhost postgres postgres 127.0.0.1/32 trust`r`n")
    $body = $original
    if ($body.Length -ge 3 -and $body[0] -eq 239 -and $body[1] -eq 187 -and $body[2] -eq 191) {
        $body = if ($body.Length -gt 3) { $body[3..($body.Length - 1)] } else { [byte[]]@() }
    }
    # If creating the backup fails, leave the service and its configuration untouched.
    [IO.File]::WriteAllBytes($backup, $original)
    try {
        Stop-DatabaseService
        [IO.File]::WriteAllBytes($hba, [byte[]]($header + $body))
        Start-DatabaseService
        $activeHba = & $psql -X -w -h 127.0.0.1 -p $port -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c 'SHOW hba_file'
        if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath(($activeHba -join '').Trim()) -ne $hba) {
            throw 'La conexion no corresponde a la configuracion del servicio elegido. No se cambiara la contrasena.'
        }
        Write-Host 'Crea una contrasena nueva y repitela cuando PostgreSQL lo pida.' -ForegroundColor Cyan
        Write-Host 'No se muestran los caracteres al escribir. No cierres esta ventana.'
        # psql hashes the password before sending it; no plaintext in argv or SQL logs.
        & $psql -X -w -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -c '\password postgres'
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL no confirmo el cambio de contrasena.' }
    } finally {
        try {
            try { Stop-DatabaseService } finally { [IO.File]::WriteAllBytes($hba, $original) }
            if ((Get-FileHash -LiteralPath $hba).Hash -ne (Get-FileHash -LiteralPath $backup).Hash) { throw 'La autenticacion restaurada no coincide con el respaldo.' }
            Start-DatabaseService
            Remove-Item -LiteralPath $backup -Force
        } catch {
            Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
            throw "No se pudo confirmar la restauracion de autenticacion. PostgreSQL se intento dejar detenido. Conserva $backup para recuperar la configuracion. Detalle: $($_.Exception.Message)"
        }
    }
    Write-Host 'Autenticacion original restaurada. Escribe la NUEVA contrasena una vez mas para comprobarla.' -ForegroundColor Cyan
    & $psql -X -W -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'SELECT 1 AS conexion_correcta'
    if ($LASTEXITCODE -ne 0) { throw 'La comprobacion no fue correcta. La autenticacion normal ya esta restaurada. Revisa la nueva contrasena.' }
    # Do not keep an obsolete automatically generated password in an unfinished installer.
    $statePath = 'C:\ProgramData\PlayCoffee\installer-state.json'
    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($state.PSObject.Properties.Name -contains 'PostgresInstalledBySetup' -and $state.PostgresPort -eq $port) {
            $state.PostgresInstalledBySetup = $false
            $state.PostgresPassword = ''
            $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
        }
    }
    Write-Host "Contrasena comprobada. Vuelve a INSTALAR.cmd: puerto $port, usuario postgres y la nueva contrasena." -ForegroundColor Green
} catch {
    Write-Host "NO SE COMPLETO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
