$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'setup.ps1')
& (Join-Path $PSScriptRoot 'start-postgres.ps1')
dotnet run --project (Join-Path (Split-Path $PSScriptRoot -Parent) 'NetScope.Server') --launch-profile http
if ($LASTEXITCODE -ne 0) { throw 'API exited with an error' }
