$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'
if (!(Test-Path $envFile)) {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $key = [Convert]::ToBase64String($bytes)
    Set-Content -LiteralPath $envFile -Value "JWT_KEY=$key" -Encoding ascii
}
$line = Get-Content $envFile | Where-Object { $_ -match '^JWT_KEY=' } | Select-Object -First 1
if (!$line) { throw 'Missing JWT_KEY in .env' }
$config = @{ Jwt = @{ Key = $line.Substring(8) } } | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $root 'NetScope.Server/appsettings.Local.json') -Value $config -Encoding utf8
Write-Host 'Local JWT secret is ready. Start with: docker compose up --build -d'
