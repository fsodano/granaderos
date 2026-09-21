# Detention and physical rescue work

Status: **in progress**. Tactical prisoner construction exists, but campaign encounters do not yet deploy these entities. Do not treat this as playable rescue or escape.

## Prisoner construction

The detention manifest reads only living captives held in the requested sector. Each entity retains its captured operative identity, capture hour, name, health scale, current wounds, bandages, bleeding, energy and consciousness. It carries no weapon, ammunition, medical supply or inventory copy. That equipment remains in campaign custody.

Initial placement chooses separate walkable interior tiles, preferring rooms near the existing hostile force. It excludes occupied cells, map boundaries, blocked terrain and furniture. It does not create guards or change their weapons. Placement does not mutate its source battle. A detained civilian cannot roam or follow an escort order before being freed. Tactical validation rejects malformed identities, unknown sectors and copied equipment.

Twenty-five focused detention, civilian and escort checks, type checking and the production build pass. These use explicit captivity and map fixtures. They verify construction and tactical save restoration, not campaign wound settlement or release.

## Required integration

A pure health planner now checks captive identity, capture time, sector, health scale and cumulative critical-care acknowledgements. It retains actual damage, bleeding, bandages and lower energy; rejects repeated healing receipts and resurrection; and returns medical changes without changing equipment or custody. Nine focused construction and health checks pass, including actual bleeding progression and JSON receipt replay. Treatment acknowledgement tests use explicit fixtures. This planner is not yet called by campaign settlement; prisoner death cleanup and atomic receipt persistence remain required.

1. Bind the manifest to a real pending encounter and retain prisoner positions on reentry.
2. Connect prisoner wounds, treatment and death to their original captured service records, with no healing or equipment duplication on save or return.
3. Add an adjacent, paid release action and visible controls. A freed prisoner must still reach an authorized safe exit through actual movement.
4. Settle each physical escape/rescue independently from sector victory. Restore only the saved unused contract time. Keep unrecovered equipment in hostile custody.
5. Support failed attempts, recapture, permanent deaths and remaining detainees. Reject duplicate or missing settlement receipts.
6. Verify complete capture-to-rescue and escape paths, live controls, full saves and campaign continuation. Update W08 only for the paths actually completed.
