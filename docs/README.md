# Granaderos documentation

This index maps every documentation folder in the repository. Granaderos is a
browser strategy and tactical game. Source and its commit history define the
code; these documents define requirements, design, and the behavior a reader
should expect. Start with the [project README](../README.md) for the game
overview and local setup. Player-facing text is Spanish. Code and documentation
are English.

## Start here

| Task | Read |
| --- | --- |
| Find source files and understand the repository layout | [Repository map](development/repository-layout.md) |
| Understand how the browser game fits together | [Progressive architecture guide](architecture/README.md) and [C4 levels 1–3](architecture/c4.md) |
| Explore player and campaign-author capabilities | [Use-case catalogue](architecture/use-cases/README.md) |
| Read the target domain architecture and naming contract | [Domain architecture](plans/accepted/domain-architecture.md) and [ubiquitous language](plans/accepted/ubiquitous-language.md) |
| Install, run, build or test the browser game | [Development setup](development/getting-started.md) |
| Read the current game design | [Game design](specification/game-design.md) |
| Read the classic JA2 gameplay requirements baseline | [JA2 parity requirements](requirements/ja2-parity.md) |
| Read the campaign map format | [Wall edges](specification/wall-edges.md) |
| Create a campaign in the browser | [Campaign editor](authoring/campaign-studio.md) |
| Extend or improve the editing tools | [Editor development](development/editor-development.md) and [editor experience plan](plans/editor-experience.md) |
| Create, check and install local campaign folders | [Campaign authoring](development/campaign-authoring.md) |
| Use the experimental content editor | [Story editor](development/story-editor.md) |
| Inspect or modify the experimental example | [La ruta de las postas](development/example-post-campaign.md) |
| Review future campaign creation and sharing | [Campaign authoring plan](plans/campaign-authoring.md) |
| Build tactical sectors | [Sector editor](development/sector-editor.md) |
| Find controls and game-system notes | [Gameplay index](gameplay/README.md) |
| Find art sources and visual decisions | [Art guide](art/README.md) and [decision records](adr/README.md) |

## Documentation map

| Folder | Contents |
| --- | --- |
| [Architecture](architecture/README.md) | Progressive system overview, sequence diagrams, C4 diagrams, and the use-case catalogue |
| [Gameplay](gameplay/README.md) | Campaign, combat, equipment, characters, and controls |
| [Authoring](authoring/README.md) | Campaign studio workflow, portable projects, and installable packages |
| [Development](development/README.md) | Browser setup, repository map, editors, and system notes |
| [Requirements](requirements/ja2-parity.md) | The classic JA2 gameplay requirements baseline and its sources |
| [Art](art/README.md) | Buildings, portraits, sprite families, and render quality |
| [Architecture decisions](adr/README.md) | Visual decisions and reference images |
| [Plans](plans/README.md) | Accepted architecture, ubiquitous language, feature proposals, and acceptance criteria |
| [Specifications](specification/README.md) | Current product design, portability formats, and historical gameplay requirements |
| [JA2 engine reference](web-port/README.md) | Source analysis and browser adaptation notes |
| [Other references](reference/README.md) | Period equipment sources and the earlier native build (`references/` holds archived playtest and visual reference screenshots) |

## What governs a decision

1. Current user instructions override older design notes. Record the resolution
   in the current design.
2. Accepted plans and the [ubiquitous language](plans/accepted/ubiquitous-language.md)
   govern architecture and naming for new work.
3. [Specifications](specification/README.md) and
   [requirements](requirements/ja2-parity.md) preserve the product requirements,
   including every original and parity requirement with its external source.
4. Source code defines current behavior. These documents describe requirements
   and intended behavior, so read the named entry points when the two disagree.

## Keep the documentation usable

- Put a new note in the matching folder and add it to that folder's index.
- Use relative Markdown links between documents. Code-formatted source paths
  such as `packages/game/tactical.js` start at the repository root.
- State requirements, rules, and current behavior. Do not record implementation,
  verification, delivery or publication status, dates, commit hashes, test
  counts or run results: the commit history is that record.
- Keep local build, cache and diagnostic output in ignored `.output/`.
- Keep player help in Spanish and contributor documentation in English.
