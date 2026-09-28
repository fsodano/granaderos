# Finite civilian supplies

Runtime/test source: `082ee305e239dbc1e6a2c53d446f2eca3ae9b15e`.

Residents with a character sheet now carry that identity's current priming,
flints, rations, torches, dressings and boleadoras. The existing authored starting
allocation is assigned once; a sector view reads remaining quantities from the
same service record. Generic residents without a character sheet have no invented
stock. Bulletin candidates remain off map until their normal paid arrival.

The normal loot control can collect these supplies from an adjacent dead or
unconscious resident. It spends eight combat AP or the ordinary exploration time.
It rejects a conscious or departed person, an invalid quantity, unsupported item,
empty stock or an unreachable position. A partial transfer preserves every
remaining unit and cannot exceed the receiving record's supported quantity.
The tactical log lists the actual quantities collected.

An accepted checkpoint reduces the original holder's saved stock. Daily movement,
scene return, recruitment, dismissal and later recruitment retain the remainder.
A corpse retains its own stock; a successor is another identity and receives only
its separate allocation. A missing older scene projection is reconstructed from
remaining canonical quantities, never from the authored starting package.
Malformed stocks and a scene that invents an increase are rejected.

The temporary San Lorenzo commander's actual carried supplies also reach its
shared identity. Later mission contact and local appearance no longer replace
spent or absent supplies with a generic allocation. Existing older retained ally
quantities constrain the first projection until the current mission checkpoint
has acknowledged its stock. Weapons, ammunition and arbitrary inventory retain
their separate integration work.

## Verification

Six new simulations cover:

- An authored one-health resident, partial then complete collection, two finite
  first-aid strokes funded by those dressings, saved daily relocation, actual
  local contract and later dismissal. Empty resident stock stays empty and the
  collector retains the five unspent dressings.
- Actual death, collection, scene return and a distinct successor with three
  dressings while the earlier body remains empty.
- Altered or malformed active stocks, rejected increases and an older missing
  projection restored from five remaining dressings rather than seven initial.
- Prepared compact range, AP, consciousness, departure, quantity and capacity
  boundaries; rejected orders preserve both actors' supplies.
- The actual San Lorenzo mission scene after a declared controlled-approach
  fixture: the ally moves, consumes its ration, saves and exposes zero remaining
  rations and dressings in its later named contact.
- Explicit authored supplies and actual collection before San Lorenzo. The
  resident is stabilized through finite care, then enters the actual allied role
  with empty stock. The mission cannot replace the collected quantities.

A mounted battlefield case uses the actual loot control, pointer selection and
keyboard repeat. Three dressings transfer once, the log names them, a repeated
empty collection is rejected and no dialogue opens. The existing civilian,
starting-stock and local-service group passed 22 checks; the extended group passed
24 and the final controls/stock group passed seven. These groups overlap. The
final release run at the source above passed **879/879 tests**, with zero failures
and zero skips, in 207,585.514 ms. Type checking, production export (722 files,
632 asset references), all 36 baseline checks and the documentation audit passed.
Exact-head GitHub CI is required before merging this delivery. The first release candidate,
`8e602735e07386819756a35eceb2be967e988508`, passed 877/878 tests. Its one failure
was the final treasury assertion: the historical route completed but retained
5,478 rather than 5,564 pesos. Conserving the commander's actual stock requires
86 pesos of ordinary workshop replenishment. The updated route records that
quote and retains the actual lower balance; no combat result is changed.

## Limits

This delivery covers the six existing personal supply types. It does not add
civilian weapon/armour looting, pockets, gifts, stealing from conscious people,
merchant stock, arbitrary item definitions or authored transfer of a predecessor's
role and inventory. Stock possession does not make a civilian an armed fighter.
The separate complete inventory and custody requirements stay open. Simulation
and mounted DOM checks do not establish live-browser usability or performance.

## Publication

[PR #81](https://github.com/fsodano/granaderos/pull/81) merged at
2026-09-28 15:23:26 UTC as `08f18b09d207f98096e64a147be67756847a4af8`.
[GitHub verification](https://github.com/fsodano/granaderos/actions/runs/36441194515/job/108991791999)
passed at 15:21:57 UTC for the exact PR head
`c01fa0db1ff85837dee9389a719959a4d207e0f9`.
