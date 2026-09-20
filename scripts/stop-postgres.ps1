$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& (Join-Path $root '.local/pgsql/bin/pg_ctl.exe') stop -D (Join-Path $root '.local/pgdata') -m fast -w
if ($LASTEXITCODE -ne 0) { throw 'Could not stop project PostgreSQL' }
