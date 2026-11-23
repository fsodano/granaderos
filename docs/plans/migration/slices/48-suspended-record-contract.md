# Slice 48: suspended visit record contract

A suspended visit must retain enough information to resume the same sector
session and advance its world state while it is inactive. The save stores a
record, not a serialized domain `SectorSession` object for one sector visit.

## Record fields

[`CampaignSuspendedSectorSession`](../../../../packages/game/public/campaign-types.ts)
defines entries in `CampaignSnapshot.suspendedSectorSessions`.

| Field | Type | Meaning |
| --- | --- | --- |
| `request` | [`CampaignSectorEntryRequest`](../../../../packages/game/public/campaign-types.ts) | Saved entry request that identifies the visit and its entry context |
| `snapshot` | [`BattleSnapshot`](../../../../packages/game/public/compatibility-types.ts) | Saved sector view used to restore the visit |
| `activeSquadId` | [`CampaignSquadId`](../../../../packages/game/public/campaign-types.ts) | Identifier of the squad to make active when the visit resumes |
| `location` | [`CampaignSectorId`](../../../../packages/game/public/campaign-types.ts) | Campaign location to restore with that squad |
| `suspendedAtSeconds` | [`CampaignGameSecond`](../../../../packages/game/public/campaign-types.ts) | Accepted game second when the visit was suspended |

## Suspension and restoration

[`CampaignSectorSessionCoordinator`](../../../../packages/game/infrastructure/session/campaign-sector-session-coordinator.js)
writes the five fields when it suspends an active visit.
[`validateSuspendedSectorSessions`](../../../../packages/game/infrastructure/session/validate-suspended-sector-sessions.js)
checks that the request and snapshot identify the same visit, that its squad
and location are valid, and that its saved times agree with the campaign clock.
The session accessors derive their narrower read shape (`request` and
`snapshot`) from this contract in
[`campaign-session-access.d.ts`](../../../../packages/game/infrastructure/session/campaign-session-access.d.ts).
[`GameSnapshotMapper`](../../../../packages/game/infrastructure/persistence/game-snapshot-mapper.js)
rebuilds the domain `SectorSession` from `request` and `snapshot`. When the visit
resumes, the coordinator restores `activeSquadId` and `location`;
[`advanceSuspendedSectorConditions`](../../../../packages/game/military-remains.js)
uses `suspendedAtSeconds` when advancing that visit's world conditions.

## Behavioral contract

A suspended record has all five declared fields. Validation refuses a record
with a missing field or inconsistent visit context. For example, if
`activeSquadId` is absent, validation cannot find the squad; if `location` does
not match that squad, restoration would select the wrong campaign location; if
`suspendedAtSeconds` is not a valid game second, inactive-world progression
cannot use a reliable time boundary. In each case, the visit is refused rather
than resumed with incomplete context.

The tests in
[`sector-session-coordination.test.ts`](../../../../tests/sector-session-coordination.test.ts)
check that suspension writes exactly these fields and that validation rejects a
record missing any of them. The type describes the saved record's existing
field names and values; it does not introduce a different serialized value.
