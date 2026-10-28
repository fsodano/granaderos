# AdvanceWorldTime

Advance scheduled world consequences to an absolute game second. A repository
loads the timeline, corpses, and current item custody as one transaction. The use
case advances the timeline and commits the changed objects together.

Corpse removal occurs after 72 game hours. Removal keeps the character death
record and transfers every remaining recoverable item to ground custody. Items
already taken by another character do not participate in removal. Event identity
and completion survive snapshot restoration, so entry and repeated progression
cannot transfer equipment twice.

`WorldTimeline` orders events by time and then identity. It rejects backwards
time, conflicting event identities, and repeated completion. It can stop at an
event boundary. The caller must supply a target already bounded by any unresolved
arrival decision. A read-only use case must not invoke this operation.

The sector snapshot adapter uses `Corpse` and `ItemCustody` to enforce lifecycle
and transfer rules. A missing death timestamp in an older snapshot starts the
lifetime at that snapshot's saved game time. Real time outside the game does not
advance the timeline.

`ResidentRoutine` executes local resident movement every six seconds in active,
retained, and suspended sectors. Authored daily moves use the same deterministic
placement policy in each mode. Resident and military wounds advance before each local event. Due corpse
removals precede movement and collection at that second. Trap injuries and supply receipts update the persistent character record.

Retained enemy and auxiliary combatants keep their wound clock. Controlled
service characters in retained caches use campaign health authority. Suspended
sector sessions continue their military wound clock, fatigue, light,
and weather. Combat turns and action points remain at their accepted values.
Incapacity removes the affected participant's ability to act. Military bleeding
uses the `Health` domain object and records the exact death tick before corpse
removal is scheduled.

`Sector` owns environment dimensions and current resident, participant, corpse,
and object references. Characters keep their own health and inventory. Sector
admission rejects duplicate character presence and invalid local positions.
Resident transfer retains the same character and custodian identity. Corpse
removal requires a complete transfer of its remaining item references into the
sector ground before removing the physical character reference. Terrain, doors,
and container contents remain in the physical snapshot adapter; their existing
rules continue to validate those records. Sector entry, resident reconciliation,
and corpse settlement restore and use this domain object.
