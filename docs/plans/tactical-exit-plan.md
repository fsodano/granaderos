# T09: physical retreat and sector exit

Status note: this document records the design input. The implemented behavior and remaining limits are now described in [JA2 gameplay](../gameplay/ja2-gameplay.md#physical-departure-and-persistent-casualties) and [the parity audit](../verification/ja2-parity-audit.md).

Read-only audit and proposed contract, 6 September 2026. No implementation status changes.

## Reference and current defects

The [original JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf) requires troops near the edge for tactical departure (pp.8,21,34). Page 21 offers selected-person/all-squad exit and a choice to follow the departing group. Pre-combat strategic withdrawal is a separate choice (pp.9,44). Patusco’s guide p.13 describes leaving and approaching from another side. These pages do not specify a casualty-carrying rule; that must not be claimed as classic behavior on this evidence.

| Integration point | Current behavior and consequence |
|---|---|
| `web/app/page.tsx:41,47–48`; `JA2Inventory.tsx:54` | Confirmation calls `finish('retreat')`; all player units enter the report. No edge, mobility, AP, interruption or destination preview. M already preserves the active deployment and must remain a map-view action. |
| `game/campaign.js:360–365,439–459` | Ordinary retreat accepts no snapshot and no reports. Missing reports on retreat retain stale strategic state. A snapshot does not prove departure. Visit reports also do not require every participant. |
| `game/campaign.js:130–160` | Defense defeat/retreat moves all living defenders to the first safe neighbor, including incapacitated people. `relocateDefenders` moves an entire squad location if any member is included; this cannot process selected departures safely. |
| `game/tactical.js:143–148` | Rout immediately moves a soldier to a found edge along an unlimited path and drops a weapon. It ignores AP and reactions along that path; `fled` is not a valid physical departure receipt. Defeat checks do not distinguish withdrawal. |
| `game/world.js:9–42` | Re-entry chooses positions near each previous player position, even after retreat and a new approach. Only old dead militia are restored separately; departed player corpses can disappear when no longer in the request squad. |
| `game/ammunition.js`; `equipment.js:95`; `save.js:8–16` | Supplies return for every living report; no extracted/captive/resident partition exists. Save validation requires request participants in `battle.units`; removal during partial exit would break loading. |
| `game/auto-resolve.js:39` | Timeout labels an active battle retreat without walking to an exit. It must use the same withdrawal contract once that contract is enforced. |

Reproduced on current code: a valid unconscious soldier with HP 10 at `(9,8)` on a `20×16` map returns to Buenos Aires with the squad; a retreat with `survivors:[]` and no snapshot succeeds; re-entry places a prior interior soldier near `(10,9)` again.

## Proposed bounded contract

1. **Separate view, report and departure.** M suspends the tactical view and keeps the battle. Reporting a completed victory records the force as resident in the same sector; it is not evidence of cross-sector travel. A physical retreat or tactical neighbor transition requires the exit action below. Pre-combat strategic withdrawal remains separate. No new travel system is part of T09.

2. **Logical exits, without art changes.** Add validated `exits:[{id,edge,destination}]` and `entryEdge` to the request/battle. Edges are `N/E/S/W`. Use existing sector neighbors and an explicit scene mapping: San Lorenzo returns toward San Nicolás; Yatasto returns to its parent sector. Multiple destinations may share one edge. No arbitrary destination from a UI string. Distinguish arrival from continued resident exploration.

3. **One shared preview and reducer action.**

   ```js
   exitPreview(battle, {unitIds, exitId})
   // {available, reason, edge, destination, eligibleIds, blocked:[{id,reason}], costById}
   actBattle(battle, {type:'exit', unitIds, exitId})
   // Records actual departures; does not award victory or return supplies.
   ```

   Require a living, conscious, mobile, non-routed actor under ordinary player control; reject an interrupt/reaction stack or enemy phase. Require standing on a passable boundary tile belonging to that exit. This exact-edge rule is explicit Granaderos tuning; the manual allows a nearby band. Movement to the boundary uses normal movement, energy, AP, time and reactions. Charge one outward step using the existing movement cost; recheck consciousness after time/wound effects before committing departure. Preflight the selected batch atomically if a member cannot depart. During execution, stop on a new casualty or other state change; preserve completed exits and spent time. The UI can select only eligible people instead.

4. **Partial departure is real.** Keep the full unit record in `battle.units` with `departure:{exitId,edge,destination,elapsedSeconds}`. Exclude departed units from targeting, sight, hearing, collision, actions and reaction queues. Keep injury time running while the remaining encounter runs; do not freeze a bleeding escapee or give automatic treatment. No supply transfer occurs yet. When the last field-capable player leaves and at least one participant escaped, finish as `status:'retreat'`, retaining any captives/dead in the full report; add this status to validation and result UI rather than letting `checkEnd` call it defeat. With no escapees, existing defeat rules apply. Leave the tactical view on the remaining group, with M available. Following a second live tactical sector is outside the current single-battle architecture; label that limitation.

5. **Account for every participant when the encounter closes.** Build the report from the validated snapshot, not caller-supplied unit overrides. Partition request participants exactly once into `departed`, `resident`, `captured`, and `dead`. Conscious separated troops keep the encounter open unless the user explicitly abandons them. An unconscious person cannot walk out or be silently teleported with a friend; they remain for treatment/recovery, or become captive if a hostile force takes the sector. No carry mechanic is assumed. On a cleared field they remain resident patients. Report a dead person as dead, never missing. Keep militia and mission allies under their own existing roster rules.

6. **Rout uses the same boundary.** Replace immediate `rout` relocation with automatic fleeing movement through normal path/AP/energy/reaction processing on that unit’s turn. Drop the held gun once. A routed unit receives a departure receipt only after crossing its legal exit. A trapped routed unit is a surrender/capture candidate, not a successful escape. Do not revive or restore a dropped gun when returning it to campaign state.

7. **Commit once, with explicit ownership.** Sync tactical elapsed time first. Transfer each final personal state once: health, bleeding/bandages, energy/fatigue, morale/practice, supplies, inventory metadata, held item, mount and equipment condition. Only departed or friendly resident equipment may become available to the player. Captive equipment stays in inaccessible custody with that captive; avoid a second lootable copy. Bodies, discarded guns and uncollected ground/container items stay in the sector. Return only the appropriate ammunition partition once. Split squad membership before setting any location; never move unextracted members or remote horses through `synchronizeSquad`/`relocateDefenders`. Reuse the existing captivity/release loop; do not design a new prison mission.

## Save, arrival and regression requirements

- Default old active saves to no departure receipts. Do not infer an exit from a selected menu action or a bare `fled` flag. Preserve already recorded old health and gear. Old concluded snapshots remain loadable.
- Validate unique exit IDs, neighbor/scene destinations, receipt coordinates/timestamps, disjoint dispositions and complete request membership. Retaining departed records in `units` keeps the existing save membership invariant. Reject departed actors in reaction queues. A second commit for the same request must fail.
- `world.enterSector` must use the requested arrival edge for a new visit after travel/retreat. Reuse prior coordinates only for explicit resident continuation. Preserve bodies and abandoned equipment across later visits. Ensure an edge has legal spawn cells; report a blocked entry instead of moving arrivals to an interior room.
- Adapt auto-resolve timeout to a bounded legal withdrawal phase. Units that cannot escape are unresolved residents or captives according to the final control state; never label all survivors evacuated because time expired. Existing pre-combat retreat remains a strategic action.
- Test: center refusal; correct/wrong/blocked edge; insufficient AP and energy; bleeding collapse on exit; closed door or prop on approach; movement interruption before edge; selected departure while a second unit fights; departure save/load; escaping unit excluded from sight/fire; unconscious/routed/trapped/dead dispositions; corpse and exact tool/gun metadata after re-entry; dropped weapon not restored; partial squad/mount location; missing/duplicate reports; two submissions returning supplies once; new edge arrival; old save migration; scene exits; auto-resolve cannot manufacture evacuation.

The UI should reuse the retreat control for a destination and selected/all preview, show blocked names and reasons, and name anyone who will remain before abandonment. Keep this separate from completed-battle reporting and map viewing. T09 remains partial until the reducer, complete campaign transaction, arrival rules and these tests agree.
