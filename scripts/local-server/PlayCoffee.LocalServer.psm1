Set-StrictMode -Version Latest

function Get-PlayCoffeeEnvironment {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No existe el archivo de configuracion: $Path"
    }

    $values = @{}
    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -lt 1) {
            throw "Linea invalida en ${Path}: $rawLine"
        }
        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim().Trim('"')
        $values[$key] = $value
    }
    return $values
}

function Set-PlayCoffeeEnvironment {
    param([Parameter(Mandatory)][hashtable]$Values)

    foreach ($entry in $Values.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
}

function Get-PlayCoffeeRuntimePath {
    param(
        [Parameter(Mandatory)][hashtable]$Config,
        [Parameter(Mandatory)][string]$Name
    )

    $path = $Config[$Name]
    if ([string]::IsNullOrWhiteSpace($path)) {
        throw "Falta $Name en la configuracion local"
    }
    return [Environment]::ExpandEnvironmentVariables($path)
}

function Test-PlayCoffeeStoredProcess {
    param([Parameter(Mandatory)]$Record)

    $process = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
    if (-not $process) { return $false }
    try {
        if ($Record.PSObject.Properties.Name -notcontains 'startedAtUtcTicks') {
            return $false
        }
        if ($Record.PSObject.Properties.Name -contains 'executable') {
            if ($process.Path -ne [string]$Record.executable) { return $false }
        }
        $actualTicks = $process.StartTime.ToUniversalTime().Ticks
        $expectedTicks = [long]$Record.startedAtUtcTicks
        $differenceSeconds = [Math]::Abs($actualTicks - $expectedTicks) / [TimeSpan]::TicksPerSecond
        return $differenceSeconds -lt 2
    } catch {
        return $false
    }
}

function Wait-PlayCoffeeUrl {
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Get-PlayCoffeePostgresTool {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $fileName = if ($Name.EndsWith('.exe')) { $Name } else { "$Name.exe" }
    $postgresRoot = 'C:\Program Files\PostgreSQL'
    if (Test-Path -LiteralPath $postgresRoot) {
        $tool = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\$fileName" } |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1
        if ($tool) { return $tool }
    }

    throw "No se encontro $fileName en PATH ni en C:\Program Files\PostgreSQL."
}

Export-ModuleMember -Function Get-PlayCoffeeEnvironment, Set-PlayCoffeeEnvironment, Get-PlayCoffeeRuntimePath, Test-PlayCoffeeStoredProcess, Wait-PlayCoffeeUrl, Get-PlayCoffeePostgresTool
