# Strategic militia medical care

On the strategic campaign screen, a present hired soldier can be assigned to treat wounded local militia defenders using personal medical kits and elapsed campaign hours.

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

Tactical militia command choices remain open. Campaign balance and JA2 parity are broader.
