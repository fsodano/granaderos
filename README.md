# Granaderos

A historical conversion of Jagged Alliance 2 v1.13 set during the Argentine War of Independence (1810–1820).

**In development. No complete or launch-tested Granaderos release exists yet.** This repository tracks the full supplied conversion specification, including original graphics, rather than a standalone browser game.

## Source layout

- `engine/`: upstream [1dot13/source](https://github.com/1dot13/source), pinned as a Git submodule.
- `mod/`: Granaderos game-data overlay.
- `native/` and `patches/`: Granaderos engine extensions and integration patches.
- `assets/`: original artwork, generation prompts, and engine-ready exports.
- `tools/`: deterministic generation, build, installation, and verification tools.
- `docs/specification/original.txt`: the supplied design, preserved verbatim.
- `docs/PROGRESS.md`: requirement checklist and evidence, including incomplete work.

Clone with `git clone --recurse-submodules https://github.com/fsodano/granaderos.git`.
The upstream engine targets Windows x86. Its original JA2 data dependency remains; a conversion source checkout is not a replacement for a licensed JA2 installation.

## Versioning and contributions

`VERSION` uses Semantic Versioning. Development milestones use prerelease versions; `1.0.0` requires the entire supplied specification to pass its completion audit. Work is checked in on feature branches and reviewed through pull requests. Generated files must be reproducible from committed source inputs. Build and unit-test evidence must not be represented as gameplay verification.

