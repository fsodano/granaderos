# Repository layout verification — 28 October 2026

[Verification index](README.md) · [Repository map](../development/repository-layout.md)

## Scope

This record covers the repository directory layout, documentation, build,
automated checks, and bounded browser verification.
The [repository map](../development/repository-layout.md) explains each directory
and gives a reading path from a player intention to its domain model and storage
adapter. The [accepted plan](../plans/accepted/domain-architecture.md) defines the
architecture within those directories.

The source groups are:

| Directory | Responsibility |
| --- | --- |
| `apps` | Player application and independent campaign editor |
| `packages` | Game package and published campaign file contracts |
| `content` | Authored campaigns, campaign media, and art sources |
| `docs` | Architecture, guides, accepted plans, and retained evidence |
| `tests` | Integration tests and fixtures |
| `tools` | Build, validation, art production, and visual review tools |
| `reference/native` | Separate native engine, overlay, conversion data, and patches |
| `.output` | Local generated builds, caches, and diagnostics |

The game layers remain inside `packages/game`. The editor retains its own domain,
application, infrastructure, and browser code inside `apps/campaign-editor`.
Campaign file contracts belong to `packages/campaign-format`.

## Documentation checks

The documentation check covers root `README.md`, root `AGENTS.md`, and all
Markdown files under `docs`. It checks relative Markdown links and embedded HTML
`src` and `href` targets against the current filesystem. It decodes escaped path
characters and excludes URL query strings and fragments from the file lookup.
External URLs and fragment destinations are outside this check.

Result: **3,481 relative targets checked in 563 Markdown files; no missing
targets.** Whitespace validation of the root README, repository instructions,
and documentation changes also passed.

The root navigation, development setup, architecture diagrams, accepted layout,
glossary, and plans index use the current source paths. The trailer, captions,
and source media remain linked from the root README. Dated evidence retains its
original source, date, result, and scope; local links point to the current file
locations.

Campaign resource paths remain relative to the campaign package. Public browser
URLs such as `/campaigns/`, `/campaign-editor/`, `/art/`, and `/models/` retain their
meaning and deployment prefix rules. Filesystem groups are not URL prefixes.

## Local IDE setup

The local WebStorm project excludes generated output, dependencies, IDE/tool
metadata, and the pinned native engine. **Show Excluded Files** is off in the
Project tool window. The [repository map](../development/repository-layout.md#keep-the-ide-project-view-focused)
contains the steps to reproduce this view. The local `.idea` configuration stays
ignored by Git. A screenshot is stored at
`.output/layout-verification/ide-project-tree.png`.

## Source and asset preservation

All 13,857 original tracked entries have a destination in the staged layout.
The accepted-plan index is incorporated into `docs/plans/README.md`. File modes
are preserved. All 7,499 binary files match their original Git blob identities.
The native engine remains pinned to
`ddb691318eb3dd0cdc6eab42139739b6d498c645` and its working tree is clean.

Published character receipts keep their source identities. The
[character tool contract](../../tools/characters-3d/README.md) describes the exact
hash mapping for 12 relocated sources. Checks reject changed source bytes and
accept both POSIX and Windows path separators. The relocation changes no
published model, texture, or recipe parameter.

## Automated checks

| Check | Result |
| --- | --- |
| Main suite, `npm test` | 347 tests passed; no failures or skipped tests |
| Game, player application, and editor type checks | Passed |
| Architecture boundaries | 967 source files passed |
| Architecture formatting | 285 files passed |
| Editor dependency boundary | 457 game dependencies passed |
| Campaign-format package build | Passed |
| 3D playground tests | 27 tests passed, including served module URLs |
| Python conversion, STI, and source-provenance tests | 21 tests passed |
| Native black-powder C++ assertions | Compiled and passed locally |
| Documentation requirements audit | 275 requirements and 150 evidence records passed |
| Runtime baseline audit | 39 checks passed |
| Additional source-guide links | 42 relative targets in 52 first-party Markdown files passed |
| Staged whitespace validation | Passed |

Art verification also checked 25 apparel/equipment records, both standing
animation banks, and both coarse-garment models without changing published
assets. All 175 portrait source paths resolve.

`npm run build` builds both browser applications and stages the combined site
in `.output/dist`. Build `0.1.49 · cdc6ff4ef950` passed static verification of
2,751 exported files and 1,019 asset references. The build reports large bundle
warnings; bundle splitting is outside this directory change.

## Browser checks

The combined production export was served from `.output/dist` at
`http://127.0.0.1:4183` and opened in the real browser.

- The installed Granaderos campaign loaded its title screen and introduction.
- A new campaign reached the desk with 3,200 pesos and the recruitment roster.
- Reloading and selecting **Continuar campaña** restored the campaign desk.
- The independent editor created `layout-check` with two maps and one resource.
- The editor validated the package, saved it, and restored its documents and
  resource after reload. The installation instructions show `content/campaigns/`.
- Both application console error checks were empty.

Local logs and screenshots are in `.output/layout-verification`, including
`build.log`, `tests.log`, `python-tests.log`, `file-preservation.json`,
`staged-preservation.json`, `game-desk.png`, and `editor-validation.png`.

## Evidence limits

These checks establish the relocated build, tested contracts, source
preservation, and the browser flows listed above. They do not establish a full
campaign playthrough. The Windows engine was not compiled on macOS; its source
pin, local C++ assertions, conversion tests, and build paths were checked. The
[domain architecture record](domain-architecture-2026-10-28.md) contains the
architecture implementation checks and their scope.
