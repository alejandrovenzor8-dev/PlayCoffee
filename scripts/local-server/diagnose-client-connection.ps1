param(
    [string]$ConfigPath = 'C:\ProgramData\PlayCoffee\server.env',
    [string]$PublicUrl,
    [switch]$AskPublicUrl,
    [string]$ReportPath
)

# Read-only checks. Never print configuration secrets, tokens or database URLs.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PlayCoffee.LocalServer.psm1') -Force
if ($ReportPath) { Start-Transcript -LiteralPath $ReportPath -Force | Out-Null }

function Test-HttpEndpoint {
    param([string]$Name, [string]$Url, [int[]]$ExpectedStatus, [switch]$Health, [string]$Origin)
    $parameters = @{ Uri = $Url; UseBasicParsing = $true; TimeoutSec = 5; MaximumRedirection = 0 }
    if ($Origin) { $parameters.Headers = @{ Origin = $Origin } }
    try {
        $response = Invoke-WebRequest @parameters
        $status = [int]$response.StatusCode
        $ok = $status -in $ExpectedStatus
        $detail = "HTTP $status"
        if ($Health -and $ok) {
            try {
                $body = $response.Content | ConvertFrom-Json
                $healthData = if ($body.PSObject.Properties.Name -contains 'data') { $body.data } else { $body }
                $ok = $healthData.status -eq 'ok' -and $healthData.database -eq 'ok'
                $detail += $(if ($ok) { '; servidor y base disponibles' } else { '; respuesta de salud inesperada' })
            } catch { $ok = $false; $detail += '; no devolvio el estado de salud esperado' }
        }
        if ($Origin -and $ok) {
            $allowedOrigin = [string]$response.Headers['Access-Control-Allow-Origin']
            if ($allowedOrigin -ne $Origin) {
                $ok = $false
                $detail += '; el servidor no autoriza el origen del navegador por CORS'
            } else { $detail += '; origen autorizado por CORS' }
        }
        [pscustomobject]@{ Check = $Name; OK = $ok; Detail = "$Url - $detail" }
    } catch {
        $status = 0
        if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        $expected = $status -in $ExpectedStatus
        $detail = if ($status) { "HTTP $status" } else { $_.Exception.Message }
        if ($expected -and $status -eq 401) { $detail += '; API disponible, solicita iniciar sesion como corresponde' }
        [pscustomobject]@{ Check = $Name; OK = $expected; Detail = "$Url - $detail" }
    }
}

Write-Output 'DIAGNOSTICO DE CONEXION PLAYCOFFEE'
Write-Output ('Fecha: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Output 'Solo consulta. No detiene servicios ni modifica configuracion o base de datos.'
if ($AskPublicUrl) {
    $enteredUrl = Read-Host 'Direccion completa que abre el celular (http o https, IP y puerto). Enter para usar la configuracion'
    if (-not [string]::IsNullOrWhiteSpace($enteredUrl)) { $PublicUrl = $enteredUrl.Trim() }
}
$config = @{}
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    $config = Get-PlayCoffeeEnvironment -Path $ConfigPath
    Write-Output "Configuracion encontrada: $ConfigPath"
} else { Write-Output "No se encontro $ConfigPath. Se comprobaran los puertos habituales." }

