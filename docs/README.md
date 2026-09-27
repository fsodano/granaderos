# Granaderos documentation

Granaderos is a browser strategy and tactical game in active development. Start
with the [project README](../README.md) for the game overview and local setup.
Player-facing text is Spanish. Code and documentation are English.

## Start here

| Task | Read |
| --- | --- |
| Install, run, build or test the browser game | [Development setup](development/getting-started.md) |
| Check published features and remaining work | [Published progress ledger](verification/published-progress.md) |
| Edit campaign content | [Story editor](development/story-editor.md) |
| Build tactical sectors | [Sector editor](development/sector-editor.md) |
| Find controls and game-system notes | [Gameplay index](gameplay/README.md) |
| Find art sources and visual decisions | [Art guide](art/README.md) and [decision records](adr/README.md) |
| Review unpublished gameplay integration | [Development-workspace acceptance](verification/gameplay-completion.md) |

## Documentation map

| Folder | Contents |
| --- | --- |
| [Gameplay](gameplay/README.md) | Campaign, combat, equipment, characters and controls |
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

## Which document governs status?

1. The [published progress ledger](verification/published-progress.md) is the
   primary status record for GitHub `main`. Its approved economy and contract
   changes take precedence over older requirements and workspace prototypes.
2. Published feature guides describe bounded behavior. Use the progress ledger
   and each record's date and limits when assessing completion.
3. Notes marked **development-workspace record** describe the separate advanced
   gameplay checkout. The [workspace acceptance record](verification/gameplay-completion.md)
   and [JA2 parity audit](verification/ja2-parity-audit.md) preserve its results
   and requirements. They do not establish that those features are on `main`.
4. [Specifications](specification/README.md), [plans](plans/README.md) and
   [archived records](archive/README.md) preserve requirements and history.
   They do not replace accepted scope changes or current verification.

Full game and story-editor completion remain open. Publishing a development
record does not publish its implementation.

## Keep the documentation usable

- Put a new note in the matching folder and add it to that folder's index.
- Use relative Markdown links between documents. Code-formatted source paths
  such as `game/tactical.js` start at the repository root.
- State the checkout or source commit, date, tested scope, result and limits of
  verification. Keep raw measurements in `evidence/` and link their record.
- Update the published progress ledger when an implementation is merged.
  Keep unpublished work clearly labelled and retain earlier results as history.
- Keep player help in Spanish and contributor documentation in English.
