Set-StrictMode -Version Latest

function Get-VerifiedInstallerArtifact {
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Hash,
        [string]$BundledPath,
        [int]$RetryDelaySeconds = 3
    )
    $ErrorActionPreference = 'Stop'
    $name = [IO.Path]::GetFileName($Path)
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -eq $Hash) {
        Write-Host "Usando descarga verificada: $name"
        return
    }
    if ($BundledPath -and (Test-Path -LiteralPath $BundledPath -PathType Leaf)) {
        if ((Get-FileHash -LiteralPath $BundledPath -Algorithm SHA256).Hash -ne $Hash) {
            throw "El archivo incluido $name esta incompleto o modificado. Copia y extrae nuevamente el paquete."
        }
        Write-Host "Usando $name incluido en el paquete (sin descargar)." -ForegroundColor Green
        Copy-Item -LiteralPath $BundledPath -Destination $Path -Force
        if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Hash) { throw "No se pudo copiar correctamente $name." }
        return
    }
    $partial = "$Path.partial"
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Write-Host "Descargando $name (intento $attempt de 3)..."
            Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing -TimeoutSec 1800
            if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $Hash) {
                throw 'La descarga esta incompleta o no coincide con el SHA-256 esperado.'
            }
            Move-Item -LiteralPath $partial -Destination $Path -Force
            return
        } catch {
            $reason = $_.Exception.Message
            if (Test-Path -LiteralPath $partial -PathType Leaf) { Remove-Item -LiteralPath $partial -Force }
            if ($attempt -eq 3) {
                throw "No se pudo descargar $name. Detalle: $reason. Usa el paquete con PostgreSQL incluido o verifica la conexion a $Url."
            }
            Write-Host "Descarga interrumpida: $reason. Reintentando..." -ForegroundColor Yellow
            if ($RetryDelaySeconds -gt 0) { Start-Sleep -Seconds $RetryDelaySeconds }
        }
    }
}

Export-ModuleMember -Function Get-VerifiedInstallerArtifact
