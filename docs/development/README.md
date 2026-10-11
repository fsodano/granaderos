# Development

[Documentation index](../README.md)

Use [development setup](getting-started.md) to install dependencies, start the
browser game and run the available checks.
Read the [campaign separation record](../verification/campaign-engine-separation-2026-10-10.md)
for current scope and limits. The [version 0.1 status](../verification/version-0.1.md)
retains its tagged checkpoint. The [campaign studio](../authoring/campaign-studio.md)
authors the supported package format; its evidence records the browser review
limits. Community publishing and wider mechanics remain
[future work](../plans/campaign-authoring.md). Standalone editors retain their
bounded experimental workflows.

| Area | Read |
| --- | --- |
| Setup, commands and source layout | [Getting started](getting-started.md) |
| Browser campaign studio workflow and verified scope | [Campaign studio](../authoring/campaign-studio.md) |
| Extend editor fields, panels and controlled adapters | [Editor development](editor-development.md) |
| Editor UX/DX contracts and bounded acceptance | [Editor experience plan](../plans/editor-experience.md) |
| Create, check and install a local campaign folder | [Campaign authoring](campaign-authoring.md) |
| Experimental campaign content editor | [Story editor](story-editor.md) |
| Experimental editable example | [La ruta de las postas](example-post-campaign.md) |
| Future community publishing and distribution | [Campaign authoring plan](../plans/campaign-authoring.md) |
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
feature note, [version status](../verification/version-0.1.md) and each record's
source and date before treating an older rule or test count as current.

Notes marked as development-workspace records describe the checkout at their
recorded date. Some work was merged later. Inclusion here does not prove that
the current game passes those earlier checks.
