# Tactical reference graphics delivery audit

[Picture gallery](../art/tactical-reference-gallery-2026-10-08.md) · [Plan](../plans/tactical-reference-graphics.md)

All 17 accepted changes are merged through main
`896e1e93db3c54bba9e9de4137def2b9572e2cb6`. Piece 5 is a rejected trial with
the original models retained. This documentation handover adds no test or render.
The counts below are the recorded completed local quick results, not new runs.

| Piece | Recorded outcome | Final quick: tests / selected files | Review |
| --- | --- | --- | --- |
| 1 | Merged [#306](https://github.com/fsodano/granaderos/pull/306) | 6,721 / 884 | [Record](../art/character-cloth-depth-review-2026-10-08.md) |
| 2 | Merged [#307](https://github.com/fsodano/granaderos/pull/307) | 6,743 / 885 | [Record](../art/character-family-cloth-depth-review-2026-10-08.md) |
| 3 | Merged [#308](https://github.com/fsodano/granaderos/pull/308) | 6,770 / 886 | [Record](../art/character-apparel-surfaces-review-2026-10-08.md) |
| 4 | Merged [#309](https://github.com/fsodano/granaderos/pull/309) | 6,775 / 887 | [Record](../art/character-poncho-normals-review-2026-10-08.md) |
| 5 | Rejected; models retained | Not applicable | [Record](../art/character-outer-garment-fit-review-2026-10-08.md) |
| 6 | Merged [#312](https://github.com/fsodano/granaderos/pull/312) | 6,796 / 890 | [Record](../art/character-standing-free-arm-review-2026-10-08.md) |
| 7 | Merged [#310](https://github.com/fsodano/granaderos/pull/310) | 6,783 / 888 | [Record](../art/terrain-boundaries-review-2026-10-08.md) |
| 8 | Merged [#311](https://github.com/fsodano/granaderos/pull/311) | 6,788 / 889 | [Record](../art/soil-fragments-review-2026-10-08.md) |
| 9 | Merged [#313](https://github.com/fsodano/granaderos/pull/313) | 6,801 / 891 | [Record](../art/dry-weeds-review-2026-10-08.md) |
| 10 | Merged [#314](https://github.com/fsodano/granaderos/pull/314) | 6,808 / 893 | [Record](../art/rock-forms-review-2026-10-08.md) |
| 11 | Merged [#315](https://github.com/fsodano/granaderos/pull/315) | 6,811 / 894 | [Record](../art/leaf-sprays-review-2026-10-08.md) |
| 12 | Merged [#316](https://github.com/fsodano/granaderos/pull/316) | 6,823 / 896 | [Record](../art/timber-furniture-review-2026-10-08.md) |
| 13 | Merged [#317](https://github.com/fsodano/granaderos/pull/317) | 6,831 / 897 | [Record](../art/soft-bedding-review-2026-10-08.md) |
| 14 | Merged [#318](https://github.com/fsodano/granaderos/pull/318) | 6,838 / 898 | [Record](../art/washstand-review-2026-10-08.md) |
| 15 | Merged [#319](https://github.com/fsodano/granaderos/pull/319) | 6,851 / 900 | [Record](../art/hearth-review-2026-10-08.md) |
| 16 | Merged [#320](https://github.com/fsodano/granaderos/pull/320) | 6,856 / 901 | [Record](../art/shelf-vessels-review-2026-10-08.md) |
| 17 | Merged [#321](https://github.com/fsodano/granaderos/pull/321) | 6,862 / 902 | [Record](../art/storage-cloth-review-2026-10-08.md) |
| 18 | Merged [#322](https://github.com/fsodano/granaderos/pull/322) | 6,869 / 904 | [Record](../art/room-floors-review-2026-10-08.md) |

Each completed final quick reports zero failures, skips and cancellations.
Standard profile file exclusions are separate from test skips. Typecheck and
production build records pass. The final piece 18 source, dependency, runtime,
engine and production proof passed against the accepted candidate and isolated root.
Final production source:
`755475a0cd6e40c218f25b35802d00eabca94a35e75ccb176b086cc7f4c2f953`.

## Decisions and limits

- Piece 5 was rejected. The worker LOD2 vest and shawl LOD1/2 remain unchanged.
  A rest-only shell failed under native motion. Later small original-overlay
  fits had no clear benefit at 44/88 pixels; the worker exceeded its 6 mm bound.
- Piece 13 uses the corrected blanket. The original trial penetrated the
  mattress and its quick was stopped for that visual defect. It is not a failed
  or completed suite. The corrected full overlap proof and final quick passed.
- Piece 15 retains the failed Python 3.14 runtime run. The authorized retry
  under Python 3.9.6 passed with unchanged source. Keep both executions separate.
- Pieces 7/8 have review, picture and historical gate evidence, but lack the
  later complete-input/runtime seals. Piece 7 has no separate committed native
  control JSON. Do not assign a later-style seal to those early executions.
- Private author facts for pieces 9–11 retain historical pending-browser text.
  Final review receipts record accepted live checks. Piece 10’s 6,514-file
  subset differs from its complete 10,411-file proof plus engine.
- Piece 16 retains an unknown standalone affected-process exit after an
  evidence collector error. All six focused files then completed successfully
  in the full quick, with measured overall exit 0.
- Shelf store clocks match. Kitchen clocks differ, 12:03 before and 12:02 after.
  Sack/rug room clocks also differ. These pairs do not prove exact clock or phase.
- Floor joints and wear improve the ground room. Upper deck and hatch appearance
  stay preserved. The route uses mouse G7 and keyboard Enter G8 before descent;
  it is not a full mouse route. Offline sheets and actual CUA views remain separate.
- Native triangle counts, cache sizes and batches are bounded cost evidence.
  Short FPS readings do not prove GPU time or sustained performance.

Existing anatomy, historical building forms, semantic room finishes and textures
remain the base. These records do not establish full JA2 graphics parity, every
garment contact, or sustained frame performance. Individual reviews retain
their before/after views, cost bounds, controls and source proofs.

## Final delivery evidence

The [fresh remote PR snapshot](../../artifacts/tactical-reference-completion/merged-pr-snapshot.json)
confirms the 17 accepted improvement merges. The [final preservation audit](../../artifacts/tactical-reference-completion/final-preservation-audit.json)
checks the frozen character bodies, game/public files and the exact floor/fixture delta. The [final four merge receipts](../../artifacts/tactical-reference-completion/pieces15-18-merges.json)
pin each head and merge revision. Earlier bounded completion audits cover
[pieces 1–6](../../artifacts/tactical-reference-completion/pieces01-06-audit.json),
[7–11](../../artifacts/tactical-reference-completion/pieces07-11-audit.json) and
[12–14](../../artifacts/tactical-reference-completion/pieces12-14-audit.json).

The [final isolated-root proof](../../artifacts/tactical-reference-completion/final-root-proof.json)
verifies all 10,427 regular source inputs, production identity, dependencies,
runtime and the uninitialized engine state. [Primary main source audit](../../artifacts/tactical-reference-completion/primary-source-audit.json)
verifies the same regular source bytes and a clean initialized engine at the
same pin. The [raw primary strict comparison](../../artifacts/tactical-reference-completion/primary-strict-comparison.json)
retains its failed exact-engine-initialization result. The primary runtime and
dependencies were not claimed equal. All 25 untracked playtest references were
preserved during synchronization.

The [phone image proof](../../artifacts/tactical-reference-completion/phone-pictures-proof.json)
records HTTP 200 responses with byte-exact hashes for every gallery picture.
Documentation links and audits passed before push. No code gate or render was
repeated for this handover. The [plan](../plans/tactical-reference-graphics.md)
records the final feature status.
