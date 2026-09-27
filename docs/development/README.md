# Development

[Documentation index](../README.md)

Use [development setup](getting-started.md) to install dependencies, start the
browser game and run the available checks.

| Area | Read |
| --- | --- |
| Setup, commands and source layout | [Getting started](getting-started.md) |
| Campaign content authoring | [Story editor](story-editor.md) |
| Tactical map authoring | [Sector editor](sector-editor.md) |
| Campaign architecture and implementation history | [Browser campaign systems](WEB-SYSTEMS.md) |
| Save storage and compaction | [Compact campaign saves](compact-saves.md) |
| Rendering, movement and worker measurements | [Performance notes](performance/README.md) |
| Expected rules and player controls | [Gameplay](../gameplay/README.md) |
| Source-engine behavior and adaptation | [JA2 engine reference](../web-port/README.md) |
| Current gaps and evidence | [Verification](../verification/README.md) |

The browser implementation lives in `game/` and `web/`. The earlier native build
is documented separately in [native build reference](../reference/native-build.md).
The engine submodule is not required for the browser setup.

System notes can contain earlier implementation checkpoints. Check the relevant
feature note and [published progress](../verification/published-progress.md)
before treating an older rule or test count as current.

Notes marked as development-workspace records describe separate, unpublished
integration work. Their implementation is not implied by inclusion here.
