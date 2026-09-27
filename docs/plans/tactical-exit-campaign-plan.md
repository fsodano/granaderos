# T09 campaign transaction plan

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../verification/published-progress.md) for the main branch baseline.

Status note: this document records the design input. The implemented behavior and remaining limits are now described in [JA2 gameplay](../gameplay/ja2-gameplay.md#physical-departure-and-persistent-casualties) and [the parity audit](../verification/ja2-parity-audit.md).

Proposed next batch, 6 September 2026. This document changes no game behavior or audit status. It supplements [the tactical exit design](tactical-exit-plan.md) and supersedes that document's old report-defect description: fresh battle, visit, and mission reports now require a complete matching snapshot and every deployed hired participant. `completeDeploymentReport` takes physical state from the snapshot, including the full deployed militia and mission-ally records. A receipt alone still does not prove a physical exit.

## Boundary and records

Keep `battleResult`, `leaveSector`, and `finishMission` as the campaign entry points. Do not add caller-supplied destinations, custody decisions, departure flags, or a bypass for auto-resolve. M continues to preserve `pendingBattle`. Commit only when the encounter closes; a partial tactical departure keeps the original request and every participant until then.

The tactical/root batch must produce these validated records:

```js
request.exits = [{id, edge, destination}]; // edge: 'N' | 'E' | 'S' | 'W'
request.exitRulesVersion = 1;
unit.departure = {exitId, edge, destination, x, y, elapsedSeconds,
                  mountId: null}; // or the actual mounted horse ID
```

`x,y` are the passable boundary cell crossed. `elapsedSeconds` is the battle clock after the paid outward step. Keep the full unit in `battle.units`. A receipt may carry a horse only if it was actually mounted at departure; leading a dismounted horse is outside this batch. The snapshot validator checks receipt types, bounds, timestamp, edge, and exit lookup. Campaign validation additionally checks the request's exits against the sector graph or authored scene mapping. `fled`, `routed`, the current unit coordinates, and a menu selection are not receipts.

Use tactical `status:'retreat'` only after a real departure and the end of field control. An active encounter with capable separated troops remains pending. An eventual explicit abandon command must establish that terminal state through the tactical reducer; no campaign `abandon:true` flag may synthesize it. Existing victory and critical-health defeat checks stay authoritative. Breath-only unconsciousness remains temporary. Friendly visits can close with residents, including patients, without an exit receipt.

Normalize tactical scenes to strategic locations: ordinary sector → itself; San Lorenzo → San Nicolás; Yatasto → Tucumán. Yatasto's return to its parent is a scene transition, not neighbor travel. Store a departed soldier's `operativeState.arrival:{battleId,fromSector,entryEdge}` until the next deployment; the edge is the opposite of the recorded exit, or the authored scene entry. Copy it into that request's individual squad record as `entryEdge` and `entryReason:'departure'`. A friendly resident uses `entryReason:'resident'` and may reuse old coordinates. Individual records avoid forcing soldiers who used different exits onto one shared entry edge. The paid exit clock is committed once; the campaign transaction does not add an invented road journey or repeat movement fatigue.

## Pure transaction plan

Add `game/deployment-return.js` with these pure helpers. Inject campaign policy facts where needed to avoid an import cycle with `campaign.js`.

| New API | Result and responsibility |
| --- | --- |
| `planDeploymentReturn(s, request, snapshot, outcome)` | Validate all identities and receipts; derive final sector control and one entry per `request.squad` ID. Return `{battleId, sourceSector, outcome, entries, auxiliary, ammunition, squadChanges, horseChanges}`. Never mutate state or draw RNG. |
| `planSquadPartition(s, entries)` | Return exact membership/location edits for affected squads and reserve records. Keep remote people and the selected remote squad unchanged. |
| `planReturnAmmunition(request, snapshot, entries)` | Return one credit plus per-person captive custody amounts. Count each surviving actual cartridge once. |
| `planMountReturn(s, request, snapshot, entries)` | Match actual horse identity, condition, stamina, and the receipt's mount ID. Return moves, retained mounts, and inaccessible field/captive custody. |

Each hired entry has `{unitId, kind, sector, departure?}`. `kind` is exactly one of `departed`, `resident`, `captured`, `dead`; the corresponding complete unit is read from the validated snapshot, never copied from caller receipt fields. Use this precedence:

| Physical result | Disposition |
| --- | --- |
| HP ≤ 0 | `dead`; body is at the departure destination if a valid earlier departure exists, otherwise at the source. Death after departure does not return the dead soldier's carried ammunition. |
| HP > 0 and valid departure | `departed` at its recorded destination, even if subsequent bleeding caused unconsciousness. The receipt proves earlier movement, not present fitness. |
| HP > 0, no departure, and friendly final field control | `resident` at the source, including unconscious patients. |
| HP > 0, no departure, and terminal loss of field control | `captured` at the source. Conscious troops cannot be silently abandoned through an active-report label. |

Final field control comes from the actual terminal tactical result and the encounter type, not civil ownership alone: a defeated coastal defense can remain politically patriot while occupied. A victory leaves non-departed survivors resident. Militia and mission allies use a separate `auxiliary` partition, preserving their existing roster roles; they never become hired squad members. Friendly surviving militia remain local through `returnGarrison`. Fallen militia remain bodies. On lost defense, surviving militia retain the existing dispersal outcome, with gear inaccessible in the lost field. San Martín's actual death still fails his mission.

Check destination topology and control before committing. Reject a destination that was never an authorized exit. New enemy arrivals queued during this deployment must not erase an already paid departure: after relocation, `releaseDeferred`/`settleEnemyEncounters` evaluates the arrived soldiers at that destination and presents the queued encounter. Previously stationed occupation is not a valid safe exit. Do not choose a different neighbor in place of the receipt.

## One atomic commit

Refactor the common campaign work into `commitDeploymentReturn(s, request, snapshot, plan)` inside `campaign.js`. Run it within the existing `dispatchCampaign` cloned-state/rollback boundary:

1. Run `completeDeploymentReport` first, then the pure plan. Change its retreat test from an active snapshot to the new validated `status:'retreat'` contract. Visits still permit friendly resident reports. Require the current complete participant and raw equipment checks for all newly deployed player units.
2. Synchronize only the unsynchronized tactical delta before settlement. Extract an internal `applyTacticalTime(s, request, elapsedSeconds)` from `syncTacticalTime`; let the external action and this transaction share it. Do not import `time.js` into `campaign.js`, which would introduce a cycle. Keep `pendingBattle` in place during the tick so other arrivals, contracts, wounds, and horses retain the existing deployment protections. Stamp `syncedSeconds`, `savedHour`, and `savedSecond` on the stored snapshot.
3. Reconcile each hired participant once through existing `returnMedicalCare`, `returnEquipment`, `returnTraining`, `returnMorale`, `returnMount`, and `validatePersonalInventory`. Extract the duplicated scalar/inventory assignment into internal `applyReturnedOperative(s, request, unit)`. Apply battle morale/XP only for actual combat and once; visits do not grant combat XP. Preserve dead records and personal equipment; do not return their property to the armory.
4. Apply the ammunition credit, custody amounts, squad partition, and horse changes. Record the final snapshot and its return ledger. Apply victory, loss, mission, loyalty, group, and capture effects. Clear `pendingBattle` only after every check succeeds. Then run the existing deferred-event and migration tail.

No intermediate campaign commit occurs when the first soldier departs. The live battle remains the authority until the final report. A second report fails because its pending request no longer exists. Save/load of a partial departure retains the same request, clock, units, and receipts.

## Squads, custody, and ammunition

Replace tactical-return calls to `relocateDefenders` and the ordinary defeat branch's `s.location = request.origin`/`moveMounts`. Those helpers currently move people who did not depart. Keep pre-combat strategic withdrawal as its separate existing action.

For each affected original squad, retain its ID for the resident bucket if present, otherwise the bucket containing its first surviving member. Remove dead/captured members before moving a bucket. Create deterministic `squad-N` IDs for other destination buckets within the existing eight-squad/six-member limits. If no squad slot is free, leave those soldiers as recruited reserves with explicit `operativeState[id].location`; never move an unrelated squad to make room. Preserve unaffected squads verbatim. Reset `s.squad` and `s.location` from the selected resulting squad before the dispatch tail calls `synchronizeSquad`. If that squad is empty, keep a valid empty squad rather than pulling remote survivors into it. A defense request can span more than six hired people and multiple original squads; partition all `request.squad` IDs, not only `s.squad`.

Keep existing captive fields `captured`, `capturedSector`, `capturedAt`, and `capturedContract`, and add `capturedAmmunition:{loaded,ammo}`. Generalize `captureDefenders(s, ids, group)` to `captureOperatives(s, ids, sector, plan)` so ordinary losses can use the same contract pause/release loop. Keep personal equipment in its existing operative/loadout record, inaccessible through current captured/recruited gates. `releaseCaptives(s, at)` credits captured ammunition once and clears that custody field before restoring service. It preserves the existing rule for unexpired versus expired contracts.

Do not call the current `returnAmmunition` once per destination: its shared loot allowance could be counted repeatedly, and it has no captive partition. Replace it in this transaction with one calculation over the complete actual snapshot. Credit only living `departed` and friendly `resident` hired units' actual loaded plus reserve cartridges, capped once by the request's issued rounds plus actual finite transfers from recorded enemy, garrison, ally, and body sources. Use one aggregate ceiling, not a reused per-person loot allowance. Captive rounds stay in `capturedAmmunition`; dead, militia, mission-ally, ground, and container rounds stay with those records. Preserve the existing rule that backpack weapon loads remain in the backpack and are not also credited as loose cartridges.

Add `snapshot.returnLedger:{battleId, entries, creditedCartridges}` on a committed snapshot. It identifies which retained records are historical/captive versus bodies still available at a location. World re-entry must respect this ledger: captured personal gear cannot also be looted from its old tactical unit, and departed equipment cannot appear at the source. For a death after departure into a sector without a built map, add a finite `s.sectorRemains[sector]` queue containing `{battleId,unitId,unit}`. World consumes each queued body once into that destination snapshot. This is storage for an actual casualty, not generated loot; validate unique `(battleId,unitId)` keys and retain the unit's exact gear.

For horses, only the receipt's actual `mountId` follows a departed soldier. A friendly resident's actual mount stays local. Unmounted, dead-rider, or captive mounts stay at the source unless a real earlier receipt moved them. Extend horse records with optional `custody:{kind:'field'|'captured', sector, operativeId}`; such horses cannot be assigned, ridden, bred, or returned as available remounts. `removeFromService` must not release a captive's horse into available stock. Restore its custody through the same recapture hook; ordinary safe field recovery can be handled when the sector is resident again. Reuse `returnMount` for condition/stamina only, and gate `mountForOperative` against custody. No remote horse moves because another member leaves.

## Defense, auto-resolve, and migration

- Change `finishDefense` to consume the plan rather than calculate a fallback from all living defenders. Keep `recordEnemyGroupResult`, `loseSectorToGroup`, `addDefenseHistory`, coastal occupation, and casualty/dispersal rules. `occupationGroupIds` still updates actual enemy survivors exactly once. History includes the disposition IDs and actual destinations.
- `autoResolve` must finish through the same receipt contract. At its combat limit, run a separately bounded legal withdrawal phase using normal movement, exits, and interrupt windows. If it remains active, return `{outcome:null, timedOut:true, battle}` and leave a synchronized pending tactical defense for player control. `resolveDefenseAutomatically` must not submit that as retreat or capture everyone merely because its budget expired. No free relocation or synthetic exit receipt.
- `restoreCampaign`/`decodeSave` keep legacy active requests loadable. After their existing identity checks, derive authorized exits from the graph/scene mapping, add `exitRulesVersion:1`, and default all missing departures to absent. Never infer an exit from old `fled`, old coordinates, `origin`, or an old outcome label. Full units remain in the battle, so existing pending-membership validation holds. Already concluded old snapshots remain historical data; they do not create new credits or departures.
- Extend save validation for exit topology, pending arrival metadata, ledger membership/uniqueness, custody rounds, horse custody, and queued bodies. Reject receipts for another deployment or scene and departed actors left in action/reaction queues. Loading cannot create a physical departure or accessible copy of captive gear.

## Acceptance checks for the implementation batch

Use complete real-reducer snapshots. Cover: two destinations from one squad while a resident remains; a remote selected squad during defense; no free squad slot; an unconscious resident after victory versus a captive after loss; death before and after departure; mounted and dismounted exits without moving remote horses; one captive ammunition credit on rescue; unchanged finite ground/tool/gun metadata; omitted/duplicate participants and wrong scene/exit; partial-exit save/load; repeated final submission; queued destination arrival; and bounded auto-resolve returning an unresolved pending battle. Keep the actual opening combat test unchanged. Physical edge/action, rout movement, arrival placement, and UI tests remain in the root/tactical batch.
