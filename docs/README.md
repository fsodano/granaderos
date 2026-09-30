# Granaderos documentation

Granaderos is a browser strategy and tactical game in active development. Start
with the [project README](../README.md) for the game overview and local setup.
Player-facing text is Spanish. Code and documentation are English.

## Start here

| Task | Read |
| --- | --- |
| Install, run, build or test the browser game | [Development setup](development/getting-started.md) |
| Learn controls and find a game system | [Gameplay guide](gameplay/README.md) |
| Check what works and what remains open | [Current gameplay acceptance](verification/gameplay-completion.md) |
| Check the required JA2 behavior | [Gameplay parity audit](verification/ja2-parity-audit.md) |
| Find the latest recorded changes and failures | [27 September follow-up](verification/gameplay-follow-up-2026-09-27.md) |
| Find art sources, sprite rules and visual decisions | [Art guide](art/README.md) and [decision records](adr/README.md) |

## Documentation map

| Folder | Contents |
| --- | --- |
| [Gameplay](gameplay/README.md) | Campaign, combat, equipment, characters and player controls |
| [Development](development/README.md) | Browser setup, system notes, saves and performance work |
| [Verification](verification/README.md) | Current acceptance, audits, route checks and dated results |
| [Evidence](evidence/README.md) | Saved route results and performance measurements |
| [Art](art/README.md) | Buildings, portraits, sprite families and render quality |
| [Architecture decisions](adr/README.md) | Recorded visual decisions and their reference images |
| [Plans](plans/README.md) | Implementation proposals and acceptance criteria |
| [Specifications](specification/README.md) | Original design and later gameplay requirements |
| [JA2 engine reference](web-port/README.md) | Source analysis and browser adaptation notes |
| [Other references](reference/README.md) | Period equipment evidence and the earlier native build |
| [Archive](archive/README.md) | Superseded progress ledgers, audits and design snapshots |

The [changelog](CHANGELOG.md) records release checkpoints. It is not a current
feature list.

## Which document governs status?

1. [Current gameplay acceptance](verification/gameplay-completion.md) records the
   latest accepted scope and known failures. Read its dated opening section first.
2. [The parity audit](verification/ja2-parity-audit.md) defines the detailed gameplay
   requirement baseline. A smaller work list does not reduce that scope.
3. Feature notes and [verification records](verification/README.md) explain a
   specific behavior or check. Their dates and stated limits matter. A passing
   focused check does not prove that the full campaign passes.
4. [Specifications](specification/README.md) preserve requirements. [Plans](plans/README.md)
   describe intended work. [Archived records](archive/README.md) describe earlier
   states. None is a substitute for current acceptance evidence.

Full gameplay completion and the complete fresh campaign remain unverified in
the current acceptance record.

## Keep the documentation usable

- Put a new note in the matching topic folder and add it to that folder's index.
- Use relative Markdown links between documents. In code-formatted source
  references, paths such as `game/tactical.js` start at the repository root.
- State the date, tested scope, result and limits of verification. Keep raw
  measurements in `evidence/` and link them from the record.
- Keep older results when a new check changes the conclusion. Mark superseded
  statements and update the current acceptance record.
- Keep player help in Spanish and contributor documentation in English.