Write-Output 'Direcciones IPv4 actuales de esta computadora:'
[Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object OperationalStatus -eq 'Up' | ForEach-Object {
        foreach ($address in $_.GetIPProperties().UnicastAddresses) {
            if ($address.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and
                -not [Net.IPAddress]::IsLoopback($address.Address)) {
                Write-Output ("  {0}: {1}" -f $_.Name, $address.Address)
            }
        }
    }

$backendPort = if ($config['PORT']) { [int]$config['PORT'] } else { 3001 }
$frontendPort = if ($config['FRONTEND_PORT']) { [int]$config['FRONTEND_PORT'] } else { 3000 }
Write-Output "Backend: puerto $backendPort. Frontend: puerto $frontendPort."
if ($config['HTTPS_ENABLED'] -eq 'true') {
    Write-Output "HTTPS habilitado. Puerto de entrada para dispositivos: $($config['HTTPS_PORT'])."
}

$results = @(
    Test-HttpEndpoint 'Backend y base local' "http://127.0.0.1:$backendPort/health" @(200) -Health
    Test-HttpEndpoint 'Pagina local' "http://127.0.0.1:$frontendPort/login" @(200)
    Test-HttpEndpoint 'API a traves del frontend' "http://127.0.0.1:$frontendPort/api/v1/orders" @(401)
)
if (-not $PublicUrl -and $config['CORS_ORIGIN']) { $PublicUrl = ($config['CORS_ORIGIN'] -split ',')[0].Trim() }
if ($PublicUrl) {
    $publicUri = $null
    if (-not [Uri]::TryCreate($PublicUrl, [UriKind]::Absolute, [ref]$publicUri) -or
        $publicUri.Scheme -notin @('http', 'https') -or $publicUri.UserInfo) {
        throw 'La direccion publica debe ser http://IP:PUERTO o https://IP:PUERTO, sin credenciales.'
    }
    $origin = $publicUri.GetLeftPart([UriPartial]::Authority)
    Write-Output "Direccion publica comprobada: $origin"
    if ($config['CORS_ORIGIN']) {
        $origins = @($config['CORS_ORIGIN'] -split ',' | ForEach-Object { $_.Trim().TrimEnd('/') })
        Write-Output ('La direccion publica figura en CORS: ' + ($origin -in $origins))
    }
    foreach ($key in @('NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL')) {
        if ($config[$key]) {
            $configuredUri = $null
            if ([Uri]::TryCreate($config[$key], [UriKind]::Absolute, [ref]$configuredUri) -and -not $configuredUri.UserInfo) {
                Write-Output ("{0} configurado: {1}" -f $key, $configuredUri.GetLeftPart([UriPartial]::Authority))
            } else { Write-Output "$key usa una ruta relativa o un valor no reconocido." }
        }
    }
    $results += Test-HttpEndpoint 'Salud desde entrada publica' "$origin/health" @(200) -Health
    $results += Test-HttpEndpoint 'API desde entrada publica' "$origin/api/v1/orders" @(401)
    if ($config['NEXT_PUBLIC_API_URL']) {
        $apiUri = $null
        if ([Uri]::TryCreate($config['NEXT_PUBLIC_API_URL'], [UriKind]::Absolute, [ref]$apiUri) -and
            $apiUri.Scheme -in @('http', 'https') -and -not $apiUri.UserInfo) {
            $apiOrigin = $apiUri.GetLeftPart([UriPartial]::Authority)
            if ($apiOrigin -ne $origin) {
                $results += Test-HttpEndpoint 'API configurada y permiso CORS' "$apiOrigin/health" @(200) -Health -Origin $origin
            }
        }
    }
    if ($config['NEXT_PUBLIC_WS_URL']) {
        $wsUri = $null
        if ([Uri]::TryCreate($config['NEXT_PUBLIC_WS_URL'], [UriKind]::Absolute, [ref]$wsUri) -and
            $wsUri.Scheme -in @('http', 'https', 'ws', 'wss') -and -not $wsUri.UserInfo) {
            $wsOrigin = $wsUri.GetLeftPart([UriPartial]::Authority) -replace '^ws:', 'http:' -replace '^wss:', 'https:'
            $results += Test-HttpEndpoint 'Transporte de tiempo real' "$wsOrigin/socket.io/?EIO=4&transport=polling" @(200) -Origin $origin
        }
    }
    if ($publicUri.Host -in @('localhost', '127.0.0.1', '::1')) {
        Write-Output 'Para probar desde un celular usa la direccion IP de la computadora, no localhost.'
    } else { Write-Output "En un celular abre tambien: $origin/health" }
} else { Write-Output 'Para comprobar la entrada de los celulares, ejecuta el script con -PublicUrl seguido de su direccion completa.' }

$results | Format-List Check, OK, Detail | Out-String -Width 200 | Write-Output
Write-Output 'Un 401 en ordenes sin credenciales es normal y confirma que la ruta de API responde.'
Write-Output 'Si esto funciona en el servidor pero /health falla en el celular, revisar red, firewall y confianza del certificado.'
Write-Output 'Si /health funciona en el celular pero la aplicacion falla, revisar direccion compilada de API, CORS, sesion y cache del navegador.'
Write-Output 'Los valores NEXT_PUBLIC indicados son los de configuracion. No prueban cuales quedaron incorporados en la ultima compilacion.'
Write-Output 'No compartas server.env, contrasenas ni respaldos de la base. Este informe omite esos datos.'
if ($ReportPath) { Stop-Transcript | Out-Null }
if (@($results | Where-Object { -not $_.OK }).Count) { exit 1 }
