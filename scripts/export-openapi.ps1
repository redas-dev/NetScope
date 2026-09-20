param([string]$BaseUrl = 'http://localhost:5220')
$ErrorActionPreference = 'Stop'
$path = Join-Path (Split-Path $PSScriptRoot -Parent) 'docs/openapi.json'
Invoke-WebRequest "$BaseUrl/openapi/v1.json" -OutFile $path
Write-Host "OpenAPI saved to $path"
