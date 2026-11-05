$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $root 'releases'
$directory = Join-Path $testRoot ('.recovery-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
try {
    $source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reset-postgres-password.ps1') -Raw
    # Replace machine boundaries only. File backup/restore, control flow and failures
    # execute unchanged, on temporary fixtures. No real service or database is used.
    $source = $source.Replace("param([string]`$ServiceName = 'postgresql-x64-18', [switch]`$CheckOnly)", "`$ServiceName = 'postgresql-x64-18'; `$CheckOnly = `$false")
    $adminCheck = 'if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))'
    if (-not $source.Contains($adminCheck)) { throw 'Elevation boundary changed: review test harness' }
    $source = $source.Replace($adminCheck, 'if ($false)')
    if ($source.Contains('& $postgres ') -or $source.Contains("Join-Path `$bin 'postgres.exe'")) { throw 'Recovery must not invoke the server executable from an elevated console' }
    $source = $source.Replace('& $psql ', 'Invoke-TestPsql ')
    $source = $source.Replace("'C:\ProgramData\PlayCoffee\installer-state.json'", "(Join-Path `$env:PC_RECOVERY_TEST_DIR 'nonexistent-state.json')")
    $mocks = @'
function Get-CimInstance {
    [pscustomobject]@{ PathName = ('"' + $env:PC_RECOVERY_TEST_DIR + '\bin\pg_ctl.exe" runservice -N "postgresql-x64-18" -D "' + $env:PC_RECOVERY_TEST_DIR + '" -w') }
}
function Get-Service {
    $result = [pscustomobject]@{ Status = 'Running' }
    $result | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value { param($status, $timeout) }
    return $result
}
function Stop-Service { }
function Start-Service { }
function Read-Host { if ($env:PC_RECOVERY_TEST_CASE -eq 'cancel') { return 'CANCELAR' }; return 'RESTABLECER' }
function Invoke-TestPsql {
    $global:LASTEXITCODE = 0
    $portIndex = [array]::IndexOf($args, '-p')
    if ($args[$portIndex + 1] -ne [int]$env:PC_RECOVERY_TEST_PORT) { throw 'Incorrect port from configuration' }
    $query = $args[-1]
    if ($query -eq 'SHOW hba_file') { return $env:PC_RECOVERY_TEST_HBA }
    if ($query -eq '\password postgres') {
        $actual = Get-Content $env:PC_RECOVERY_TEST_HBA -Raw
        if (-not $actual.StartsWith("# Temporary PlayCoffee password recovery - local postgres database/user only`r`nhost postgres postgres 127.0.0.1/32 trust`r`n")) { throw 'Missing narrow recovery rule' }
        if ($env:PC_RECOVERY_TEST_CASE -eq 'failure') { $global:LASTEXITCODE = 1 }
    }
}
'@
    $harness = Join-Path $directory 'harness.ps1'
    [IO.File]::WriteAllText($harness, $mocks + "`r`n" + $source)
    $env:PC_RECOVERY_TEST_DIR = $directory
    # Include UTF-8 BOM to verify original encoding is restored exactly.
    $original = [byte[]](239,187,191) + [Text.Encoding]::UTF8.GetBytes("host all all 127.0.0.1/32 scram-sha-256`r`n")
    foreach ($case in @('success', 'failure', 'cancel', 'interrupted', 'auto-port', 'custom-hba', 'include-rejected', 'invalid-port')) {
        $env:PC_RECOVERY_TEST_CASE = $case
        $hba = Join-Path $directory 'pg_hba.conf'
        $env:PC_RECOVERY_TEST_PORT = '5432'
        $configFile = Join-Path $directory 'postgresql.conf'
        $autoFile = Join-Path $directory 'postgresql.auto.conf'
        [IO.File]::WriteAllText($configFile, "# port = 9999`r`nport = 5432 # standard setting`r`n")
        [IO.File]::WriteAllText($autoFile, '# no overrides')
        if ($case -eq 'auto-port') { [IO.File]::WriteAllText($autoFile, "port = '55432'"); $env:PC_RECOVERY_TEST_PORT = '55432' }
        if ($case -eq 'custom-hba') {
            $hba = Join-Path $directory 'custom-access.conf'
            [IO.File]::WriteAllText($autoFile, ("hba_file = '" + $hba.Replace('\', '/') + "' # custom path"))
        }
        if ($case -eq 'include-rejected') { [IO.File]::AppendAllText($configFile, "include 'other.conf'") }
        if ($case -eq 'invalid-port') { [IO.File]::AppendAllText($configFile, 'port = 99999') }
        $env:PC_RECOVERY_TEST_HBA = $hba
        [IO.File]::WriteAllBytes($hba, $original)
        if ($case -eq 'interrupted') {
            [IO.File]::WriteAllBytes("$hba.playcoffee-password-backup", $original)
            [IO.File]::WriteAllText($hba, 'temporary interrupted rule')
        }
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $harness | Out-Null
        $expected = if ($case -in @('failure', 'include-rejected', 'invalid-port')) { 1 } else { 0 }
        if ($LASTEXITCODE -ne $expected) { throw "Unexpected recovery exit code for $case" }
        if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($hba)) -ne [Convert]::ToBase64String($original)) { throw "Authentication was not restored exactly for $case" }
        if (Test-Path -LiteralPath "$hba.playcoffee-password-backup") { throw "Backup was left after completed restoration for $case" }
        Write-Host "PASS: $case - original authentication preserved/restored" -ForegroundColor Green
    }
} finally {
    Remove-Item Env:PC_RECOVERY_TEST_DIR, Env:PC_RECOVERY_TEST_CASE, Env:PC_RECOVERY_TEST_PORT, Env:PC_RECOVERY_TEST_HBA -ErrorAction SilentlyContinue
    $resolved = (Resolve-Path -LiteralPath $directory).Path
    if (-not $resolved.StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe cleanup path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
