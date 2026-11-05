Set-StrictMode -Version Latest

function Test-PlayCoffeeProcessOwnership {
    param([Parameter(Mandatory)]$Process, [Parameter(Mandatory)][string]$Root)
    if ($Process.Name -ne 'node.exe' -or -not $Process.ExecutablePath -or -not $Process.CommandLine) { return $false }
    # Only the actual script argument counts, never a path mentioned in another argument.
    if ($Process.CommandLine -notmatch '^\s*(?:"[^"]+"|\S+)\s+(?:"([^"]+)"|(\S+))(?:\s|$)') { return $false }
    $scriptPath = if ($Matches[1]) { $Matches[1] } else { $Matches[2] }
    $scriptPath = $scriptPath.Replace('/', '\')
    $expected = @('apps\backend\dist\src\main.js', 'apps\frontend\node_modules\next\dist\bin\next', 'scripts\local-server\https-proxy.mjs', 'scripts\print-agent\print-agent.mjs') |
        ForEach-Object { Join-Path $Root $_ }
    return $scriptPath -in $expected
}

function Stop-PlayCoffeeOwnedProcesses {
    param([Parameter(Mandatory)][string]$Root)
    $candidates = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop)
    foreach ($candidate in $candidates) {
        if (-not (Test-PlayCoffeeProcessOwnership -Process $candidate -Root $Root)) { continue }
        # Recheck identity immediately before stopping, guarding against PID reuse.
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.ProcessId)" -ErrorAction Stop
        if (-not $current -or $current.CreationDate -ne $candidate.CreationDate -or $current.ExecutablePath -ne $candidate.ExecutablePath) { continue }
        if (-not (Test-PlayCoffeeProcessOwnership -Process $current -Root $Root)) { continue }
        Write-Host "Deteniendo proceso confirmado de esta instalacion: PID $($current.ProcessId)"
        Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop
        Wait-Process -Id $current.ProcessId -Timeout 15 -ErrorAction SilentlyContinue
    }
}

Export-ModuleMember -Function Test-PlayCoffeeProcessOwnership, Stop-PlayCoffeeOwnedProcesses
