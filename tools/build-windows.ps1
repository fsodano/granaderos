[CmdletBinding()]
param(
    [ValidateSet('JA2', 'JA2MAPEDITOR')][string]$Application = 'JA2',
    [ValidateSet('Release', 'RelWithDebInfo', 'Debug')][string]$Configuration = 'RelWithDebInfo',
    [string]$BuildDirectory = '',
    [int]$Parallel = 4
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
if (-not $IsWindows) { throw 'Build requires Windows and the Visual Studio x86 developer environment.' }
if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) { throw 'Run from a Visual Studio x86 Native Tools command prompt (Desktop development with C++ workload).' }
if (-not $BuildDirectory) { $BuildDirectory = Join-Path $root "build/$Application" }
$version = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { throw 'VERSION must contain a semantic version.' }
$commit = (& git -C $root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot determine Granaderos source revision.' }
$engineCommit = (& git -C (Join-Path $root 'engine') rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Initialize the pinned engine submodule: git submodule update --init --recursive' }
& python (Join-Path $root 'tools/apply_engine_patch.py')
if ($LASTEXITCODE -ne 0) { throw "Granaderos engine patch failed ($LASTEXITCODE)." }
& cmake -S (Join-Path $root 'engine') -B $BuildDirectory -G Ninja "-DCMAKE_BUILD_TYPE=$Configuration" "-DApplications=$Application" "-DGRANADEROS=ON" "-DGIT_SHA=$($commit.Substring(0,9))" "-DGAME_BUILD_INFORMATION=Granaderos $version ($($commit.Substring(0,9))) / JA2 $($engineCommit.Substring(0,9))"
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed ($LASTEXITCODE)." }
& cmake --build $BuildDirectory --target $Application --parallel $Parallel
if ($LASTEXITCODE -ne 0) { throw "CMake build failed ($LASTEXITCODE)." }
$executable = Join-Path $BuildDirectory "$Application.exe"
if (-not (Test-Path $executable)) { throw "Expected executable is absent: $executable" }
Write-Host "Built $executable"
