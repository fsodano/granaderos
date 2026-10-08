# Detention and physical rescue work

> **Dated implementation and acceptance records.** Earlier checkpoints below
> retain their original source, failures and controlled fixtures. FIX-03 and the
> [PR139 publication receipt](../../evidence/pr139-published-2026-10-01.json) accept
> the bounded cleared-field rescue. See [published progress](../../verification/published-progress.md).

Status on main `916049df7346a5b655564fafdea37c93be76045c` (8 October 2026): physical custody, finite care, paid release/following and joint safe-exit settlement are implemented in the bounded paths recorded below. The actual Jujuy relief route clears its guards before evacuation and retains deaths, finite supplies, contracts, replay and saves. Unaided/stealth rescue, self-directed escape, carrying incapacitated prisoners and wider detention choices remain open. The earlier paragraphs are dated checkpoints; their original unimplemented/failure statements are superseded only by the later named accepted paths.

## Prisoner construction

The detention manifest reads living captives held in the requested sector and retains bodies recorded there. Each entity retains its captured operative identity, capture hour, name, health scale, current wounds, bandages, bleeding, energy and consciousness. It carries no weapon, ammunition, medical supply or inventory copy. That equipment remains in campaign custody.

Initial placement chooses separate walkable interior tiles, preferring rooms near the existing hostile force. It excludes occupied cells, map boundaries, blocked terrain and furniture. It does not create guards or change their weapons. Placement does not mutate its source battle. A detained civilian cannot roam or follow an escort order before being freed. Tactical validation rejects malformed identities, unknown sectors and copied equipment.

Twenty-five focused detention, civilian and escort checks, type checking and the production build pass. These use explicit captivity and map fixtures. They verify construction and tactical save restoration, not campaign wound settlement or release.

## Required integration

Campaign settlement now uses the health planner and acknowledges prisoner state separately from civilian loyalty receipts. Captive identity, capture time, sector, health scale and cumulative first aid must match. Death clears living custody and the paused contract, retains an ammunition custody receipt, and prevents sector victory from reviving the soldier. Dead bodies remain on later visits. Released living soldiers retain the existing unused-contract restoration.

Fifteen focused construction, health and campaign checks pass. The campaign checks use actual capture settlement, paid hires and purchased supplies, then explicit positioning to isolate first aid. Reentry, missing prisoners, false health increases, full saves, fatal bleeding, one-time treatment and scripted sector-victory settlement are covered. Scripted victory is not combat-balance evidence.

A live browser check imported the adjacent-medic fixture and used the visible “Vendar a Juan Bautista Cabral” control. Cabral changed from 11 to 15/96 HP, bleeding 2 to 0; the medic spent one dressing (4 to 3) and 20 AP (52 to 32). Reload retained these values and captive status. This is treatment-control evidence, not proof of a route through the guards.

The integration run reported 2,584 passes, three failures (including a failed parent scenario) and three dependent skips. The two underlying failures are the northern rescue route and stationed-artillery rescue. Their old assertions assume captive wounds remain frozen during combat; physical detainees now bleed out before those controllers reach them. That result is the earlier integration checkpoint. The finite-care change below addresses those failures without erasing casualties or granting supplies.

1. Completed for current sector requests: bind the manifest to the encounter and retain positions when available on reentry.
2. Connected and verified for sector recapture: prisoner wounds, finite treatment, death and custody care update their service records. The two real rescue routes now pass.
3. Add an adjacent, paid release action and visible controls. A freed prisoner must still reach an authorized safe exit through actual movement.
4. Settle each physical escape/rescue independently from sector victory. Restore only the saved unused contract time. Keep unrecovered equipment in hostile custody.
5. Support failed attempts, recapture, permanent deaths and remaining detainees. Before physical escape can return a soldier to service within the same hour, replace the current soldier-plus-capture-hour identity with a distinct capture-cycle identity. Reject duplicate or missing settlement receipts.
6. Verify complete capture-to-rescue and escape paths, live controls, full saves and campaign continuation. Update W08 only for the paths actually completed.

## Finite care in custody

During an elapsed strategic hour, an able occupying guard with medical skill may stabilize one detained prisoner using one dressing from the actual confiscated medical supplies in that sector. The guard spends three energy. The ordinary first-aid formula controls partial work and the critical 15-HP ceiling. This does not restore full health, prisoner energy, equipment access or contract time. A second call in the same hour cannot repeat the stroke. No supplies, no able guard, or an active tactical encounter means no strategic treatment. Untreated prisoners can still bleed and die during tactical combat.

Each stroke saves its hour, guard, supply owner, dressing charge and before/after health and bleeding. Sector snapshots and stationary enemy-group energy stay consistent. The campaign log and prisoner panel show actual care and its last hour. In the browser fixture, Cabral reached 15/96 HP using one confiscated dressing at day 1, 2:00; the panel retained that report after reload.

