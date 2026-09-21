# Detention and physical rescue work

Status: **in progress**. Campaign attacks, defenses and sector visits now deploy physical detainees. Their wounds, finite first aid and deaths settle into the original service records and survive full saves. Physical release and escape remain unimplemented. A full-suite run exposed unresolved rescue-route failures; do not treat this as completed rescue gameplay.

## Prisoner construction

The detention manifest reads only living captives held in the requested sector. Each entity retains its captured operative identity, capture hour, name, health scale, current wounds, bandages, bleeding, energy and consciousness. It carries no weapon, ammunition, medical supply or inventory copy. That equipment remains in campaign custody.

Initial placement chooses separate walkable interior tiles, preferring rooms near the existing hostile force. It excludes occupied cells, map boundaries, blocked terrain and furniture. It does not create guards or change their weapons. Placement does not mutate its source battle. A detained civilian cannot roam or follow an escort order before being freed. Tactical validation rejects malformed identities, unknown sectors and copied equipment.

Twenty-five focused detention, civilian and escort checks, type checking and the production build pass. These use explicit captivity and map fixtures. They verify construction and tactical save restoration, not campaign wound settlement or release.

## Required integration

Campaign settlement now uses the health planner and acknowledges prisoner state separately from civilian loyalty receipts. Captive identity, capture time, sector, health scale and cumulative first aid must match. Death clears living custody and the paused contract, retains an ammunition custody receipt, and prevents sector victory from reviving the soldier. Dead bodies remain on later visits. Released living soldiers retain the existing unused-contract restoration.

Fifteen focused construction, health and campaign checks pass. The campaign checks use actual capture settlement, paid hires and purchased supplies, then explicit positioning to isolate first aid. Reentry, missing prisoners, false health increases, full saves, fatal bleeding, one-time treatment and scripted sector-victory settlement are covered. Scripted victory is not combat-balance evidence.

A live browser check imported the adjacent-medic fixture and used the visible “Vendar a Juan Bautista Cabral” control. Cabral changed from 11 to 15/96 HP, bleeding 2 to 0; the medic spent one dressing (4 to 3) and 20 AP (52 to 32). Reload retained these values and captive status. This is treatment-control evidence, not proof of a route through the guards.

The integration run reported 2,584 passes, three failures (including a failed parent scenario) and three dependent skips. The two underlying failures are the northern rescue route and stationed-artillery rescue. Their old assertions assume captive wounds remain frozen during combat; physical detainees now bleed out before those controllers reach them. This is an unresolved gameplay issue, not a passing rescue route. Do not erase the casualties or grant free healing to make those checks pass. A complete detention design must provide and verify an actual finite-care/rescue path.

1. Completed for current sector requests: bind the manifest to the encounter and retain positions when available on reentry.
2. Connected: prisoner wounds, treatment and death update the captured service record. Finish the finite-care/rescue timing design and repair the two real route failures without inventing recovery.
3. Add an adjacent, paid release action and visible controls. A freed prisoner must still reach an authorized safe exit through actual movement.
4. Settle each physical escape/rescue independently from sector victory. Restore only the saved unused contract time. Keep unrecovered equipment in hostile custody.
5. Support failed attempts, recapture, permanent deaths and remaining detainees. Reject duplicate or missing settlement receipts.
6. Verify complete capture-to-rescue and escape paths, live controls, full saves and campaign continuation. Update W08 only for the paths actually completed.
