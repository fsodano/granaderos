# Latest build consolidation — work in progress

This is a working-branch record, updated on 30 September 2026. It does not describe a released build. The [published progress ledger](published-progress.md) remains the authority for accepted work on `main`.

## Why the previews differ

Parallel work used separate Git worktrees. Published work and newer local gameplay were not combined before the preview at port 3134 started. The consolidation branch is `codex/consolidate-latest-gameplay`. Its published base is `f5b6290f2e32a4e78bd78c928e1459a3be4213b3`, with the compact exploration control at `7c274016`. The local gameplay source is preserved as snapshot `377156af1b67e00946f83afa152ef215bb2f0a62`. The original working folders remain unchanged.

**Port 3134 still serves the earlier build. The combined build is not released.** Port 3135 is a private verification server. It must not be presented as the replacement game.

## Current evidence

- All Git conflict markers and unmerged index paths are resolved. A leftover eight-character marker in the archived progress file was removed during the documentation review. The combined branch is being prepared for a draft integration PR. It is not ready to merge.
- TypeScript validation and a combined production build pass. The identified candidate contains 1,131 files and 1,031 checked asset references.
- In the browser, the game, story editor, and sector editor display the same build ID: `ab7aa59277c9`. Later source corrections require another build before delivery.
- The identity is a digest of actual game, editor, asset, and tool source. `/build-info.json` exposes that identity. A dirty working tree is not described as an unchanged Git commit.
- A complete diagnostic run finished with **3,346 passed and 737 failed checks (4,083 total)**. That run overlapped repairs and laptop sleep. It is neither an exact-current-source validation nor a performance benchmark. A second diagnostic finished with **3,386 passed and 713 failed checks (4,099 total)**. It also overlapped corrections and is diagnostic evidence only.
- A stable full run against source digest `74bddced910e` finished with **3,561 passed and 551 failed tests (4,112 total)**, with no skipped or cancelled tests. The [failure inventory](../evidence/consolidation-regression-2026-09-30.json) records every failing test and its file. Unlike the earlier diagnostic runs, the source stayed fixed throughout this run. This candidate also passes TypeScript, documentation and reference-value audits, and the production build (1,131 files / 1,031 asset references).
- Subsequent repairs pass **67 of 67 focused checks** for saved attachments, mission-ally weapon custody, paid deliveries, critical first aid, militia distribution, the Personal panel, and shared-pocket transfers. Missing fitting fields are rejected before initialization; an ally can save after dropping a blade. Delivery fixtures now buy finite imported equipment instead of creating retired resource jobs. These later checks do not establish a new full-suite result. The current TypeScript check passes.
- The 212 documentation/art conflict choices are reviewed. The canonical documentation audit passes (274 requirements). Older evidence retains its original source limits.
- The stable focused batch passes 42 inventory, clothing, gift, time and local-contract checks. The corrected capture, opening initiative, perception and deployment batch passes 44 checks.
- The current cartridge transfer/drop/pickup batch passes 16 checks. A further 42 ammunition checks pass, including mounted alternative-load controls, authored weapon families, AI selection and unloading. AI now checks the selected load rather than losing its identity through the display specification. A full-pocket unload returns an error without throwing or changing stock.
- The 67-check building batch passes. Fresh campaign landmarks and neighbourhoods use the same catalog renderer as the editor; flat playable terraces retain their matching geometry. Eight exterior/interior images were inspected.
- All 32 additional pending-worktree candidates are reviewed. The current enemy playback, grenade presentation and military body-supply batch passes 29 checks.
- The current civilian combat/off-screen clock run passes 26 checks. The held-weapon lifecycle run passes 15 checks. The build-identity check passes. These focused results do not replace the full regression suite.
- Private browser checks covered a paid hire, initial sector entry, larger buildings, the compact pause control, and shared large/small pockets. Full campaign progression and loaded movement performance remain unverified.

## Integration decisions

| Area | Combined implementation | Remaining verification |
| --- | --- | --- |
| Maps and architecture | The game and editor share the 15 sector documents, larger colonial plans, arbitrary world cells, editable finishes, roof cutaways, elevation, and cached scenery. | Verify the final built scene and editor exports together. |
| Ammunition and weapons | Four ammunition families use physical pocket stacks. Alternative loads, weapon images, conditions, attachments, and load state follow each weapon. No second scalar ammunition stock owns the same rounds. | Transfer/drop/pickup and alternative-load checks pass. Finish the broader trade, migration, and return suite. |
| Hands and pockets | Hands, body slots, four large pockets, and eight small pockets share physical custody. Cursor exchanges and transfers retain item metadata. | Complete the final inventory regression run and browser checks. |
| Campaign economy | Treasury is the only global resource. Merchants, artillery, ammunition, and personal equipment use finite local or physical stock. | Check each older material-economy caller. Clothing now uses finite local shop stock and pesos; the acquisition and gift checks pass. |
| Story and civilians | Authored presence, hire-only mercenaries, controlled arrivals, dialogue, quests, and successors coexist with canonical civilian health and death records. | Complete story progression, capture, and quest checks. |
| Time and movement | Living actors block cells. Dead bodies do not. Walking keeps its gait across steps. Settled sub-minute time updates share campaign data; minute boundaries and new receipts use full campaign validation. | Measure the actual loaded scene. Scripted timing tests do not prove 60 FPS. |
| Weapons after transfer | An absent weapon cannot receive a fresh load on reentry. The retained template is not an owned gun. | Continue the broader campaign return suite. |
| Legacy NPC orders | An unambiguous NPC ID is accepted for older targeted actions. Explicit target kinds remain authoritative. Medical care still requires dressings in hand. | Complete compatibility and ambiguous-ID coverage. |
| Art tools | Sprite previews and the target audit use the same shared action requirements and current appearances. | The expanded artwork target is incomplete: 224 of 744 required variants are packed, with 520 missing. This target differs from active runtime coverage. |

Earlier component-only checks used a diagnostic import guard while the campaign merge was unresolved. The production build and current lifecycle checks use the real campaign modules. The diagnostic guard is outside the repository and must not ship.

## Required before handover

1. Resolve remaining defects and adapt obsolete fixtures without weakening physical ownership or save validation.
2. The 32 additional pending-worktree candidates and 212 documentation/art conflicts are reviewed. Verify the current campaign/editor building renderer in the final built browser scenes.
3. Run the final full regression suite, type checks, documentation checks, and production build against stable source.
4. Test the final game and both editors in the browser. Measure loaded movement with other test processes stopped.
5. Create the integration PR, verify its final-commit checks, and merge with a matching-head guard.
6. Replace the preview at port 3134, preserve the browser origin and saved data, verify the served build identity, and stop the duplicate game listener.

The integration PR must remain draft while the regression failures are repaired. Merge, publication, and the one-build handover remain open. Full campaign and JA2 parity are not complete.
