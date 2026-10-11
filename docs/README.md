# Granaderos documentation

Granaderos is a browser strategy and tactical game in active development. Read
the [campaign separation record](verification/campaign-engine-separation-2026-10-10.md)
for the current implementation and checks. The [version 0.1 status](verification/version-0.1.md)
retains the earlier tagged checkpoint. Start with the [project README](../README.md) for the game overview and local setup.
Player-facing text is Spanish. Code and documentation are English.

## Start here

| Task | Read |
| --- | --- |
| Install, run, build or test the browser game | [Development setup](development/getting-started.md) |
| Read the current game design | [Game design](specification/game-design.md) |
| Check version 0.1 scope and remaining work | [Version 0.1 status](verification/version-0.1.md) |
| Check current engine and campaign separation | [Campaign separation](verification/campaign-engine-separation-2026-10-10.md) |
| Find requirement history and feature evidence | [Published progress ledger](verification/published-progress.md) |
| Review the historical cross-branch verification | [27 September audit](verification/formal-audit-2026-09-27.md) |
| Review ammunition ownership and current limits | [Persistent ammunition](verification/strategic-ammunition-custody.md) |
| Create a campaign in the browser | [Campaign studio](authoring/campaign-studio.md) and [studio acceptance evidence](evidence/campaign-studio-2026-10-10/README.md) |
| Create, check and install local campaign folders | [Campaign authoring](development/campaign-authoring.md) |
| Use the experimental content editor | [Story editor](development/story-editor.md) |
| Inspect or modify the experimental example | [La ruta de las postas](development/example-post-campaign.md) |
| Review future campaign creation and sharing | [Campaign authoring plan](plans/campaign-authoring.md) |
| Build tactical sectors | [Sector editor](development/sector-editor.md) |
| Find controls and game-system notes | [Gameplay index](gameplay/README.md) |
| Find art sources and visual decisions | [Art guide](art/README.md) and [decision records](adr/README.md) |
| Review historical workspace acceptance | [Development-workspace acceptance](verification/gameplay-completion.md) |

The [alpha service-equipment record](verification/alpha-service-equipment-return-2026-10-01.md)
and [PR #139 consolidation](verification/latest-build-consolidation.md) retain
their 1 October source, checks and delivery limits. They do not describe the
current version's complete acceptance. Full community campaign creation and
sharing are [future work](plans/campaign-authoring.md).

## Documentation map

| Folder | Contents |
| --- | --- |
| [Gameplay](gameplay/README.md) | Campaign, combat, equipment, characters and controls |
| [Authoring](authoring/README.md) | Campaign studio workflow, portable projects and installable packages |
| [Development](development/README.md) | Browser setup, editors, system notes and performance work |
| [Verification](verification/README.md) | Published progress, separate workspace audits and dated results |
| [Evidence](evidence/README.md) | Saved workspace route results and performance measurements |
| [Art](art/README.md) | Buildings, portraits, sprite families and render quality |
| [Architecture decisions](adr/README.md) | Visual decisions and reference images |
| [Plans](plans/README.md) | Implementation proposals and acceptance criteria |
| [Specifications](specification/README.md) | Original design and later gameplay requirements |
| [JA2 engine reference](web-port/README.md) | Source analysis and browser adaptation notes |
| [Other references](reference/README.md) | Period equipment evidence and the earlier native build |
| [Archive](archive/README.md) | Superseded progress ledgers, audits and design snapshots |

The [changelog](CHANGELOG.md) records release checkpoints.

## Current design and tracking

[Version 0.1 status](verification/version-0.1.md) records the current release
scope. [Game design](specification/game-design.md) records the product design.
[Published progress](verification/published-progress.md) is generated from
[the requirement register](verification/requirements.json). It separates published
work, local-only code, failed acceptance, missing behavior and unverified claims.
[The formal audit](verification/formal-audit-2026-09-27.md) preserves the evidence.
These documents extend this topic structure; they do not replace the feature notes.

Update the affected register rows in each feature PR, then run
`npm run docs:progress` and `npm run audit:docs`. A dated audit remains a snapshot.
The old [PROGRESS.md link](PROGRESS.md) leads to the same active ledger.
Explicit user decisions override older design notes; record the resolution in
the current design and register. Preserve all original and parity requirements.

## Which document governs status?

1. The [version 0.1 status](verification/version-0.1.md) records the version's
   scope, current source evidence and known limits. A version tag does not prove
   game completion or publish a new GitHub Pages deployment.
2. Published feature guides describe bounded behavior. Use the progress ledger
   and each record's source, date and limits when assessing completion. The
   generated ledger includes historical acceptance and can lag later changes.
3. Notes marked **development-workspace record** describe the separate advanced
   gameplay checkout at their recorded date. Later work can be merged. The
   [workspace acceptance record](verification/gameplay-completion.md) preserves
   its dated results. The [JA2 parity audit](verification/ja2-parity-audit.md)
   combines dated assessments and named published feature receipts; it does
   not establish full current parity.
4. [Specifications](specification/README.md), [plans](plans/README.md) and
   [archived records](archive/README.md) preserve requirements and history.
   They do not replace accepted scope changes or current verification.

Full game completion remains open. The existing editors support bounded,
experimental workflows. The complete browser campaign studio has
[its own scoped acceptance record](plans/campaign-studio.md). Community hosting and
sharing services remain future work. Publishing a development record does not prove
its implementation or acceptance on a later source.

## Keep the documentation usable

- Put a new note in the matching folder and add it to that folder's index.
- Use relative Markdown links between documents. Code-formatted source paths
  such as `game/tactical.js` start at the repository root.
- State the checkout or source commit, date, tested scope, result and limits of
  verification. Keep raw measurements in `evidence/` and link their record.
- Update the published progress ledger when an implementation is merged.
  Keep unpublished work clearly labelled and retain earlier results as history.
- Keep player help in Spanish and contributor documentation in English.
