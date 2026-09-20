param([int]$Port = 5434)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$local = Join-Path $root '.local'
$pgRoot = Join-Path $local 'pgsql'
$pgData = Join-Path $local 'pgdata'
New-Item -ItemType Directory -Force $local | Out-Null
if (!(Test-Path (Join-Path $pgRoot 'bin/pg_ctl.exe'))) {
    $archive = Join-Path $local 'postgresql.zip'
    if (!(Test-Path $archive)) {
        Write-Host 'Downloading PostgreSQL binaries from EnterpriseDB (about 326 MB)...'
        Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip' -OutFile $archive
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match '^pgsql/(bin|lib|share)/' -and $entry.Name -and $entry.FullName -notmatch '\.pdb$') {
                $target = [IO.Path]::GetFullPath((Join-Path $local $entry.FullName))
                if (!$target.StartsWith([IO.Path]::GetFullPath($pgRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid archive path' }
                New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
            }
        }
    } finally { $zip.Dispose() }
}
if (!(Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    $passwordFile = Join-Path $local 'pg-password.tmp'
    Set-Content $passwordFile 'NetScopeLocalDb2026' -Encoding ascii
    try {
        & (Join-Path $pgRoot 'bin/initdb.exe') -D $pgData -U netscope --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL initialization failed' }
    } finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
}
& (Join-Path $pgRoot 'bin/pg_ctl.exe') status -D $pgData
if ($LASTEXITCODE -ne 0) {
    $arguments = "start -D `"$pgData`" -l `"$(Join-Path $local 'postgres.log')`" -o `"-p $Port -h 127.0.0.1`" -w"
    $process = Start-Process -FilePath (Join-Path $pgRoot 'bin/pg_ctl.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru
    # Wait for pg_ctl only; Start-Process -Wait would also wait for the long-lived database.
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'PostgreSQL startup failed. See .local/postgres.log; verify port is free.' }
}
$priorPassword = $env:PGPASSWORD
$env:PGPASSWORD = 'NetScopeLocalDb2026'
try {
    $exists = & (Join-Path $pgRoot 'bin/psql.exe') -h 127.0.0.1 -p $Port -U netscope -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='netscope'"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to local PostgreSQL' }
    if ($exists -ne '1') {
        & (Join-Path $pgRoot 'bin/createdb.exe') -h 127.0.0.1 -p $Port -U netscope netscope
        if ($LASTEXITCODE -ne 0) { throw 'Could not create netscope database' }
    }
} finally { $env:PGPASSWORD = $priorPassword }
Write-Host "PostgreSQL is ready at 127.0.0.1:$Port. Data: $pgData"
