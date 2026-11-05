param([string]$InstallDirectory = 'C:\PlayCoffee', [string]$DataDirectory = 'C:\ProgramData\PlayCoffee')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Import-Module (Join-Path $PSScriptRoot 'Installer.Downloads.psm1') -Force
$stage = 'Verificacion inicial'

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-', '') } finally { $rng.Dispose() }
}
function Read-Password([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Save-State {
    $script:state | ConvertTo-Json | Set-Content -LiteralPath $script:statePath -Encoding UTF8
}
function Download-Verified([string]$Url, [string]$Path, [string]$Hash) {
    $bundled = Join-Path $source "prerequisites\$([IO.Path]::GetFileName($Path))"
    Get-VerifiedInstallerArtifact -Url $Url -Path $Path -Hash $Hash -BundledPath $bundled
}
function Invoke-Database([string]$Database, [string]$Sql, [string]$User = 'postgres', [string]$Password = $script:postgresPassword) {
    $previous = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Password
        $env:PGCONNECT_TIMEOUT = '10'
        $result = & $script:psql -X -w -h 127.0.0.1 -p $script:state.PostgresPort -U $User -d $Database -v ON_ERROR_STOP=1 -Atc $Sql
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo completar la operacion PostgreSQL. Revisa el puerto y la contrasena.' }
        return ($result -join "`n").Trim()
    } finally { $env:PGPASSWORD = $previous }
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Haz clic derecho sobre INSTALAR.cmd y elige Ejecutar como administrador.' }
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Este paquete requiere Windows x64 (Intel o AMD).' }
    $source = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
    $DataDirectory = [IO.Path]::GetFullPath($DataDirectory).TrimEnd('\')
    if ($InstallDirectory -eq $source) { throw 'Extrae el ZIP en Descargas o una memoria USB, no en la carpeta final C:\PlayCoffee.' }
    $manifestPath = Join-Path $source 'package-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Falta el manifiesto del paquete. Usa el ZIP generado para instalacion.' }
    Write-Host 'PlayCoffee - instalacion del equipo definitivo (base nueva)' -ForegroundColor Cyan
    Write-Host 'Requiere Internet durante la instalacion. Puede tardar varios minutos.'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    foreach ($entry in $manifest.files) {
        $file = [IO.Path]::GetFullPath((Join-Path $source $entry.path))
        if (-not $file.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta invalida en el manifiesto.' }
        if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Paquete incompleto o modificado: $($entry.path). Extrae de nuevo el ZIP." }
    }
    $statePath = Join-Path $DataDirectory 'installer-state.json'
    if ((Test-Path -LiteralPath (Join-Path $DataDirectory 'server.env')) -and -not (Test-Path -LiteralPath $statePath)) { throw 'Ya existe una configuracion de servidor en la carpeta de datos. No se sobrescribira con una base nueva.' }
    if ((Test-Path -LiteralPath $InstallDirectory) -and @(Get-ChildItem -LiteralPath $InstallDirectory -Force).Count -gt 0 -and -not (Test-Path -LiteralPath $statePath)) {
        throw "Ya existe $InstallDirectory con archivos. No se sobrescribira. Usa una carpeta vacia mediante -InstallDirectory."
    }
    New-Item -ItemType Directory -Force -Path $DataDirectory | Out-Null
    # Allow the installing account's logon task to read its private runtime/config.
    $ownerSid = $identity.User.Value
    & icacls.exe $DataDirectory /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "*${ownerSid}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron proteger los archivos de configuracion.' }
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($state.InstallDirectory -ne $InstallDirectory) { throw "Esta instalacion pertenece a $($state.InstallDirectory)." }
        if ($state.Completed) { Write-Host 'PlayCoffee ya esta instalado. Usa el acceso directo del escritorio.' -ForegroundColor Green; exit 0 }
        Write-Host 'Reanudando la instalacion anterior. Se conservaran los datos.'
    } else {
        $suffix = (New-Secret).Substring(0, 10).ToLowerInvariant()
        $state = [pscustomobject]@{ InstallDirectory = $InstallDirectory; DatabaseName = "playcoffee_$suffix"; DatabaseRole = "pc_$suffix"; DatabasePassword = (New-Secret); PostgresPort = 5432; PostgresInstalledBySetup = $false; PostgresPassword = ''; LanAddress = ''; Completed = $false }
        Save-State
    }
    $addresses = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress })
    $suggestion = if ($state.LanAddress) { $state.LanAddress } elseif ($addresses.Count) { $addresses[0] } else { '' }
    $selected = Read-Host "IP local de este equipo [$suggestion]"
    if (-not $selected) { $selected = $suggestion }
    $ip = $null
    if (-not [Net.IPAddress]::TryParse($selected, [ref]$ip) -or $ip.AddressFamily -ne 'InterNetwork') { throw 'Indica una IPv4 valida de este equipo.' }
    $adapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -eq $selected | Select-Object -First 1
    if (-not $adapter -or $selected.StartsWith('127.')) { throw 'La IP no corresponde a un adaptador de red de este equipo.' }
    $profile = Get-NetConnectionProfile -InterfaceIndex $adapter.InterfaceIndex -ErrorAction SilentlyContinue
    if ($profile -and $profile.NetworkCategory -eq 'Public') {
        $answer = Read-Host 'La red esta marcada Publica. Si es la red del negocio, escribe SI para marcarla Privada'
        if ($answer -ne 'SI') { throw 'Configura la red del negocio como Privada y vuelve a ejecutar INSTALAR.' }
        Set-NetConnectionProfile -InterfaceIndex $adapter.InterfaceIndex -NetworkCategory Private
    }
    $state.LanAddress = $selected
    Save-State
    Write-Host "La direccion para tablets sera https://${selected}:3443. Reserva esta IP en el router."
    $runtime = Join-Path $DataDirectory 'runtime'
    $downloads = Join-Path $runtime 'downloads'
    New-Item -ItemType Directory -Force -Path $downloads | Out-Null
    $nodeZip = Join-Path $downloads 'node-v22.23.4-win-x64.zip'
    $stage = 'Preparar Node.js'
    Download-Verified 'https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip' $nodeZip 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'
    $nodeDirectory = Join-Path $runtime 'node-v22.23.4-win-x64'
    if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) { Expand-Archive -LiteralPath $nodeZip -DestinationPath $runtime -Force }
    $env:Path = "$nodeDirectory;$env:Path"
    $toolsDirectory = Join-Path $runtime 'tools'
    $pnpm = Join-Path $toolsDirectory 'node_modules\.bin\pnpm.cmd'
    $stage = 'Instalar pnpm'
    & (Join-Path $nodeDirectory 'npm.cmd') install --prefix $toolsDirectory --no-audit --no-fund pnpm@9.15.9
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar pnpm. Revisa Internet y vuelve a ejecutar INSTALAR.' }
    $env:Path = "$(Split-Path -Parent $pnpm);$env:Path"

    $pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
    $psql = Join-Path $pgBin 'psql.exe'
    if (-not (Test-Path -LiteralPath $psql)) {
        $stage = 'Obtener instalador PostgreSQL'
        if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { throw 'El puerto 5432 ya esta ocupado. Instala PostgreSQL 18 con sus herramientas antes de continuar.' }
        $pgExe = Join-Path $downloads 'postgresql-18.6-5-windows-x64.exe'
        Download-Verified 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64.exe' $pgExe '227E2BC08091B4C2B8338C7D61B11D057F895711480B006F90BFCFCD2410A58A'
        if (-not $state.PostgresPassword) { $state.PostgresPassword = New-Secret }
        $state.PostgresInstalledBySetup = $true
        Save-State
        $optionsPath = Join-Path $runtime 'postgres-options.txt'
        try {
            @('mode=unattended', 'unattendedmodeui=minimal', 'enable-components=server,commandlinetools', 'disable-components=pgAdmin,stackbuilder', "superpassword=$($state.PostgresPassword)", 'serverport=5432', 'servicename=postgresql-x64-18') | Set-Content -LiteralPath $optionsPath -Encoding ASCII
            Write-Host 'Instalando PostgreSQL 18...'
            $stage = 'Ejecutar instalador PostgreSQL'
            $process = Start-Process -FilePath $pgExe -ArgumentList "--optionfile `"$optionsPath`"" -WindowStyle Hidden -Wait -PassThru
            if ($process.ExitCode -ne 0) { throw "PostgreSQL no termino correctamente (codigo $($process.ExitCode))." }
        } finally { if (Test-Path -LiteralPath $optionsPath) { Remove-Item -LiteralPath $optionsPath -Force } }
    }
    if (-not (Test-Path -LiteralPath $psql)) { throw 'No se encontraron las herramientas PostgreSQL 18.' }
    $env:Path = "$pgBin;$env:Path"
    $env:PLAYCOFFEE_POSTGRES_BIN = $pgBin
    $stage = 'Iniciar PostgreSQL y comprobar conexion'
    if ($state.PostgresInstalledBySetup) {
        $postgresPassword = $state.PostgresPassword
        Start-Service postgresql-x64-18
    } else {
        $port = Read-Host "Puerto del PostgreSQL existente [$($state.PostgresPort)]"
        if ($port) { $state.PostgresPort = [int]$port; Save-State }
        $postgresPassword = Read-Password 'Contrasena del usuario postgres existente (no la de PlayCoffee)'
    }
    Invoke-Database 'postgres' 'SELECT 1' | Out-Null
    $stage = 'Crear base de datos de PlayCoffee'
    $role = $state.DatabaseRole
    $database = $state.DatabaseName
    # Names/passwords are generated, persisted locally and strictly constrained before SQL interpolation.
    if ($role -notmatch '^pc_[a-f0-9]{10}$' -or $database -notmatch '^playcoffee_[a-f0-9]{10}$' -or $state.DatabasePassword -notmatch '^[A-F0-9]{64}$') { throw 'Estado de instalacion invalido.' }
    if ((Invoke-Database 'postgres' "SELECT count(*) FROM pg_roles WHERE rolname='$role'") -eq '0') {
        Invoke-Database 'postgres' "CREATE ROLE $role LOGIN PASSWORD '$($state.DatabasePassword)'" | Out-Null
    }
    if ((Invoke-Database 'postgres' "SELECT count(*) FROM pg_database WHERE datname='$database'") -eq '0') {
        Invoke-Database 'postgres' "CREATE DATABASE $database OWNER $role ENCODING 'UTF8' TEMPLATE template0" | Out-Null
    }
    $databaseUrl = "postgresql://${role}:$($state.DatabasePassword)@127.0.0.1:$($state.PostgresPort)/$database"
    $hasUsersTable = Invoke-Database $database "SELECT to_regclass('public.users') IS NOT NULL" $role $state.DatabasePassword
    $needsInitialization = $true
    if ($hasUsersTable -eq 't') {
        $userCount = Invoke-Database $database 'SELECT count(*) FROM users' $role $state.DatabasePassword
        $needsInitialization = $userCount -eq '0'
    }
    if ($needsInitialization) {
        $stage = 'Configurar administrador y tarifas'
        $env:SETUP_BRANCH_NAME = Read-Host 'Nombre de la sucursal'
        if (-not $env:SETUP_BRANCH_NAME) { $env:SETUP_BRANCH_NAME = 'PlayCoffee' }
        do { $env:SETUP_ADMIN_EMAIL = (Read-Host 'Correo del administrador').Trim().ToLowerInvariant() } while ($env:SETUP_ADMIN_EMAIL -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$')
        do {
            $env:SETUP_ADMIN_PASSWORD = Read-Password 'Crea la contrasena de PlayCoffee (minimo 12 caracteres)'
            $confirmation = Read-Password 'Repite la contrasena'
        } while ($env:SETUP_ADMIN_PASSWORD.Length -lt 12 -or $env:SETUP_ADMIN_PASSWORD -cne $confirmation)
        foreach ($rate in @(@{ Env = 'SETUP_CHILD_HOURLY'; Label = 'Precio de una hora infantil'; Default = '99' }, @{ Env = 'SETUP_CHILD_EXTRA'; Label = 'Precio de media hora extra infantil'; Default = '49' })) {
            do {
                $value = Read-Host "$($rate.Label) MXN [$($rate.Default)]"
                if (-not $value) { $value = $rate.Default }
                $valid = $value -match '^\d+(\.\d{1,2})?$' -and [decimal]::Parse($value, [Globalization.CultureInfo]::InvariantCulture) -gt 0
            } while (-not $valid)
            [Environment]::SetEnvironmentVariable($rate.Env, $value, 'Process')
        }
    }
    $configPath = Join-Path $DataDirectory 'server.env'
    if (Test-Path -LiteralPath $configPath) {
        $stop = Join-Path $InstallDirectory 'scripts\local-server\stop-local-server.ps1'
        if (Test-Path -LiteralPath $stop) { & $stop -ConfigPath $configPath }
    }
    New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
    foreach ($entry in $manifest.files) {
        $destination = Join-Path $InstallDirectory $entry.path
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath (Join-Path $source $entry.path) -Destination $destination -Force
    }
    $stage = 'Compilar e iniciar PlayCoffee'
    & (Join-Path $InstallDirectory 'scripts\local-server\install-local-server.ps1') -LanAddress $state.LanAddress -DatabaseUrl $databaseUrl -DataDirectory $DataDirectory -ConfigPath $configPath -RuntimeDirectory $nodeDirectory -PostgresBin $pgBin -PnpmPath $pnpm -InitializeNewDatabase:$needsInitialization -RegisterStartup -ConfigureFirewall
    # Validate the HTTPS entry point, including trust and the SAN matching the chosen IP.
    $stage = 'Verificar HTTPS y acceso'
    Invoke-WebRequest -Uri "https://$($state.LanAddress):3443/health" -UseBasicParsing -TimeoutSec 15 | Out-Null
    if ($needsInitialization) {
        $body = @{ email = $env:SETUP_ADMIN_EMAIL; password = $env:SETUP_ADMIN_PASSWORD } | ConvertTo-Json
        $login = Invoke-RestMethod -Method Post -Uri "https://$($state.LanAddress):3443/api/v1/auth/login" -ContentType 'application/json' -Body $body -TimeoutSec 15
        if (-not $login.data.accessToken) { throw 'No se pudo verificar el inicio de sesion del administrador.' }
        $body = $null
        $login = $null
    }
    $desktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
    $url = "https://$($state.LanAddress):3443"
    "[InternetShortcut]`r`nURL=$url" | Set-Content -LiteralPath (Join-Path $desktop 'PlayCoffee.url') -Encoding ASCII
    $shell = New-Object -ComObject WScript.Shell
    foreach ($shortcut in @(@{ Name = 'Iniciar PlayCoffee'; Script = 'start-local-server.ps1' }, @{ Name = 'Respaldar PlayCoffee'; Script = 'backup-local-server.ps1' })) {
        $link = $shell.CreateShortcut((Join-Path $desktop "$($shortcut.Name).lnk"))
        $link.TargetPath = (Get-Command powershell.exe).Source
        $scriptPath = Join-Path $InstallDirectory "scripts\local-server\$($shortcut.Script)"
        $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigPath `"$configPath`""
        $link.WorkingDirectory = $InstallDirectory
        $link.Save()
    }
    Copy-Item -LiteralPath (Join-Path $DataDirectory 'certificates\playcoffee-local-ca.cer') -Destination (Join-Path $desktop 'PlayCoffee-certificado-tablets.cer') -Force
    @("URL de PlayCoffee: $url", 'Usa el correo y contrasena creados durante la instalacion.', "Programa: $InstallDirectory", "Datos y respaldos: $DataDirectory", 'Inicio automatico al entrar a Windows con el usuario que instalo.', 'Primero configura menu, mesas, usuarios e impresoras. Abre caja antes de cobrar.', 'Para tablets: instala el certificado publico .cer y entra a la URL desde la misma red.', 'Reserva la IP en el router. Evita suspension del servidor durante el horario de servicio.') | Set-Content -LiteralPath (Join-Path $desktop 'PlayCoffee-LEEME.txt') -Encoding UTF8
    $state.Completed = $true
    Save-State
    Write-Host "Instalacion verificada. Abre PlayCoffee desde el escritorio: $url" -ForegroundColor Green
    Write-Host 'Crea tu menu y mesas. Abre Corte de Caja antes de cobrar.' -ForegroundColor Yellow
} catch {
    $failureMessage = $_.Exception.Message
    Write-Host "INSTALACION NO COMPLETADA [$stage]: $failureMessage" -ForegroundColor Red
    if (Test-Path -LiteralPath $DataDirectory -PathType Container) {
        try {
            $errorFile = Join-Path $DataDirectory 'ultimo-error-instalacion.txt'
            @("Fecha: $(Get-Date -Format s)", "Paso: $stage", "Error: $failureMessage") | Set-Content -LiteralPath $errorFile -Encoding UTF8
            Write-Host "Detalle guardado en: $errorFile" -ForegroundColor Yellow
        } catch { Write-Host 'No se pudo guardar el detalle del error.' -ForegroundColor Yellow }
    }
    Write-Host 'Corrige el error y ejecuta INSTALAR nuevamente; no borres la base ni la carpeta de datos.' -ForegroundColor Yellow
    exit 1
} finally {
    $env:SETUP_ADMIN_PASSWORD = $null
    $postgresPassword = $null
    $confirmation = $null
}
