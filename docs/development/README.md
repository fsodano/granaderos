# Development

[Documentation index](../README.md)

This index lists the setup, architecture, authoring, and system guides for the
browser game and campaign editor. Use [development setup](getting-started.md) to
install dependencies, start the browser game, and run the available checks. The
[campaign studio](../authoring/campaign-studio.md) authors the supported package
format. Community publishing and wider mechanics remain
[future work](../plans/campaign-authoring.md). Standalone editors keep their
bounded experimental workflows.

| Area | Read |
| --- | --- |
| Repository folders and source navigation | [Repository map](repository-layout.md) |
| Browser architecture and runtime sequences | [Architecture guide](../architecture/README.md) |
| Setup, commands and source layout | [Getting started](getting-started.md) |
| Browser campaign studio workflow and supported scope | [Campaign studio](../authoring/campaign-studio.md) |
| Extend editor fields, panels and controlled adapters | [Editor development](editor-development.md) |
| Editor UX/DX contracts and bounded acceptance | [Editor experience plan](../plans/editor-experience.md) |
| Create, check and install a local campaign folder | [Campaign authoring](campaign-authoring.md) |
| Experimental campaign content editor | [Story editor](story-editor.md) |
| Experimental editable example | [La ruta de las postas](example-post-campaign.md) |
| Future community publishing and distribution | [Campaign authoring plan](../plans/campaign-authoring.md) |
| Tactical map authoring | [Sector editor](sector-editor.md) |
| Browser campaign systems | [Browser campaign systems](WEB-SYSTEMS.md) |
| Save storage and compaction | [Compact campaign saves](compact-saves.md) |
| Combat, ballistics and running tuning | [Combat tuning](combat-balance.md) |
| Classic JA2 gameplay requirements | [JA2 parity requirements](../requirements/ja2-parity.md) |
| Campaign map format | [Wall edges](../specification/wall-edges.md) |
| Expected rules and player controls | [Gameplay](../gameplay/README.md) |
| Source-engine behavior and adaptation | [JA2 engine reference](../web-port/README.md) |

The browser implementation lives in `packages/game/` and `apps/web/`. The earlier native build
is documented separately in [native build reference](../reference/native-build.md).
The engine submodule is not required for the browser setup.
