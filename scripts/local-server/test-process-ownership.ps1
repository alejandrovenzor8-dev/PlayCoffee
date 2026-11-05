$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'Process.Ownership.psm1') -Force
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testParent = Join-Path $workspace 'releases'
$testRoot = Join-Path $testParent ('.process-test-' + [Guid]::NewGuid().ToString('N'))
$own = $null
$other = $null
try {
    $backend = Join-Path $testRoot 'apps\backend\dist\src\main.js'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backend) | Out-Null
    [IO.File]::WriteAllText($backend, "require('node:http').createServer((req,res)=>res.end('fixture')).listen(0,'127.0.0.1',function(){console.log(this.address().port)});")
    $unrelated = Join-Path $testRoot 'other.js'
    [IO.File]::WriteAllText($unrelated, 'setInterval(()=>{},1000);')
    $node = (Get-Command node).Source
    foreach ($fixture in @(
        @{ CommandLine = "`"$node`" `"$backend`""; Expected = $true },
        @{ CommandLine = "`"$node`" `"$unrelated`" `"$backend`""; Expected = $false },
        @{ CommandLine = "`"$node`" `"$($backend.Replace($testRoot, $testRoot + '-other'))`""; Expected = $false },
        @{ CommandLine = "`"$node`" -e `"console.log('test')`""; Expected = $false }
    )) {
        $record = [pscustomobject]@{ Name = 'node.exe'; ExecutablePath = $node; CommandLine = $fixture.CommandLine }
        if ((Test-PlayCoffeeProcessOwnership -Process $record -Root $testRoot) -ne $fixture.Expected) { throw 'Ownership check failed' }
    }
    $output = Join-Path $testRoot 'listener.log'
    $own = Start-Process -FilePath $node -ArgumentList "`"$backend`"" -WindowStyle Hidden -PassThru -RedirectStandardOutput $output
    $other = Start-Process -FilePath $node -ArgumentList "`"$unrelated`"" -WindowStyle Hidden -PassThru
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline -and (-not (Test-Path -LiteralPath $output) -or -not (Get-Content -LiteralPath $output))) { Start-Sleep -Milliseconds 200 }
    $port = [int](Get-Content -LiteralPath $output | Select-Object -First 1)
    $probe = New-Object Net.Sockets.TcpClient
    try { $probe.Connect('127.0.0.1', $port) } finally { $probe.Dispose() }
    Stop-PlayCoffeeOwnedProcesses -Root $testRoot
    if (Get-Process -Id $own.Id -ErrorAction SilentlyContinue) { throw 'Owned process remained alive without PID metadata' }
    if (-not (Get-Process -Id $other.Id -ErrorAction SilentlyContinue)) { throw 'Unrelated process was incorrectly stopped' }
    $probe = New-Object Net.Sockets.TcpClient
    $stillListening = $false
    try { $probe.Connect('127.0.0.1', $port); $stillListening = $true } catch { } finally { $probe.Dispose() }
    if ($stillListening) { throw 'Port was not released' }
    Write-Host 'PASS: four ownership cases; real orphan listener stopped, port released, unrelated Node process preserved.' -ForegroundColor Green
} finally {
    foreach ($process in @($own, $other)) { if ($process -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() } }
    if (Test-Path -LiteralPath $testRoot) {
        $resolved = (Resolve-Path -LiteralPath $testRoot).Path
        if (-not $resolved.StartsWith($testParent + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe cleanup path' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
