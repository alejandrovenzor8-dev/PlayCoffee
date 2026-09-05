param(
    [Parameter(Mandatory)][string]$LanAddress,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$HostName = 'playcoffee.local',
    [switch]$SkipTrust
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($LanAddress, [ref]$parsedAddress)) {
    throw 'LanAddress debe ser una direccion IP valida'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$rootCertificate = New-SelfSignedCertificate -Type Custom -Subject 'CN=PlayCoffee Local CA' -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -KeyUsage CertSign, CRLSign, DigitalSignature -NotAfter (Get-Date).AddYears(10) -CertStoreLocation 'Cert:\CurrentUser\My' -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0')
$san = "2.5.29.17={text}dns=$HostName&ipaddress=$LanAddress"
$serverCertificate = New-SelfSignedCertificate -Type Custom -Subject "CN=$HostName" -Signer $rootCertificate -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -KeyUsage DigitalSignature, KeyEncipherment -NotAfter (Get-Date).AddYears(3) -CertStoreLocation 'Cert:\CurrentUser\My' -TextExtension @($san, '2.5.29.19={text}ca=0', '2.5.29.37={text}1.3.6.1.5.5.7.3.1')

$passwordBytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $generator.GetBytes($passwordBytes)
} finally {
    $generator.Dispose()
}
$password = [Convert]::ToBase64String($passwordBytes)
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$rootPath = Join-Path $OutputDirectory 'playcoffee-local-ca.cer'
$pfxPath = Join-Path $OutputDirectory 'playcoffee-local-server.pfx'

try {
    Export-Certificate -Cert $rootCertificate -FilePath $rootPath -Force | Out-Null
    Export-PfxCertificate -Cert $serverCertificate -FilePath $pfxPath -Password $securePassword -Force | Out-Null
    if (-not $SkipTrust) {
        Import-Certificate -FilePath $rootPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    }
} finally {
    Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($serverCertificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($rootCertificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
}

[pscustomobject]@{
    PfxPath = $pfxPath
    PfxPassword = $password
    RootCertificatePath = $rootPath
    RootCertificateThumbprint = $rootCertificate.Thumbprint
    HostName = $HostName
    LanAddress = $LanAddress
}
