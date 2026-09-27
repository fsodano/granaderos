# Strategic militia medical care

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

## Player controls

In the sector's **Personal** panel, assign a present hired soldier as
**Médico de milicias**. The soldier needs at least 20 medicine, stable wounds,
more than 10 energy and personal medical kits. The sector must be safe.
The militia section lists recorded wounds and explains whether care can proceed.

Each working doctor treats one local defender per hour. Treatment consumes one
personal kit, three energy and two fatigue points. Bleeding takes priority, then
the lowest proportion of remaining health. Stabilization stops bleeding without
restoring health in that hour. Later treatment restores `2 + floor(medicine / 20)`
health, capped at the defender's maximum. Several doctors cannot treat the same
defender twice in one hour. Treated defenders also receive the existing patient
energy/fatigue recovery and condition refresh.

These rates are explicit Granaderos adaptations. They are not claimed as exact
classic JA2 formulas. The separate assignment makes the choice between hired
patients and local defenders explicit.

## Persistence and restrictions

Care updates the existing garrison record. It retains identity, rank, combat
experience, weapons, fittings, ammunition and inventory. A later real sector
entry uses that recovered record, including when an older tactical snapshot
still contains the earlier wounds.

Travel, deployment, unsafe sectors, sleep and unavailable doctors suspend care.
Soldiers reserved in a militia training course remain in that course; cancelling
the course returns their exact records and makes them available for treatment.
No dead defender is restored. No new unattended strategic militia bleeding or
death progression is introduced here; that remains different from hired-patient
strategic wound progression.

An explicit time advance stops when kits run out or no wounded defenders remain.
The notice and assignment survive saves. Paid local resupply lets the assigned
doctor resume work. A completed-care notice takes priority when the final kit
also completes the last patient's recovery.

## Verification — 21 September 2026

Eight simulation/save checks in `tests/militia-medical-care.test.mjs` cover hourly
costs, bleeding triage, shared treatment limits, location/deployment restrictions,
real sector reentry, empty work, saved supply exhaustion and paid resupply, sleep,
and training custody. Two render checks cover the assignment, wounds, blocked
work and completion text. With the existing care and assignment-attention checks,
all 39 focused checks pass.

The integrated suite passed 2,633 tests with no failures or skips. That run
preceded the three added resupply/sleep/training tests and the final completion
text correction; the final 39-check focused run covers those additions. Type
checking, the production build and diff checks pass. All 49 unrelated files in
the preservation snapshot remain unchanged.

The live check imported a valid controlled scenario: three Retiro defenders,
one with 20/60 health, and Paroissien with two kits. This is interface and medical
rule evidence, not a fresh-campaign conquest scenario.

1. Assigning Paroissien exposed his six-health hourly rate.
2. One hour raised the wounded defender to 26/60 and reduced his kits to one.
3. Reloading and continuing retained the assignment, health and supply count.
4. Requesting six hours stopped after one hour at 32/60 with zero kits and a
   named supply notice.
5. Buying five kits consumed 150 pesos and five units of local shop stock.
6. The next six-hour request stopped after five hours with no wounded defenders,
   zero remaining kits and a completed-care notice. The doctor's card and militia
   panel agreed. The final panel layout was inspected at 1280 × 720.

Tactical militia command choices and the remaining gameplay audit are still
open. This feature does not establish complete campaign balance or JA2 parity.
