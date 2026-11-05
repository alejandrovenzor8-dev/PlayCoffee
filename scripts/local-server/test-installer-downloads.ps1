$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$module = Import-Module (Join-Path $PSScriptRoot 'Installer.Downloads.psm1') -Force -PassThru
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $root 'releases'
$directory = Join-Path $testRoot ('.download-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
try {
    $bundle = Join-Path $directory 'bundled.bin'
    $target = Join-Path $directory 'downloaded.bin'
    [IO.File]::WriteAllText($bundle, 'verified fixture')
    $hash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash
    # Block real network access and count attempts inside the module under test.
    & $module {
        $script:testCalls = 0
        function script:Invoke-WebRequest {
            param($Uri, $OutFile, [switch]$UseBasicParsing, $TimeoutSec)
            $script:testCalls++
            [IO.File]::WriteAllText($OutFile, 'partial response')
            throw 'test: connection interrupted'
        }
    }
    Get-VerifiedInstallerArtifact -Url 'https://example.invalid/test' -Path $target -Hash $hash -BundledPath $bundle
    if ((Get-FileHash -LiteralPath $target).Hash -ne $hash) { throw 'Bundled copy failed' }
    Get-VerifiedInstallerArtifact -Url 'https://example.invalid/test' -Path $target -Hash $hash
    if ((& $module { $script:testCalls }) -ne 0) { throw 'Cache/bundle unexpectedly used network' }
    [IO.File]::WriteAllText($target, 'incomplete old download')
    Get-VerifiedInstallerArtifact -Url 'https://example.invalid/test' -Path $target -Hash $hash -BundledPath $bundle
    if ((Get-FileHash -LiteralPath $target).Hash -ne $hash) { throw 'Could not repair incomplete download from bundle' }
    [IO.File]::WriteAllText($target, 'invalid')
    [IO.File]::WriteAllText($bundle, 'invalid')
    $rejected = $false
    try { Get-VerifiedInstallerArtifact -Url 'https://example.invalid/test' -Path $target -Hash $hash -BundledPath $bundle } catch { $rejected = $_.Exception.Message -match 'incompleto o modificado' }
    if (-not $rejected) { throw 'Invalid bundle was not rejected' }
    $rejected = $false
    try { Get-VerifiedInstallerArtifact -Url 'https://example.invalid/test' -Path $target -Hash $hash -RetryDelaySeconds 0 } catch { $rejected = $_.Exception.Message -match 'connection interrupted' }
    if (-not $rejected -or (& $module { $script:testCalls }) -ne 3) { throw 'Download must retry three times and preserve the failure reason' }
    if (Test-Path -LiteralPath "$target.partial") { throw 'Incomplete temporary download left behind' }
    Write-Host 'PASS: bundled installer, cached installer, corrupt cache recovery, invalid bundle rejection, interrupted download retries.' -ForegroundColor Green
} finally {
    Remove-Module $module.Name -Force
    $resolved = (Resolve-Path -LiteralPath $directory).Path
    if (-not $resolved.StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test cleanup path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