Twenty focused care, campaign, health and panel checks pass. The paid stationed-artillery rescue passes its actual combat and save/return check. All eight established-area northern-route checks pass without skips, reaching Yatasto at hour 292, second 2534 with 1,377 pesos, 11 permanent deaths and no captives. The route verifies health gains and missing confiscated dressings against recorded care; it does not overwrite the captured records to create recovery. Earlier recovery changes raid timing, so the Salta gate checks every raid that actually arrives and rejects unanswered raids. These are sector-recapture routes, not proof of physical escape or the full Retiro-only campaign.

Final integration verification: **2,597/2,597 tests pass with no skips**. Type checking and the production build pass. The live care report survives reload. These checks do not complete the physical release/escape requirements above.

## Physical release and local escort

A visible adjacent prisoner can now be freed through **Soltar ataduras**. The rescuer must be able to act, standing or crouched, unmounted and unbound, on the same level with a clear line of sight. Release costs 15 AP in combat or one second in exploration. It preserves wounds, finite supplies and confiscated equipment. An unconscious prisoner still needs medical care before walking.

Freed prisoners use the ordinary civilian movement routes and budgets. **Seguirme** and **Esperar aquí** cost 2 AP in combat or one second in exploration and require an adjacent rescuer. Another soldier can take over if the original rescuer falls. Danger still causes shelter behavior. Release and subsequent escort orders have validated, persistent receipts; campaign synchronization rejects removal of acknowledged orders. These costs are Granaderos tuning.

Freeing restraints does not restore service or grant equipment. Sector recapture remains the working rescue settlement. A failed relief attempt restores detention and retains the original release attempt. Each new capture has a separate sequence, including two captures during the same campaign hour, so earlier custody records cannot replace the new capture.

Verification covers paid actions, proximity and posture rejection, finite following, replacement leadership, wait orders, full saves, failed rescue and repeated capture. A live Humahuaca fixture placed the rescuer beside a prisoner: release reduced AP from 52 to 37, wait to 35 and follow to 33. Reload retained the follow order and 33 AP. This fixture proves controls and persistence, not an unaided rescue route. Safe-exit escape, individual service restoration outside sector victory and equipment recovery from hostile custody remain unfinished.

## Escape through a safe exit

A freed prisoner can now cross an authorized boundary with the assigned rescuer. Both must stand on that same map edge in adjacent cells. The prisoner must be following, conscious, unbound, able to walk and have more than one energy point. The rescuer uses the ordinary paid exit, including its time, movement cost and enemy reaction window. Only after that crossing succeeds does the adjacent prisoner cross, spending one energy point. These values are game tuning. Interior, waiting, incapacitated or restrained prisoners stay on the map. The exit panel names followers who can cross and warns about those who will remain.

The tactical save retains the prisoner's departure, leader, geometry and clock. Service remains in custody until the campaign accepts the deployment report. Settlement checks the requested route and current destination control, then restores only the escaped prisoner's remaining contract time. An expired contract grants no new service. Health is retained, the prisoner arrives at the real destination and may join a local squad with space. Other prisoners and enemy ownership remain unchanged.

Confiscated hands, pack, cursor, clothing, loaded rounds and supplies become finite ground stacks at the release location. The escaped operative returns unarmed and without those supplies. Equipment uses ordinary later field pickup and ownership checks; it is not credited to treasury or shared stores. Captured horses remain at the source. Duplicate reports cannot create another cache.

Focused checks include an ordinary walk/follow/wait-to-catch-up route through a joint crossing, rejection cases, full campaign saves, remaining/expired contracts, an occupied destination, and actual later pickup with rejection of a repeated pickup. The live Humahuaca check starts with the freed prisoner and rescuer explicitly positioned at the eastern boundary. Its preview names Cabral, the exit reaches Jujuy, campaign return retains 15/96 HP and empty equipment, and reload retains patient status. This is controlled exit evidence, not proof of an unaided approach through the occupied map. Self-directed escape from captivity, broader detention choices and a complete fresh campaign remain open.

### Verified combat rescue from arrival

`tests/prisoner-rescue-route.test.mjs` uses an established-front capture fixture and paid six-person relief force. Rescuers retain their actual map arrival positions. Each owned gun keeps its required crew and a lateral infantry screen. When a visible prisoner is at risk from a missed shot, the screen chooses a known safe shot if its chance × damage factor is at least 90% of the proposed shot; direct prisoner interception prevents firing. Ordinary combat, release, following and boundary actions return all three prisoners to Jujuy on turn 7 after 732 seconds, with saves between departures. Four rescuers survive; Villalba and Soria remain dead. The swivel fires four shots and the bronze cannon three, leaving three and four unloaded reserve shots respectively. Eight of the original 60 personal cartridges are spent; misfires retain their charge. Full recorded-order replay, intermediate saves and final settlement reproduce the actual wounds, deaths and custody. Confiscated equipment stays in unique field caches. The guards are defeated before evacuation; this route does not prove stealth escape or a fresh campaign. Departed prisoners no longer occupy their former cells for movement, door closure or artillery movement.

The held-item cursor now excludes departed, fled and unseen NPC gift recipients. The departed-cell regression proves that an escaped recipient no longer replaces the movement preview, actual movement succeeds and the carried item remains owned. The regression fails against the old lookup; the 20 focused gift, prisoner and civilian-aid checks pass with the fix.
