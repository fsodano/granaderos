# Building and installing Granaderos

## Supported build

The pinned 1dot13 engine produces **32-bit Windows executables**. Its supported upstream build uses MSVC and Ninja. The Granaderos workflow builds the game (`JA2.exe`) and map editor (`JA2MAPEDITOR.exe`) independently and packages both with the pinned 1.13 game directory and the `mod/` overlay.

Requirements: Windows, Visual Studio 2022 with Desktop development with C++, Windows SDK, CMake 3.20 or newer, Ninja, Git, Python 3.12 or newer, and PowerShell 7. Use the **x86 Native Tools Command Prompt for VS 2022**, then run:

```powershell
git clone --recurse-submodules https://github.com/fsodano/granaderos.git
cd granaderos
pwsh
./tools/build-windows.ps1 -Application JA2
./tools/build-windows.ps1 -Application JA2MAPEDITOR
New-Item -ItemType Directory build/binaries -Force
Copy-Item build/JA2/JA2.exe, build/JA2MAPEDITOR/JA2MAPEDITOR.exe build/binaries/
python tools/generate_campaign.py
python -m unittest discover -s tests -v
./tools/build-package.ps1
```

The build script embeds the Granaderos semantic version, Granaderos commit, and upstream engine commit. The nine-character Granaderos revision is the engine's save compatibility identifier. The workflow uses the committed engine submodule revision, never a floating upstream branch.

## GitHub Actions

The **Windows engine and Granaderos package** workflow runs on pull requests, main pushes, version tags, and manual dispatch. Download `Granaderos-windows-overlay` from a successful run. Separate `windows-JA2` and `windows-JA2MAPEDITOR` artifacts hold executables and available debug symbols. Build success proves compilation and packaging; it does **not** prove gameplay correctness.

```sh
gh workflow run build-windows.yml --ref YOUR_BRANCH
gh run list --workflow build-windows.yml
gh run view RUN_ID --log-failed
gh run download RUN_ID --name Granaderos-windows-overlay
```

## Installation and runtime verification

1. Install an original, legally obtained Jagged Alliance 2 copy in a writable directory outside Program Files. Keep a backup; use a separate installation for Granaderos.
2. Copy the **contents** of the packaged `Granaderos-<version>-windows` directory over that installation. The package contains the pinned 1.13 runtime data, DLLs, both executables, and Granaderos overlay.
3. Launch using the Granaderos launcher supplied in the overlay. The game must load the Granaderos VFS profile rather than the ordinary JA2 campaign.
4. Record successful startup, campaign entry, tactical combat, saving and reloading before claiming the build is playable. The map editor needs separate runtime verification.

The original commercial `Data/` archives are not provided by the source repository and are not bundled by this project. A successful C++ compilation does not remove this runtime dependency. The upstream installation instructions require an original JA2 installation: https://github.com/1dot13/source#installation.

The package contains `Granaderos-build.json` for source provenance and `SHA256SUMS.txt` for file integrity. Packaging refuses to overwrite an existing output directory.

## macOS host limitation

The development host is macOS on ARM. A native macOS build is not supported by this Windows engine. Upstream has a clang-cl cross toolchain requiring LLVM tools and a separately installed Microsoft SDK. Its MinGW toolchain explicitly remains a TODO. Windows CI is the supported build path; Wine runtime testing still needs the original JA2 data and a compatible Wine installation. No native macOS port or unverified Wine compatibility is implied.
