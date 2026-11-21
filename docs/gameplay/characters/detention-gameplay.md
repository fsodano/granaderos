# Detention and physical rescue work

Across strategic prisoner custody and the tactical battlefield, physical custody, finite care, paid release/following and joint safe-exit settlement follow the bounded paths described below. The described rescue routes clear their guards before evacuation and retain deaths, finite supplies, contracts, replay and saves. Unaided/stealth rescue, self-directed escape, carrying incapacitated prisoners and wider detention choices remain open.

## Prisoner construction

The detention manifest reads living captives held in the requested sector and retains bodies recorded there. Each entity retains its captured operative identity, capture hour, name, health scale, current wounds, bandages, bleeding, energy and consciousness. It carries no weapon, ammunition, medical supply or inventory copy. That equipment remains in campaign custody.

Initial placement chooses separate walkable interior tiles, preferring rooms near the existing hostile force. It excludes occupied cells, map boundaries, blocked terrain and furniture. It does not create guards or change their weapons. Placement does not mutate its source battle. A detained civilian cannot roam or follow an escort order before being freed. Tactical validation rejects malformed identities, unknown sectors and copied equipment.

## Required integration

Campaign settlement uses the health planner and acknowledges prisoner state separately from civilian loyalty receipts. Captive identity, capture time, sector, health scale and cumulative first aid must match. Death clears living custody and the paused contract, retains an ammunition custody receipt, and prevents sector victory from reviving the soldier. Dead bodies remain on later visits. Released living soldiers retain the existing unused-contract restoration.

1. A sector request binds the manifest to the encounter and retains positions when available on reentry.
2. Sector recapture applies prisoner wounds, finite treatment, death and custody care to their service records.
3. A paid release action needs visible, adjacent controls. A freed prisoner must still reach an authorized safe exit through actual movement.
4. Each physical escape/rescue settles independently from sector victory. Only the saved unused contract time is restored. Unrecovered equipment stays in hostile custody.
5. Failed attempts, recapture, permanent deaths and remaining detainees are supported. Before physical escape can return a soldier to service within the same hour, replace the current soldier-plus-capture-hour identity with a distinct capture-cycle identity. Duplicate or missing settlement receipts are rejected.
6. W08 (surrender, capture, imprisonment and rescue in the [parity requirements](../../requirements/ja2-parity.md)) applies only to the paths actually completed.

## Finite care in custody

During an elapsed strategic hour, an able occupying guard with medical skill may stabilize one detained prisoner using one dressing from the actual confiscated medical supplies in that sector. The guard spends three energy. The ordinary first-aid formula controls partial work and the critical 15-HP ceiling. This does not restore full health, prisoner energy, equipment access or contract time. A second call in the same hour cannot repeat the stroke. No supplies, no able guard, or an active tactical encounter means no strategic treatment. Untreated prisoners can still bleed and die during tactical combat.

Each stroke saves its hour, guard, supply owner, dressing charge and before/after health and bleeding. Sector snapshots and stationary enemy-group energy stay consistent. The campaign log and prisoner panel show actual care and its last hour.

## Physical release and local escort

A visible adjacent prisoner can be freed through **Soltar ataduras**. The rescuer must be able to act, standing or crouched, unmounted and unbound, on the same level with a clear line of sight. Release costs 15 AP in combat or one second in exploration. It preserves wounds, finite supplies and confiscated equipment. An unconscious prisoner still needs medical care before walking.

Freed prisoners use the ordinary civilian movement routes and budgets. **Seguirme** and **Esperar aquí** cost 2 AP in combat or one second in exploration and require an adjacent rescuer. Another soldier can take over if the original rescuer falls. Danger still causes shelter behavior. Release and subsequent escort orders have validated, persistent receipts; campaign synchronization rejects removal of acknowledged orders. These costs are Granaderos tuning.

Freeing restraints does not restore service or grant equipment. Sector recapture remains the working rescue settlement. A failed relief attempt restores detention and retains the original release attempt. Each new capture has a separate sequence, including two captures during the same campaign hour, so earlier custody records cannot replace the new capture.

## Escape through a safe exit

A freed prisoner can cross an authorized boundary with the assigned rescuer. Both must stand on that same map edge in adjacent cells. The prisoner must be following, conscious, unbound, able to walk and have more than one energy point. The rescuer uses the ordinary paid exit, including its time, movement cost and enemy reaction window. Only after that crossing succeeds does the adjacent prisoner cross, spending one energy point. These values are game tuning. Interior, waiting, incapacitated or restrained prisoners stay on the map. The exit panel names followers who can cross and warns about those who will remain.

The tactical save retains the prisoner's departure, leader, geometry and clock. Service remains in custody until the campaign accepts the deployment report. Settlement checks the requested route and current destination control, then restores only the escaped prisoner's remaining contract time. An expired contract grants no new service. Health is retained, the prisoner arrives at the real destination and may join a local squad with space. Other prisoners and enemy ownership remain unchanged.

Confiscated hands, pack, cursor, clothing, loaded rounds and supplies become finite ground stacks at the release location. The escaped operative returns unarmed and without those supplies. Equipment uses ordinary later field pickup and ownership checks; it is not credited to treasury or shared stores. Captured horses remain at the source. Duplicate reports cannot create another cache.

Self-directed escape from captivity, broader detention choices and a complete fresh campaign remain open.

### Combat rescue from arrival

`tests/prisoner-rescue-route.test.mjs` uses an established-front capture fixture and paid six-person relief force. Rescuers retain their actual map arrival positions. Each owned gun keeps its required crew and a lateral infantry screen. When a visible prisoner is at risk from a missed shot, the screen chooses a known safe shot if its chance × damage factor is at least 90% of the proposed shot; direct prisoner interception prevents firing. Confiscated equipment stays in unique field caches. Guards are defeated before evacuation. Departed prisoners do not occupy their former cells for movement, door closure or artillery movement.

The held-item cursor excludes departed, fled and unseen NPC gift recipients: an escaped recipient does not replace the movement preview, actual movement succeeds and the carried item remains owned.
