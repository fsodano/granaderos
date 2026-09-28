# Autonomous militia combat and controls

Runtime/test source: `905a28abd43da1704c7d8d08ba064d5777ef745f`.

Local defenders now choose ordinary combat actions after the enemy phase. With
enemy-first contact, they wait for the player's response before acting. They use
their remaining action points and their own weapons, cartridges and priming.
They can approach visible opponents, switch to their authored secondary blade,
fight, reload and reprime. Hired soldiers and temporary mission allies retain
manual control. This is the current two-side, 100-point Granaderos adaptation;
it does not claim the advanced interrupt queues of the separate development game.

Militia deploy ready for ordinary reaction fire. A reaction spends their current
allied action budget. Their subsequent phase grants no extra points and clears
that already-paid reaction debit before the following round refresh. Unconscious
soldiers cannot act; their wounds still progress. Normal combat results and
campaign return retain casualties, health, equipment and earned promotion.

The engine rejects direct militia commands before spending time, equipment or
action points. Mouse selection, keyboard cycling and inventory access retain
the player's squad. Both garrison panels show status cards instead of selection
buttons. A squad member can still target a wounded defender for finite first aid.

## Verification

Five new simulations and two mounted production field checks cover autonomous
reload/fire, finite ammunition and priming, authored costs, reaction AP, enemy-first
ordering, deterministic saved continuation, rejected manual commands, unconscious
defenders, keyboard/mouse selection, medical targeting and actual end-turn combat.
The overlapping militia, equipment and care group passes **72/72**. A subsequent
readability-only phase refactor passes all ten directly affected autonomy/blade
checks. All 36 reference comparisons pass. Complete regression passes **983/983**, zero failures or skips (233,294.336 ms),
on the source above. Types and production export pass; the export contains
722 files and 632 asset references. The documentation audit passes with 233 requirements and 72 evidence records,
retaining all 50 original and 87 parity rows. Exact-head CI is required before publication.

The mounted combat check starts with paid militia and a wound caused by a real
enemy attack. Finite physician care stabilizes that soldier. A declared compact
encounter then produces an actual reaction kill through the ordinary end-turn
button. Saving and returning retains 44/60 health, the spent cartridge, wear and
the earned montonero rank. The second mounted check uses prepared injuries and
geometry to isolate selection and medical controls. These are DOM checks, not
live-browser acceptance or performance measurements.

Earlier tests manually ordered militia to fire or switch weapons. They now use
actual autonomous phases and retain the resulting equipment. The common medical
fixture uses declared enemy-first initiative and returns before the allied
response, so the patient cannot earn an incidental rank before its care test.
Its real Tercerola wound is 14 health with four bleeding; actual care reaches
20 and then 44 health. Earlier dated records of 13, 19 and 43 remain evidence of
their earlier source, not the current fixture. No test assigns a victory, heals
the patient directly or restores spent equipment to make these checks pass.

The corpse-recovery check replans an ordinary path when a moving resident blocks
it. Authored ammunition and blade checks use real daylight waits, actual paid
cohorts, declared compact enemies and ordinary campaign return. They follow the
survivor and remaining supplies produced by combat, including a real routed
defender, rather than assuming every soldier remains available.

## Open scope

Peaceful militia patrols, movement between sectors, advanced search, medical AI,
artillery crews, scavenging/sharing, custody and broader defense routes remain
separate work. The larger militia and JA2-S05 rows stay partial. Existing hired
turns and the advanced development-workspace documents are not replaced by this
bounded delivery.

## Publication

[PR #95](https://github.com/fsodano/granaderos/pull/95) merged on 28 September
2026 at 20:09:41 UTC as `47c95c458ee57f29307a07ae4082b628056efce1`, after
[successful exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36475009290/job/109106406963)
for `49d5279a315e798171df40cb99425c554ed41d2d` (completed at 20:08:51 UTC).
The published scope is the bounded combat and control behavior above.
