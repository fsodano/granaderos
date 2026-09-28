# Artillery loading by the actual crew

Runtime/test source: `8f6410ddbd641c161d1a31e9dc18694d1bf4b348`.

An incomplete cannon load retains work as a fraction on that physical piece.
Every required crew member contributes the same AP in a step; the least
available assigned member limits the work. The selected leader must participate.
Spare helpers with more AP take priority, with stable identity ordering for ties.
Unassigned people keep their AP. One reserve round becomes loaded only when the
work finishes. Dragging, turning and a change of leader retain the fraction.
Authored loading abilities and nearby support apply to the remaining work.

Controls and execution share the same crew eligibility: the correct side and
control class, conscious and capable, standing or crouching, on foot, adjacent
through clear geometry and available in the current phase. Hired soldiers cannot
spend militia AP. Missing helpers, prone or incapacitated personnel, blocked
contact, exhausted reserves and a loaded cannon give the same rejection reason
in the control and reducer. The controls show the paid step, remaining work and
saved percentage. Every assigned person lowers the held weapon while working.

In exploration the crew works simultaneously. Orders advance the existing
0.06-second-per-AP conversion once, with a one-second minimum, and do not require
or spend combat AP. Combat retains the ordinary six-second turn clock. These
rates, crew sizes and abstract work fractions are Granaderos tuning. Artillery
is an adaptation, not a claim about the equipment in classic JA2.

Full saves retain valid unfinished fractions and reject invalid or loaded-gun
work. Pending reentry receipts must match the retained work and facing. Actual
withdrawal and reentry preserve unfinished loading on a captured cannon.

## Verification

Ten new simulations and two mounted production-field cases pass **12/12**.
The earlier overlapping artillery, HUD and emplacement group passes **35/35**.
After the existing ability tests were updated to assert partial work instead of
rejecting insufficient AP, the focused ability/loading group passes **23/23**.
The first complete run recorded 1042 passed and two outdated expectations; that
failure is retained in this record. Final full regression passes **1044/1044**, zero failures or skips
(239,849.427 ms), on the source above. Runtime code is unchanged from the
preceding successful type check and production export: 722 files and 632 asset
references. All 36 reference comparisons pass on the final source. Documentation
validation passes with 239 requirements and 78 evidence records, retaining the
50 original and 87 parity rows. Exact-head CI passed before publication.

Prepared tactical boundaries verify real end turns with wounded crews, minimum
available AP, spare helpers, replacement specialists, movement, pivoting,
invalid orders and simultaneous exploration time. They are subsystem checks,
not campaign balance evidence.

A purchased manifest and its actual hired squad enter a declared flat combat
boundary. Two ordinary shots and loading orders spend AP until a partial step
remains. Full paired saves resume its exact cost; another ordinary turn completes
one finite round. Returning the actual retreat result and reentering retain the
same fraction, identity and enemy ownership. Altered pending work is rejected.

The actual established-area victory fixture separately fires all seven issued
shots with six ordinary reloads. Full synchronized saves and return/reentry keep
the same empty cannon. No AP, ammunition, health or result is replaced in that
sequence. The mounted field controls show the actual partial percentage,
disable an exhausted or incomplete crew, and finish the reload after a real end
turn. These are mounted DOM checks, not live-browser or performance acceptance.

## Remaining work

TAC-08, ITEM-02 and the overall integration remain partial. Autonomous artillery
choices, strategic recovery/transport, finite resupply, trade and editable gun
profiles remain separate. The preserved [crew-loading record](../gameplay/equipment/artillery-reload-progress.md)
describes a larger development system and its own dated checks. This delivery
keeps the published AP scale and authored ability rules.

## Publication

Published in [PR #101](https://github.com/fsodano/granaderos/pull/101) on 2026-09-28.
Exact head `e634a07b52dd77f1dea369d9bb8b755c25d95ffe` passed [CI run 36488533405](https://github.com/fsodano/granaderos/actions/runs/36488533405), including the full suite, types and production build. Merge commit: `915456e1311b55e4a9861335255e1e00761ffe2b`. This publication does not close the broader artillery or campaign requirements.
