param([int]$HttpsPort = 3443)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Ejecuta este script como administrador para configurar el Firewall de Windows.'
}

$rules = @(@{ Name = 'PlayCoffee HTTPS Local'; Port = $HttpsPort })
foreach ($rule in $rules) {
    Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $rule.Port -Profile Private | Out-Null
}
Write-Host "Firewall configurado para la red privada en el puerto HTTPS $HttpsPort." -ForegroundColor Green
