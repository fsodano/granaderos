[CmdletBinding()]
param([string]$BinariesDirectory = 'build/binaries', [string]$OutputDirectory = 'dist')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { throw 'Invalid semantic version.' }
if (-not [IO.Path]::IsPathRooted($BinariesDirectory)) { $BinariesDirectory = Join-Path $root $BinariesDirectory }
if (-not [IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory = Join-Path $root $OutputDirectory }
foreach ($app in @('JA2', 'JA2MAPEDITOR')) {
    $path = Join-Path $BinariesDirectory "$app.exe"
    if (-not (Test-Path $path)) { throw "Missing compiled executable: $path" }
    $stream = [IO.File]::OpenRead($path)
    try { if ($stream.ReadByte() -ne 77 -or $stream.ReadByte() -ne 90) { throw "Not a Windows executable: $path" } }
    finally { $stream.Dispose() }
}
$package = Join-Path $OutputDirectory "Granaderos-$version-windows"
if (Test-Path $package) { throw "Output exists; remove it explicitly before repackaging: $package" }
New-Item -ItemType Directory -Path $package -Force | Out-Null
# The pinned upstream's freely distributed 1.13 gamedir is the runtime base.
# Original commercial JA2 Data/ archives are deliberately not bundled.
Get-ChildItem (Join-Path $root 'engine/gamedir') -Force |
    Where-Object { $_.Name -notlike '.*' } |
    Copy-Item -Destination $package -Recurse -Force
Get-ChildItem (Join-Path $root 'mod') -Force | Copy-Item -Destination $package -Recurse -Force
foreach ($app in @('JA2', 'JA2MAPEDITOR')) { Copy-Item (Join-Path $BinariesDirectory "$app.exe") $package }
$sourceCommit = (& git -C $root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot read source revision.' }
$engineCommit = (& git -C (Join-Path $root 'engine') rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot read engine revision.' }
@{
    version = $version
    granaderos_commit = $sourceCommit
    engine_commit = $engineCommit
    requires_original_ja2 = $true
    executables = @('JA2.exe', 'JA2MAPEDITOR.exe')
} | ConvertTo-Json | Set-Content (Join-Path $package 'Granaderos-build.json') -Encoding utf8
Copy-Item (Join-Path $root 'docs/build.md') (Join-Path $package 'BUILD-AND-INSTALL.md')
Get-ChildItem $package -Recurse -File | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($package, $_.FullName).Replace('\', '/')
    '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relative
} | Set-Content (Join-Path $package 'SHA256SUMS.txt') -Encoding utf8
Write-Host "Packaged $package"
