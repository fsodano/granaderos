# Gameplay completion work

> **Dated development record.** The current section distinguishes published
> evidence from the historical checkout notes below. See
> [published progress](published-progress.md) for individual requirements.

## Current acceptance — 7 October 2026

Full gameplay completion and final visual acceptance are **not achieved**.
The September blockers below are historical; they must not be read as the
current state of the merged game.

- Published `WIN-01` and `E-FRESH-ENDING` record a complete fresh stock historical
  route with paid service, finite supplies, permanent losses, saved victory and
  post-victory continuation. `POST-01` records an independently authored campaign
  ending. These routes were accepted in earlier increments; this 3D review has
  not rerun their long campaign checks.
- Published `FIX-01` through `FIX-04` and `REL-02` record the later recovery,
  recapture and physical prisoner-evacuation corrections. Their stated limits
  still apply, including cleared-field evacuation rather than an accepted
  stealth rescue through live hostile contact.
- The normal battlefield uses the native 3D human library, held equipment and
  colonial scenery. [The October review](three-gameplay-review-2026-10-07.md)
  records the movement, rifle loading, clothing, roof and building corrections
  merged through PRs #185–#188, plus their browser evidence and remaining limits.
- The last broad routine check ran 745 files and 5,216 tests in 8.44 minutes.
  It passed 5,206 tests and exposed ten old fixed-duration expectations. The
  affected gait, wheel-route and enemy-campaign checks now pass against the
  native movement clock. The entire routine selection was not repeated after
  those test corrections. Subsequent increments use affected fast checks,
  native-asset validation, type checking and live review.
- Current visual work includes mounting support, hand-specific pistol loading,
  throw recovery and building supports. Climbing support and duration, mounted
  boot contact, other action contacts and the remaining gameplay parity rows
  still require their own implementation and acceptance. A successful export
  or one warm 60 FPS scene does not close those requirements.

## Historical acceptance — 27 September 2026 (superseded)

Full gameplay completion is **not achieved**. Current evidence takes precedence
over the historical progress notes below.

- The fresh paid route now passes Córdoba care and its real counterattack,
  preserves six defense casualties, and wins Tucumán. It stops during the next
  medical recovery because a wounded location has no fit local medic. The full
  route and ending remain unverified.
- The latest broad run has 2,951 tests: 2,944 passed, four failed and three
  skipped. Remaining failures are the fresh medical-relief route, the established
  Córdoba recapture (child and parent), and the physical prisoner rescue. The
  final intro wording cleanup separately passes all 22 intro/Home/desk checks.
- A four-scene new-game introduction now leads directly to hiring or character
  creation. Existing saves can replay or skip it without a reset. Failed second
  pistols use the existing paid priming control, overdue blocked deliveries give
  saved once-only notices, and shot previews identify visible bystanders at risk.
- One hired or created character now starts the campaign without the 300-peso
  funding step. Exploration walking and crouching consume substantially less
  energy. Actual campaign rendering, save encoding and route animation now
  include the performance changes described in the current record.
- The shared main campaign uses the equipment, lighting, endurance and worker
  improvements. Immediate and queued assaults now use the same journey rules,
  including selected transport, terrain time, remount costs and fatigue.
- Equipment-specific knife/sword artwork and full loaded-scenario 60 FPS
  acceptance remain incomplete. Prepared-scene measurements do not prove cold
  loading or every combat scenario meets the frame budget.
- Prisoner rescue, campaign recovery and remaining combat-route failures must
  still pass with real resources, actual casualties and physical evacuation.

See [latest gameplay, intro and validation results](gameplay-follow-up-2026-09-27.md),
[current changes, tests and performance evidence](gameplay-and-campaign-performance-2026-09-27.md),
[previous regressions and route evidence](current-worktree-regressions-2026-09-26.md),
[main-campaign integration](main-campaign-integration-2026-09-26.md), and
[the full parity audit](ja2-parity-audit.md).

## Historical progress snapshot — 22 September 2026 (superseded)

The active goal is still **full gameplay completion**. The user additionally
requires **60 FPS**, particularly at 100% zoom. Native-density scenery now
removes the measured cache rebuild stalls after zooming out. Production forest
walks in daylight and night each record 518 moving frames, maximum 10.3 ms,
with no frames above 16.8 ms. All 202 cached images retain their identity across
zoom and movement. Scenery remains at 79.6 million pixels at both 100% and 300%,
instead of rising to 153.2 million at 300%. Magnified ground and buildings can
look softer above 100%. Cold loading, large combat, moving lights, room reveals,
zoom-click frame time and other hardware remain unverified. Full-game locked
60 FPS is not complete. See [current measurements](../development/performance/scenery-cache-performance.md)
and the `nativeDensityFollowup` section of [frame evidence](../evidence/frame-rate-2026-09-22.json).

Recovered handheld weapons can now move from a soldier to the armory through **Guardar en armería** at a secured maestranza. The existing merchant can then buy that exact item. Storage preserves ammunition, condition, attached fittings and item identity, and rejects stale or duplicate orders. All 24 sector-inventory checks and the production build pass.

Knife/sword character artwork is still not integrated; rejected generated
candidates are not completion evidence. B now selects firearm melee mode with
an intact fitted bayonet or a stock strike. Longer walking now applies throughout exploration, including hostile sectors
before contact. Rest earns up to 60 energy across ten game minutes, and combat
round recovery for the controlled squad rises to 20. Contact interrupts proportional rest recovery;
fatigue caps and critical wounds still apply. Full campaign balance still needs
verification after these changes. The last full suite passed 2,722 of 2,726 tests before the latest driver updates.
Two focused current checks now pass: the hired first expansion and fresh capital
recovery with paid replacements, permanent deaths and retained equipment. The
full fresh route now wins San Nicolás, San Lorenzo, Córdoba and the Córdoba
counterattack after paid resupply, physical equipment recovery and survivor-aware
squad formation. A continuation from that counterattack now sells eleven surplus guns through
the new armory path and keeps the doctor employed during regrouping. All 17
survivors reach Tucumán healthy and supplied. The battle wins in seven turns,
with one permanent death; deterministic replay and save checks pass. The full
fresh integration now confirms medical recovery, both subsequent counterattacks,
Salta and Yatasto (phase 3). The continued current-balance route also wins
Mendoza, opens the foundry, and produces 3,000 infantry and three cannons.
Cuyo now retains reserves in separate squads, pays the specialist from real
funds, and waits for affordable production. The new full integration rerun confirms Mendoza, then stops at the first
cannon funding check. The subsequent affordability fix passes the foundry
and full army continuation. The first Uspallata assault lost with the cannon behind its infantry screen.
Advancing the gun when it lacks a safe shot now wins in eight turns with all
eight soldiers alive; deterministic replay and save checks pass. They return
in two legal squads. Selling finite surplus weapons and buying dressings as needed
now pays for their complete recovery. The continued route wins Los Patos with a
close infantry screen, reaches phase 4, and wins Ensenada after paid healing,
ammunition and cannon supply. Ensenada kills Barcala and three other combatants;
subsequent helpers must use living replacements. Naval recruitment passes. Recovery now also includes the routed recruit in
Buenos Aires, who the earlier field-only care list missed. All actual coastal
survivors finish care at Retiro at hour 2452 with 3,679 pesos. The supplied
blockade assault then wins in 20 turns, passes deterministic replay and save
settlement, and clears the blockade. Its living field is Beltrán, San Martín,
Bouchard and operative 128; Paroissien and Brown are among the permanent losses.
Santa Fe now wins in 23 turns, followed by Tucumán recapture in 10, Salta in 7,
and Jujuy in 37. All four pass replay and save settlement checks. The route
uses real garrison assembly, paid replacements, supplies and renewals. Beltrán
survives Jujuy at 1 HP but dies before the subsequent first-aid approach reaches
him. San Martín remains alive at Córdoba. During final resupply, new 17-soldier
forces occupy Jujuy and renew the coastal blockade. The reinforced column now recaptures Jujuy in 43 turns after paid recruitment of three reserves. Replay and save checks pass; three survive and six deaths remain permanent. Two wounded living reserves then complete paid care at Córdoba. The five-soldier column is fully healed, supplied and reloaded at hour 3438 with 2,468 pesos. The renewed blockade and Humahuaca still precede the actual ending. The first supplied Humahuaca attempt fails in three turns. A corrected two-person cannon approach also fails; the route is not accepted past Jujuy. Two focused controller checks cover persisted bodies, cannon ownership and crew continuity. These are focused
checkpoint continuations; full integration and ending remain unverified.
See [current northern-return evidence](../evidence/endurance-northern-return-2026-09-22.json).
See [current coastal evidence](../evidence/endurance-coastal-route-2026-09-22.json).
See [current Cuyo evidence](../evidence/endurance-cuyo-route-2026-09-22.json). See [current Tucumán evidence](../evidence/endurance-tucuman-route-2026-09-22.json). The established
southern route and prisoner/artillery rescue also remain unresolved. The full
suite has not yet been rerun. See [current-balance route evidence](../evidence/endurance-cordoba-route-2026-09-22.json). Legal shorter-bound
opening experiments do win with actual casualties. See [endurance evidence](../evidence/endurance-2026-09-22.json).
The following route checkpoints predate this endurance change: the fresh route prepares eight actual survivors for Tucumán with
full health, paid contracts, loaded firearms, and compatible ammunition. A daylight
assault now wins with deterministic replay and save verification. Subsequent
recovery now wins the Córdoba hospital defense, recruits through live dialogue,
and wins Salta and its counterattack. The clean-start
integration rerun confirms Yatasto and phase 3 at hour 424. Cuyo preparation now gathers the two living reserves before the elite hire.
The clean-start rerun wins Mendoza, completes foundry and army production, wins
both mountain passes, and reaches phase 4. It then stalls in the Ensenada battle
after 81 turns; the coastal campaign and ending remain unverified on this state.
See [phase-4 checkpoints](../evidence/andes-phase4-2026-09-22.json). The full parity baseline below remains authoritative.

The objective is complete Granaderos gameplay with classic JA2 parity where appropriate to the period. The requirement baseline remains [the parity audit](ja2-parity-audit.md). This work list does not replace or reduce that baseline. Passing one scenario or one test group does not prove completion.

## Recovery checkpoint — 21 September 2026

- Recovered and committed critical first aid, civilian health persistence and associated campaign corrections as `2c121e3`.
- Verified the preserved pending files against the prior integration snapshot. All 51 unrelated files matched; overlapping gameplay/art files retained their separate changes.
- Re-ran 33 critical-care and automatic-bandaging tests, type checking and the production build successfully. The earlier completed integration log records 301 passes; it is historical evidence, not a new full-suite result.
- Added a coastal defense regression with actual capture, a paid hire, travel reversal and encounter entry. A scripted victory isolates prisoner settlement. It checks wounds, ammunition, saves, duplicate reports and remaining hostile groups. This is not proof of combat balance or a playable prison scene.

## Integrated verification progress

- The first full current-workspace run reported 2,530 passes, three failures (including the failed parent scenario) and three dependent skips. The causes were an old fixed hiring total and a rescue plan that could no longer afford the pending elite prices.
- The revised opening check uses the actual quoted contracts. The established-area route now passes all eight checks with no skips at the current prices; see [northern route](northern-route.md).
- A fresh Retiro-only paid force captures Buenos Aires, retains four real deaths, pays for medical recovery and replacement contracts, and saves successfully. It does not grant sectors or restore casualties. The initial six-person continuation loses at San Nicolás. A paid, equipped second squad wins the coordinated assault; the expanded fresh-route test passes. An initial San Lorenzo attempt lost the commander; the later coordinated victory is recorded below. The full fresh campaign remains open.
- Coastal capture/defense checks also retain the blockade while another coastal force is waiting or engaged. The 24 focused capture and enemy-group checks pass.

- The subsequent integrated suite passed **2,537/2,537 tests with no skips**. The expanded fresh-route test also passed separately. Type checking and the production build passed.
- The next real San Lorenzo experiment cleared the enemy force but lost San Martín. It exposed a return-ledger error: campaign defeat classified surviving soldiers as captive despite a cleared battlefield. The fix preserves terminal mission defeat and gives survivors their actual safe-field custody. All 31 focused mission, report and exit tests pass after this final fix. The 2,537-test run precedes this fix and is not represented as a later full-suite run.

- Accepted errands now have a permanent contact-death failure branch with saved evidence and a once-only campaign notice. Physical partial deliveries stay delivered, and completed errands are retained. See [quest failures](../gameplay/characters/quest-failures.md). The Cuaderno lists known errands, acknowledged delivery progress, requirements and permanent outcomes; empty and failed entries were checked in the live browser. This does not complete escort, alternative-resolution or prison gameplay.

- Automatic field care now includes visible civilians, with finite supplies, ordinary typed treatment orders and named civilian save/reentry checks. All 57 focused care and inventory checks, type checking and the build pass. A live adjacent civilian treatment consumed one dressing and two seconds, stopped bleeding without restoring noncritical HP, and retained the result after reload; see [automatic civilian care](../gameplay/characters/automatic-civilian-care.md).

## Fresh San Lorenzo victory checkpoint

The fresh-start integration test now continues from its actual San Nicolás victory into paid mission preparation. It hires Quiroga, Delatour, Barrera, Morel, Ricci and Villalba for a week, collects existing long guns through legal tactical movement and looting, and takes up to ten reachable battlefield dressings for the medic. It preserves all previous deaths, checks the exact contract debit, and validates saves. The full fresh-start test passes in about 19 seconds. This is preparation evidence, not San Lorenzo victory.

Three additional controlled continuations did not win: keeping the commander in western shelter preserved him but lost the field squad; returning him after two rounds lost the mission; the stronger squad with more recovered medical supplies also lost. No battle rules, enemy strength, initial health or victory conditions were changed. These failures do not by themselves prove a balance defect.

Coordinated mission deployment is now implemented: the desk explicitly selects eligible co-located squads, retains a validated manifest, and uses the existing arrival and return/save rules. Eight-person placement, reload and entry passed live; focused tests cover settlement and a supporting soldier's physical exit. See [mission squads](../gameplay/campaign/mission-squads.md). The integrated suite passes 2,557/2,557 with no skips; type checking and the production build pass. This integrated run preceded the fresh-campaign mission victory below.

The continuous fresh-start test now wins San Lorenzo with twelve explicitly selected soldiers. The support squad uses paid contracts and existing equipment; missing recovered rifles are not supplied for free. The commander moves to western shelter, then rejoins through ordinary tactical orders. Both northern battles replay deterministically. The final saved checkpoint is phase 2, hour 54, second 1472, with 417 pesos, San Martín at 88 health, and all 20 cumulative deaths retained. The test passes in 26.5 seconds. No victories, money, sectors or revived soldiers are injected. This proves this route through San Lorenzo; later phases and the ending remain unverified from a fresh start.

## Fresh northern recovery checkpoint

The continuous Retiro route now continues through actual recovery at San Nicolás. It retains the surviving doctor's existing contract and pays 119 pesos for the second doctor. Capacity-aware pickups leave surplus dressings in the sector; later care can collect them when space becomes available. Two patients recover fully using 20 dressings. Paid ammunition production and rest advance the route to hour 72 with 361 pesos. Every prior death remains permanent and the saved state validates.

An actual six-person Córdoba continuation loses. This is not a successful fresh northern campaign, and no enemy, health, supply or victory rule was changed to make it pass. The established-area northern scenario remains separate evidence. Its eight regression checks pass with no skips; the expanded fresh-start check also passes. These checks cover the route changes, not the full gameplay audit.

## Physical medical delivery

Tucumán now has a carried dressing errand with partial deliveries, quantity refusal, persistent ownership, notebook progress and a one-time loyalty reward. All 49 focused checks, type checking and the build pass; see [medical delivery](../gameplay/characters/physical-medical-delivery.md) for exact scope. Live partial delivery, excessive-quantity refusal, completion and reload/notebook verification now pass. This does not complete escort, prison or alternative quest resolutions.

## Integrated medical-delivery verification

The current integrated suite passes **2,561/2,561 tests with no skips**. Added medical-errand checks cover permanent contact-death failure, retained completed rewards, physical supply custody, duplicate synchronization and rejection of missing saved receipts. All 49 unrelated files in the preservation snapshot remain byte-identical. This run does not close the remaining partial or unverified audit requirements.

## Local escort gameplay

Jujuy now has an accepted escort with local follow/wait and leader-change orders, actual movement to the western boundary, controlled-destination checks, one-time rewards, death failure, saved directives and notebook outcomes. Live acceptance, waiting, following, arrival and reload/notebook checks pass; see [escort gameplay](../gameplay/characters/escort-gameplay.md) for exact scope. W07 remains partial for broader quest consequences and alternatives. W08 prison rescue/escape remains open. The integrated escort run passes 2,571/2,571 tests with no skips. The last intermediate-return and failure-text changes pass a separate 14-test follow-up; final type checking and the build pass.

## Prisoner custody preparation

The prisoner panel now exposes detention time, wounds, unavailable equipment and paused service. Sector recapture and the panel use a shared contract-restoration rule; 13 focused checks, type checking and the build pass. See [prisoner custody](../gameplay/characters/prisoner-custody.md). This does not implement a prison scene, physical rescue or escape; W08 remains open.

## Detention entity construction

A detention manifest and tactical placement layer now preserve captured identities and wounds without duplicating custody equipment. Detained entities remain immobile until freed; 25 focused checks pass. Campaign deployment, health settlement, paid release, safe-exit settlement and live controls remain required. See [detention work](../gameplay/characters/detention-gameplay.md). This is a construction layer, not playable prison gameplay.

## Work order and completion evidence

1. **Stabilize the integrated game.** Run the complete current suite, resolve failures without removing finite supply, permanent casualties, legal movement, or save checks. Preserve separate artwork and roster changes. Verify type checking, the production build and relevant live controls.
2. **Prove the complete campaign (W10).** Start at Retiro with no recruits and no free sectors. Use paid hiring, actual tactical battles, finite supplies, medical recovery, contracts, production, travel, local recruitment and mission interactions through the ending. Retain casualties and saves between phases. Replace old fixed-hour route assumptions with checks of actual game events. Keep earlier established-area scenarios as subsystem evidence.
3. **Finish capture, dialogue and quests (S09, W05–W08).** Implement playable detention/rescue or escape, escort destinations, alternative resolutions, failure consequences, physical deliveries and one-time rewards. Keep historical setting and finite equipment custody. Include interface, persistence and real tactical-path verification.
4. **Finish strategic decisions (R01–R06, S02, S05–S08, W02–W04, A02–A03, A07).** Cover contract choices and risk, relationships and departures, equipment repairs and merchants, militia orders and care, enemy reinforcement resources and uncertain intelligence, transport capacity and passenger rest, arrivals during battle, and interruption notices. Each exposed choice needs working consequences and save validation.
5. **Finish tactical and equipment choices (T07–T09, C03–C04, C10–C12, V02, V06, V09, P04, I01–I09, E02–E05, A06).** Complete supported observation, movement, protection, damage, demolition, tools, hand operations, artillery handling and field progression. Research period support before adding camouflage, armor, fittings or ammunition variants; label numerical adaptations. Do not close a requirement merely because an existing simpler mechanic resembles it.
6. **Complete visible acceptance.** Exercise the audit's remaining live checks for interrupts, awareness, sound, stealth, movement, melee, items, merchants, militia and campaign controls. Verify actual production assets, keyboard and pointer input, previews, rejected actions and save continuation. Recheck every audit row against the final integrated game before claiming completion.

## Reporting rules

Record exact tested scope and remaining gaps. A fixture that injects a victory is never a campaign-playability proof. A test that supplies a starting injury or terrain can verify settlement but must disclose that boundary. Do not mark the goal complete while required audit rows remain missing, partial or unverified.


## Physical detention integration checkpoint

Captives now deploy on campaign maps. Wounds, ordinary finite first aid and deaths synchronize with service records; full saves, reentry, live treatment and paused-contract sector release are checked. See [detention gameplay](../gameplay/characters/detention-gameplay.md). This introduces an unresolved route issue: untreated physical prisoners can bleed out during the relief battle. The full integration run has 2,584 passes, three failures including the parent rescue scenario, and three dependent skips. Physical release/escape and a verified viable rescue path remain required; W08 is still partial.


## Finite custody-care checkpoint

Able occupying guards now use real confiscated dressings to stabilize prisoners during elapsed strategic hours. The first-aid formula, supply deductions, guard energy, once-per-hour receipts and full saves constrain treatment. Active tactical sectors receive no background care. The two failed sector-recapture routes now pass; the established route completes all eight checks through Yatasto with 11 permanent deaths. The live prisoner panel retains its exact treatment report after reload. See [detention care](../gameplay/characters/detention-gameplay.md#finite-care-in-custody). This restores viable sector-recapture rescue; physical release, safe-exit escape and the full campaign remain open.

The final custody-care integration suite passes **2,597/2,597 tests with no skips**. Type checking and the production build pass; unrelated art and roster files remain unchanged.

## Physical release checkpoint

Recovered the interrupted prisoner-release work and added local wait/follow controls with replacement leadership. Prisoners retain wounds and equipment custody; paid release and escort receipts survive full saves. Failed attempts restore detention, and repeated same-hour captures have distinct identities. Seventeen focused simulation, campaign-save and rendered-control checks pass, including death after release and later reentry. Live release, wait, follow and reload preserve the exact 15/2/2 AP costs. The final integrated run passes 2,606 tests with no skips. The additional post-release death regression passes in the 17-check follow-up. Type checking, production build and staged diff checks pass. The 49 unrelated preservation files retain their content after excluding the two new prisoner-panel lines in Battlefield. Safe-exit escape and the complete Retiro-to-ending route remain open; this checkpoint does not close W08 or W10.

## Safe-exit rescue checkpoint

A freed prisoner can leave with an adjacent rescuer through the same authorized boundary. The exit preview shows whether the prisoner can cross or will remain. Campaign return restores only remaining service at the safe destination, retains wounds and leaves confiscated equipment as finite recoverable field items. Focused tests cover ordinary escort movement, rejection, saved departures, contract expiry, hostile destination rejection and later equipment pickup. Live Humahuaca boundary escape and Jujuy patient/save/reload checks pass from explicitly positioned actors. An unaided rescue approach, self-directed detention escape, broader W08 consequences and the full W10 campaign remain unverified or unfinished.

Safe-exit validation: the integrated run passes **2,613/2,613 tests with no skips**. The final 27-check follow-up covers the added exit presentation checks, missing accepted-escape receipt rejection and captured-horse custody, alongside prisoner and horse regressions. Type checking and the production build pass. This does not prove a full fresh campaign or a rescue approach from the map's arrival point.

## Arrival-to-rescue route checkpoint

A paid six-person rescue force now starts at the normal Humahuaca arrival edge, fights the guards, frees all three prisoners and escorts them to Jujuy. The route saves between departures and retains one permanent rescuer death, wounds, ammunition use and finite confiscated equipment. Departed prisoners no longer block movement, doors or artillery at their former positions. The established-front fixture scripts the initial capture and strategic staging; it does not prove a fresh campaign. Guards are cleared before evacuation, so escape past active guards and self-directed escape remain unverified.

Validation: **2,615/2,615 tests pass with no skips**; type checking and the production build pass. The new arrival-to-return route and the regression for movement through a departed prisoner's cell pass. W08 and W10 remain partial.

## Fresh Córdoba continuation

The continuous Retiro-only route now wins Córdoba after San Nicolás and San Lorenzo. The existing two doctors join the six-person field force through ordinary queued squad travel. No personnel, supplies, sectors or victories are injected. Each tactical battle replays deterministically and passes through campaign save/return. The focused full-route test passes in 34.5 seconds. The Córdoba checkpoint is phase 2, hour 84, second 1635, with 611 pesos and 25 permanent deaths; only four hired survivors remain. This is a costly viable continuation, not evidence of good balance or a completed campaign. Later northern sectors, Yatasto and the ending remain unverified from the fresh start.

## Fresh Córdoba survivor recovery

The continuous fresh-start regression now also recovers the two wounded soldiers who routed to Buenos Aires during Córdoba. A paid local doctor uses finite recovered dressings. When those are exhausted, the stabilized patients and doctor travel to Retiro and buy supplies from its real shop. Both regain full health through elapsed care, all 25 prior deaths persist, and campaign saves round-trip. The checkpoint reaches hour 117 with 604 pesos and the two patients at Retiro; the northern survivors remain at Córdoba. The focused continuous test passes. Re-equipment, reunion and the subsequent northern campaign remain open.

## Fresh reunion and Córdoba defense

The fresh-start route now equips the routed survivors from their existing carried pistols, rests the recovery party, renews contracts when required and travels back to Córdoba. The elapsed time produces an actual northern enemy counterattack. All five living hires participate in its tactical defense, which wins and replays deterministically. Campaign saves and permanent casualties remain enforced. The focused continuous route test passes through this defense. The resulting checkpoint is hour 152, second 1713, with 1,112 pesos, five living hires and the same 25 deaths. The first attempt with unequipped routed soldiers retreated; no combat rules or enemy strength were changed. The advance beyond Córdoba and the ending remain open.

## Fresh Tucumán approach investigation

The continuation after the real Córdoba defense is not yet viable. A six-person force with paid replacements and recovered long guns stalls through turn 81. Collecting matching finite cartridges does not resolve the stall. A coordinated ten-person force, including four additional paid hires, reaches Tucumán at hour 164 but also stalls with the ordinary controller. Its survivors remain prone near two defenders behind obstructed firing lines. An experimental controller that stands and advances on currently visible contacts ends in defeat at turn 5; it is not an accepted route or balance proof. No health, enemy strength or victory rule was changed. The last verified continuous checkpoint remains Córdoba defense. The next work must improve tactical approach and preserve recovery of the wounded doctor who routed to Buenos Aires; it must not treat this probe as completion.

## Fresh Tucumán victory

The continuous Retiro-only test now wins Tucumán and passes in 66.3 seconds, including deterministic tactical replays and campaign saves. Preparation hires the remaining affordable support soldiers, collects real long guns and matching cartridges at Córdoba, and rests all ten soldiers rather than checking only the active support squad. The battle controller uses legal shots down to 5% displayed chance when its ordinary 25% preference has no order; rounds and AP are still spent. This resolves the observed stall without changing combat rules. Earlier claims that the stall was solely obstructed firing lines were incomplete: fatigue and the controller's shot threshold also mattered.

The result is phase 2, hour 172, second 2384, with 1,061 pesos and 34 permanent deaths. One fit hire remains in Tucumán; the routed doctor remains critically wounded at 2 HP in Buenos Aires. This costly route does not establish balanced difficulty or a sustainable northern campaign. Doctor recovery, rebuilding the force, later sectors and the ending remain open.

## Fresh northern relief and named recruitment

The continuous fresh-start test now continues after Tucumán through recovery of the 2-HP doctor in Buenos Aires. A newly commissioned officer costs 300 pesos and uses a real dressing to stop bleeding. The officer physically approaches and recruits Paroissien and Dorrego through their normal dialogue requirements. Recruitment adds the campaign-issued unit at the NPC's position using the application's existing hydration behavior. Ordinary care brings the patient above the conscious threshold before his own eight dressings can be transferred; Dorrego contributes one further dressing. The patient reaches 67/67 HP at hour 185 with 761 pesos, while all 34 deaths persist. Campaign saves round-trip and the full fresh-route regression passes. This supplies actual relief and named recruits; reunion with the remaining northern soldier, subsequent sectors, Yatasto and the ending are still open.

## Fresh northern reunion and Azurduy

The continuous fresh-start regression now also rests and marches the relief party from Buenos Aires to Tucumán, renews the two paid survivors' contracts before expiry, and reunites all five operatives. The ordinary partisan-supply decision removes exactly 50 muskets. Dorrego then physically approaches and recruits Azurduy through the authored dialogue gate. All six soldiers are at Tucumán, all 34 deaths persist, and saves round-trip. The continuous test passes in 77.1 seconds. The resulting checkpoint is hour 217, second 359, with 1,244 pesos. A subsequent six-person Salta probe, using recovered firearms and matching finite ammunition, loses at turn 7. Salta, the northern agreement, Yatasto and the remaining campaign are still unverified from a fresh start.

## Fresh Salta victory

The continuous fresh-start route now stops at Córdoba for actual recruitment of Quiroga and Paz, marches the expanded relief force north and recruits Azurduy after the same finite musket delivery. Two squads rest together, collect actual weapons and typed cartridges, and coordinate their Salta arrival. Existing long guns are retained instead of being replaced during collection. The eight-person assault wins Salta, replays deterministically and returns through campaign saves. The continuous regression passes in 105.5 seconds.

The result is phase 2, hour 243, second 3122, with 1,819 pesos and 41 permanent deaths. Azurduy is the only surviving recruit. This is a costly playable continuation, not a balance acceptance. A separate saved-checkpoint probe completes the northern pact and recruits Güemes and Macacha; those steps are not yet part of the continuous test. Yatasto and the remaining campaign stay open.

## Fresh Yatasto and integrated verification

The continuous Retiro-only campaign now completes the northern pact with its actual 20 muskets, 10 horses and 10 powder cost, recruits Güemes and Macacha through physical dialogue, rests, travels to Tucumán and finishes all three Yatasto conversations. Saves between conversations preserve progression; the ordinary mission return reaches phase 3 at hour 268, second 440, with 2,188 pesos. All 41 deaths remain permanent. Azurduy, Güemes and Macacha survive; Azurduy still needs medical recovery. This establishes the fresh route through Yatasto, not the Cuyo phase or ending.

The integrated workspace passes **2,616/2,616 tests with no skips**, type checking and the production build. The 49 unrelated preservation files still match the original snapshot, excluding only the previously committed prisoner-panel lines in Battlefield. W10 remains partial for care, rebuilding, Cuyo, mountain passes, lost territory, the ending and overall balance.

## Fresh Cuyo staging and Córdoba defense

The continuous route now buys the post network, spends the actual remount for travel to Córdoba, purchases 15 dressings and recovers Azurduy to full health. Waiting for field care instead lets the route close; faster paid transport reaches Córdoba before that loss. Salta is genuinely retaken by the enemy and remains royalist. A paid one-day contract for Samuel Reed and matching purchased ammunition support the actual Córdoba counterattack. The defense wins with deterministic replay and saves, retaining Güemes' death and all prior losses. The continuous regression passes in 117.2 seconds. Its checkpoint is hour 294 with 599 pesos and three survivors: Azurduy, Macacha and Reed.

An immediate slow march to Mendoza loses. A separate saved-checkpoint probe using the purchased post network wins Mendoza at hour 298, second 731, with 849 pesos; Reed dies and the two northern women survive. That Mendoza continuation is not yet included in the continuous regression. Cuyo production, the mountain passes, lost territory and the ending remain open.

## Fresh Mendoza and first foundry production

The continuous fresh-start regression now wins Mendoza using the paid post approach, recruits Beltrán, pays the foundry's 500 pesos and 20 copper, proclaims emancipation and recruits Barcala. Its first cannon order consumes the normal recipe and completes at its actual due hour. Deterministic combat replay, returned equipment and full saves remain enforced. The continuous test passes in 125.9 seconds.

The checkpoint is phase 3, hour 333, second 825, with 430 pesos and one cannon. Macacha, Beltrán and Barcala remain in Mendoza. There are 44 permanent deaths: Reed dies at Mendoza and Azurduy later dies from her retained wounds in Córdoba during production. The route does not establish preservation of every survivor or acceptable balance. Further recovery, three-cannon and 3,000-infantry preparation, mountain passes, lost territory and the ending remain open.

## Fresh army production and squad capacity

The continuous fresh-start route now pays for Macacha's care to full health, three musket batches, uniforms, 200 infantry and a second cannon. The saved checkpoint reaches hour 397 with 839 pesos. Prior deaths remain permanent. Phase 3, the remaining army preparation, mountain passes, lost territory and the ending remain open.

Eight accumulated squad records previously blocked formation even when records were empty. Formation now replaces an empty record with no journey at the limit and assigns a new ID. Occupied squads and their routes remain intact. Regression checks cover a marching squad, save restoration and atomic rejection with eight occupied squads. A live import of the production checkpoint also formed Barcala's new squad while Macacha and Beltrán remained together.

Validation: 2,618 tests pass, including the continuous fresh campaign. Type checks, production build, diff checks and the 49-file unrelated-change preservation check pass.

## Full fresh army production and mountain approach

The continuous Retiro-only route now pays for Córdoba's three green militia, leaves Barcala there, forms a separate Mendoza squad and produces the full 3,000 infantry and three cannons through ordinary orders. Every recipe debit, elapsed production, permanent death and save roundtrip is retained. This continuous test passes in 145.7 seconds. The checkpoint is hour 1,142 with 8,495 pesos; Tucumán has fallen and remains royalist. The mountain passes, recovery of lost territory and ending are not complete.

A subsequent paid six-person Uspallata assault failed after three rounds. Inspection found newly issued cannons at the old map-template centre while the squad arrived at the eastern boundary. New pieces now enter through the first arriving squad's actual edge, using free connected ground within two cells of the boundary. This small entry area lets gun carriages and a full squad fit the narrow mountain road. Stationed pieces retain their exact saved position and ammunition. Five targeted checks cover all four approach edges on open fixture terrain, unchanged stationed guns and the actual full-size Uspallata road with six soldiers and three cannons. A valid full campaign/battle save imports, completes placement and visibly shows the battery beside the squad in the running game. This corrects arrival placement; it does not prove victory at Uspallata or artillery transport capacity.

The capture/rescue regression now advances to the map's authored central rally point before holding fire. This replaces its old assumption that a newly issued gun already stood there. Real enemy wounds, deaths, prisoners, paid relief, finite ammunition, recovered artillery and save checks still pass. The live arrival also restores all three guns after reload.

Final integrated verification: 2,623 tests pass with no skips. Type checking, the production build and diff checks pass. All 49 unrelated files in the preservation snapshot remain unchanged. Two six-person Uspallata probes still lose after the arrival correction; this is an open route problem, not a claimed victory.

## Fresh Uspallata victory and recovery

The continuous Retiro-only route now wins Uspallata with two explicitly coordinated squads and eight soldiers. It funds six daily contracts, manufactures finite ammunition, buys Leiva a Charleville, waits for daytime arrival and retains normal travel fatigue. The victory at hour 1,332 has five new deaths: Blackwood, Harcourt, Pembroke, Farías and Leiva. Macacha and Arnaud survive at 3 HP.

Barcala recovers two actual dressings from Pembroke's corpse. Two hours of care stop both survivors' bleeding; Arnaud remains alive at 2 HP. Beltrán buys twenty dressings in Mendoza and reaches Uspallata through the paid post network. Macacha resumes medical work when stable. Paid contract renewals retain Arnaud, and the four survivors return to Mendoza for the remaining purchased care. All four finish at full health, without bleeding, at hour 1,390 with 603 pesos. Uspallata is fortified; its three stationed cannons remain physical equipment. The route retains 49 permanent deaths, lost northern territory and phase 3.

The extended continuous test passes in 153.6 seconds. Runtime code is unchanged in this step; the preceding full suite passed 2,623 tests. This costly route remains distinct from a general balance claim. Los Patos, subsequent phase progression, lost territory, the ending and other partial audit requirements remain open.

A separate eight-person Los Patos probe waits for paid replacement weapons to restock, then uses explicit two-squad travel and actual combat. It loses at hour 1,912. That failed continuation is not included as a victory or used to advance the campaign phase.


## Los Patos and San Martín recruitment

The continuous fresh-start route now approaches Los Patos through Uspallata with eight paid, equipped soldiers. The victory retains five further deaths (Barcala, Macacha, Montiel, Montreuil and Roldán), for 54 permanent deaths. Fortification advances the campaign to phase 4. Valcourt receives purchased medical care in Mendoza, then physically meets and recruits San Martín through the normal dialogue. Arnaud and Beaumont leave service alive when their contracts expire; their location depends on whether expiry precedes departure. Save round trips retain the result. No battle victory, health, money or territory is injected.

An independent ending-rule fixture exposed a defect: recruitment alone allowed victory after San Martín died. His death before completion now ends the campaign in defeat and prevents further orders. A living wounded commander can still finish without free healing. These ending fixtures test rules only; they do not establish a fresh-start ending. Coastal conquest, northern recovery, enemy forces and the actual ending remain open, as does overall balance.

Validation: all 2,625 tests pass with no skips, including the continuous fresh-start route. Type checking, production build and diff checks pass. A controlled death mutation of a valid phase-4 checkpoint retains defeat after save reload. All 49 unrelated preservation files remain unchanged. W10 remains partial.


## Coastal campaign checkpoint

The phase-4 survivors return to Retiro using paid post travel. A paid renewal retains Valcourt, and San Martín physically recruits Cabral. The continuous fresh-start regression through this step passes in 178.3 seconds.

Separate continuation probes from that real checkpoint establish an Ensenada victory after banking ordinary income, buying three Charlevilles from finite shop stock and hiring Arnaud, Valcourt and Beaumont for a day. The six-person force wins at hour 2,502 with 12,490 pesos. Cabral and Valcourt die; the campaign retains 56 permanent deaths. San Martín survives with 68 HP and no bleeding. Two earlier probes with five soldiers lose, including one with a cannon whose crew advances away from it. Those losses are separate alternatives, not claimed victories or part of the successful route.

Two paid import orders for supplies and materials raise foreign reputation to 30. Brown and Bouchard then join through physical dialogue; both purchases remain timed shipments. The validated naval checkpoint is hour 2,503, with 12,150 pesos and six living squad members. It is not a campaign ending. Santa Fe and four northern sectors remain to be liberated. The complete Retiro-to-port regression now passes in 320.0 seconds, including both naval recruits and saved state. No runtime code changed in this checkpoint; the preceding integrated suite remains 2,625 passing tests. Diff checks and all 49 unrelated-file preservation checks pass. W10 remains partial.

A subsequent branch pays for survivor renewals, post travel to Retiro, dressings, complete commander recovery and two further Charlevilles, waiting for actual shop stock. It reaches San Nicolás. Two Santa Fe assaults lose: the first has no reserve musket ammunition, while the second purchases sixty .69-calibre rounds before departure and still loses. Neither branch extends the successful campaign proof. The supplied staging save remains a starting point for further tactical investigation.


## Santa Fe approach and civilian climbing fix

A queued paid post approach from San Nicolás reaches Santa Fe in daylight and wins at hour 2,532. Beltrán, Arnaud, Beaumont and Brown die; San Martín and Bouchard survive. The route retains 60 permanent deaths and a new naval blockade at Buenos Aires. A fully rested dawn alternative loses, so this result does not prove general balance or a robust strategy. The continuous regression now includes the paid care, finite rifle restock, ammunition purchase, queued approach and battle.

A separate continuation takes the survivors to Córdoba because the naval group blocks the road to Retiro. Purchased dressings and rest restore Bouchard. A purchased bronze cannon, physically dragged by its crew, and normal rifle fire then recapture Tucumán from the four occupying soldiers. The first successful tactical result could not be saved: repeated civilian roof movement spent a resident's final energy point without changing the awake flag. Civilians now spend a phase recovering ten energy before a climb would exhaust them, using the existing energy cap. Insufficient movement budget cannot grant this recovery. Thirty-five focused movement, civilian and escort checks pass, including ascent/descent boundaries and saved continuation.

After the correction, the actual Tucumán battery result replays and saves successfully at hour 2,554, with 5,357 pesos and both survivors alive. The local resident remains awake at ten energy. This separate continuation is not yet part of the continuous fresh-start test. The remaining northern sectors, naval blockade, actual ending and broader audit requirements are still open.

Integrated verification after the civilian fix: **2,626/2,626 tests pass with no skips**, including the continuous Santa Fe victory and exact casualties. Type checking, production build and diff checks pass. All 49 unrelated preservation files remain unchanged. W10 and the broader gameplay audit remain partial.


## Continuous northern return

The purchased-care and cannon-assisted Tucumán recapture now have reusable route helpers. From the actual Santa Fe checkpoint, they restore Bouchard in Córdoba, buy sixty matching musket rounds, rest the survivors, buy one bronze cannon and use a queued paid post approach. The battery uses normal movement, visible targets, finite charges, crew AP and personal weapons. The helper check replays and saves at hour 2,554 with 5,357 pesos and both survivors alive; all 60 earlier deaths remain. The complete fresh-start extension now passes in 234.7 seconds, including deterministic battle replay, campaign return and saved state. No runtime code changed in this checkpoint; the preceding full suite remains 2,626 passing tests.

Further Salta probes remain unsuccessful. Paid recovery, three finite-stock reserve cannons and a single selected field piece do not suffice in the tested approach. A medical-priority/crouched variant and two separately purchased one-person swivel guns also lose. Returning to the saved pre-Santa Fe force and adding a cannon from Córdoba leaves a stalled battle after its scouts are lost; it is not a victory. These alternatives are separate branches and do not extend the verified campaign. The route still needs a viable Salta assault, Jujuy, Humahuaca and removal of the Buenos Aires naval blockade before an ending can be tested.


## Strategic militia medical care

Local hired doctors can now take a separate militia assignment and treat retained garrison wounds with finite personal supplies. Hourly triage, sleep, training custody, saved stops, paid resupply and real reentry are covered by ten new simulation/render checks. The live interface verified 20→26 health, save continuation, kit exhaustion, a 150-peso resupply and full recovery with a completed-care notice. See [militia medical care](../gameplay/characters/militia-medical-care.md) for rates, restrictions and exact verification scope. The integrated suite passed 2,633 tests; the final 39-check care run also covers the later three added cases and completion-text correction. Type checking and the build pass. Tactical militia commands and the other open audit requirements remain unfinished.


## City militia distribution

The original manual's town redistribution choice now has manual rank/quantity transfers and an automatic distribution preview in the Sector panel. Exact defenders keep their wounds, experience and finite equipment; critical patients and training cohorts remain in place. Transfers obey connected city ownership, encounter restrictions and capacity. Thirteen new simulation/render checks cover custody, real sector reentry, paid count-only cohorts and stable balancing. The live interface moved a wounded veteran, retained the transfer after reload, balanced twelve defenders across three sectors and rejected an excessive quantity. See [city distribution](../gameplay/campaign/militia-distribution.md). Tactical commands and the remaining gameplay audit are still open.

Integrated verification: **2,649/2,649 tests pass with no skips**, including the continuous fresh campaign through Tucumán recapture. The final 30-check focused run covers the last UI refinements; type checking, the production build, diff checks and the 49-file preservation check pass. This does not close the remaining campaign ending or audit gaps.


## Continuous Salta recapture

The continuous Retiro-only regression now recaptures Salta after the Tucumán return. Real paid care in Córdoba restores Bouchard; three finite-stock cannon purchases, ordinary rest and queued post travel lead to a 02:00 assault. The test controller prioritizes medical aid, crouches after contact and keeps the crew at its gun instead of chasing targets. It uses shared visible targets, legal orders, finite ammunition and normal AP costs. No combat rules or enemy strength changed.

The full fresh-start test passes in 241.1 seconds, including deterministic battle replay, campaign return and complete save validation. Salta falls at hour 2,642 with 4,792 pesos. San Martín survives at 88 HP; Bouchard dies, leaving 61 permanent deaths and only San Martín alive. This proves this costly continuation, not balanced difficulty or the complete campaign. Jujuy, Humahuaca, the Buenos Aires naval blockade and a new fourteen-soldier force marching toward Tucumán remain to be resolved before the ending can be verified.

Validation for this tests-only extension: the complete continuous-route test passes with no skips, the diff check passes, and all 49 unrelated preservation files remain unchanged. The prior full-suite result remains 2,649 passing tests; it was not rerun for this extension. The broader JA2 audit remains open.


## Northern continuation and empty artillery choice

A separate continuation from the verified Salta save cannot start Jujuy without new powder. An ordinary Córdoba powder order, rest and a queued night post approach reach Jujuy at hour 2,668, where the new fourteen-soldier northern column defeats San Martín in two turns. This is a failed probe, not a continuous-route extension or a proved campaign dead end. A supported continuation still needs to be established.

The probe exposed a real artillery choice defect: explicitly preparing three “Sin pieza” slots still selected reserve guns automatically. The campaign now records an explicit selection so an empty choice leaves purchased guns in reserve, including after reload. Older saves keep their automatic default, and a later chosen gun can deploy normally. Two new checks cover actual assault entry, retained stock, full campaign/battle saves, re-selection and invalid saved values.

Validation: the integrated run passed 2,650 of 2,651 tests, including the continuous campaign. Its sole failure was the new test attempting an active campaign save without the battle. That test now saves both; both final focused checks pass. Type checking, the production build and diff checks pass. The complete suite was not repeated after this test-only correction. All 49 unrelated preservation files remain unchanged. The campaign ending and broader audit remain open.


## In progress: legal artillery crew posture

Current uncommitted work rejects prone operators and helpers for cannon fire, reload, pivot and movement. The shared preview explains standing/crouching, and autonomous gunners pay the normal stance cost before handling a gun. Twenty-six focused simulation, AI and rendered-control checks pass. Rejected actions retain physical state and AP; standing/crouched operation remains available.

This correction exposes a dependency in the previous campaign evidence: the integrated route retreats at Uspallata under the stricter crew rule. The full run passed 2,653 of 2,654 tests; the sole failure was that campaign battle. A subsequent legal crouch-preparation AI change passes focused checks, but the saved Uspallata approach still loses. A controller prioritizing nearby gun work and a later 22:00 approach also lose. These probes retain real costs and losses. They are not campaign extensions. The earlier Salta completion evidence remains historical and is not proof that the current uncommitted rules can reproduce that route.

Do not commit this work as a completed integration or weaken the victory assertion. Establish a viable approach with legal crew actions and retain resulting casualties through the remaining route, then rerun the full integration. Unrelated tactical changes were checked against the pre-edit file, and all 49 preservation files match.


### Uspallata reinforcement findings

Further probes retain the saved army, paid recruitment and normal travel. Holding positions after contact still loses. A twelve-person force funded by ordinary income to 18,000 pesos reaches the assault at hour 1,572, but `enterSector` throws because the eastern boundary cannot place all soldiers. A nine-person force with an additional paid doctor also exceeds the entrance at hour 1,332. Replacing Farías with Roldán keeps the force at eight and fits, but the legal gun-priority controller loses in ten turns. No result extends the campaign.

The next implementation dependency is crowded arrival handling: `beginAssault` currently commits the deployment before tactical entry discovers that the boundary is full. Preserve real entry edges, collision rules, supplies and staged squad custody. A full entrance must not strand the campaign in a pending battle that cannot open. The wider W02 requirement for later arrivals remains unfinished; do not hide this by expanding test maps or reducing requested squad sizes. After implementing safe staging/entry behavior, resume a supported Uspallata approach and verify the full campaign.


### Legal mountain battery continuation

A one-gun approach now wins Uspallata under the pending stance correction. Barcala and Paroissien advance their selected bronze cannon while infantry screens them; crew orders use legal previews, paid AP, shared visibility and standing/crouched handling. The actual battle at hour 1,332 ends in victory after twelve turns with six survivors. Pembroke and Farías die. Barcala, Paroissien, Arnaud, Blackwood, Harcourt and Leiva remain alive. Deterministic replay and complete campaign/battle saves pass.

Two initial hours of carried medical care stop Harcourt's bleeding. The survivors travel to Mendoza, buy twenty kits for Beltrán, and use two supplied doctors to recover fully. Wounded contracts are renewed; healthy expired hires remain alive. Recovery ends at hour 1,354 with 810 pesos. The continuous fresh-start test reproduces this recovery and reaches Los Patos, where its old infantry controller loses.

A separate continuation with the same mountain battery controller wins Los Patos at hour 1,914 in nine turns. Barcala, Paroissien, Arnaud, Beaumont and Roldán survive; Montiel, Montreuil and Valcourt die. Replay and saves pass. After fortification, the survivors return to Mendoza. Paroissien's 89 leadership meets San Martín's actual recruitment threshold; dialogue recruits him at hour 1,920, phase 4, with 6,188 pesos. These later successful helpers are now incorporated, but the full route has not yet been rerun with them. The coastal helper still assumes Valcourt is alive and must be updated to the actual surviving force. The earlier Salta-ending continuous proof remains historical until the revised full route passes. No casualties or victories were injected.


### Coastal continuation with the surviving mountain force

The revised coastal command brings Beltrán, Barcala, Paroissien and San Martín from Mendoza to Retiro through normal paid travel, then recruits Cabral through dialogue. Valcourt remains dead. A six-person Ensenada approach and an eight-person coordinated approach lose. Paid recruitment of the three additional living veterans, including Roldán, provides an eleven-person force. The daylight coordinated assault uses the mountain battery controller and wins at hour 2,334 in eighteen turns. Beltrán, Cabral, Arnaud and Blackwood die; Barcala, Paroissien, San Martín, Harcourt, Beaumont, Leiva and Roldán survive. Replay and complete saves pass.

Normal paid imports satisfy the foreign-standing requirement. Selecting San Martín's actual squad allows the dialogue visit to recruit Brown and Bouchard. The resulting force has nine living members in service. A separate fourteen-hour recovery uses Paroissien and Roldán's carried kits, renews Harcourt and Roldán as needed, and restores San Martín and Harcourt fully at hour 2,348 with 4,960 pesos. Beaumont and Leiva's healthy contracts expire; they remain alive. The recovery helper is now included in the continuous test.

The continuous new-game run reproduces the new mountain route, Ensenada victory and naval recruitment. It stops after 243.2 seconds when the old Santa Fe helper attempts to renew dead Arnaud. That rejection is correct. The helper must be rewritten for living personnel, including replacing dead Beltrán as doctor. The separate recovery probe passes; its insertion occurred after that full run started, so it is not yet part of a completed continuous-run result. No current full-suite pass or completed campaign is claimed. Artillery-posture and revised-route work remain uncommitted pending integration.


### Naval blockade cleared on the revised route

The supplied force returns to Retiro through concurrent queued travel. Ordinary income funds new daily support contracts, two purchased muskets for Brown and Bouchard, a bronze cannon, medical kits and ammunition. The renewed blockade occupies the road to San Nicolás, so Santa Fe cannot be reached first. A daylight nine-person Buenos Aires assault with the earlier controller loses.

Revised coastal orders keep San Martín behind the gun and use actual crouched firing previews when a rifleman otherwise stalls on a prone-stance preference. The actual blockade battle wins at hour 3,078 after eleven turns. San Martín, Barcala and Brown survive at full health; Paroissien, Bouchard, Harcourt, Beaumont, Leiva and Roldán die. Deterministic replay and complete saves pass. The resulting campaign confirms `blockade:false`, 9,011 pesos and the three survivors in service. Four-soldier occupation groups remain in Tucumán and Salta. The preparation and battle are now in the continuous test, but that extended test has not yet been rerun.

A three-person Santa Fe continuation buys a new cannon and medical supplies, rests and uses existing finite musket reserves. It reaches the actual battle at hour 3,102 and loses. The old helper's attempts to use dead Arnaud and Beltrán have been removed; current preparation uses only living soldiers. A viable Santa Fe approach and the remaining northern route are still required. The actual victory assertion remains in place. No full integration pass or campaign completion is claimed; the broader pending changes remain uncommitted.


### Santa Fe and Tucumán with three living soldiers

The Santa Fe diagnostic showed Brown running ten tiles ahead of the gun, triggering combat, followed by Barcala leaving the crew. The cannon never fired in that failed attempt. Keeping Brown with the battery during approach and preventing the crew from chasing targets after contact wins Santa Fe at hour 3,102. Barcala, San Martín and Brown survive at 31, 44 and 85 HP. The fourteen-turn result replays and saves successfully.

Paid care in Córdoba uses Brown as doctor, patients Barcala and San Martín, a purchased refill when kits run out, then normal weapon repairs, provisions, rest and a new cannon. A daylight Tucumán victory kills San Martín and is therefore unusable for campaign continuation. Waiting at the staged boundary until 22:00 instead wins Tucumán at hour 3,166 with all three at full health. Replay, complete saves and explicit live-commander/non-defeated checks pass. The continuous route helpers now retain these results and no longer refer to dead Bouchard.

A subsequent paid cannon and medical-supply preparation reaches Salta at hour 3,190 with the same three soldiers. Its first night assault loses; allowing Brown a late scout after several cannon rounds does not change the outcome. Salta remains the next tactical problem. The extended continuous route and full suite have not yet been rerun; the victory assertion and checks that prior deaths persist remain intact.


### Salta close-contact diagnosis

A fresh diagnostic from the saved night Tucumán victory reproduces Salta at hour 3,190. At turn three the loaded cannon is at (40,27), with five reserve rounds. Barcala and San Martín form a valid paid crew. A visible, able enemy is at (42,27), within 2.5 tiles of both operators. The artillery planner deliberately returns no gun order at that distance. This is a close-contact response problem, not missing ammunition or an invalid crew.

Allowing the existing infantry controller at close contact still loses. A separate probe instead uses legal reachable cells costing at most 20 AP to move away from visible close threats. That probe wins the tactical battle after twenty turns with Barcala and Brown alive, but San Martín dies. It therefore does not prove a valid campaign continuation and was not installed in the continuous test. The next approach must keep the commander out of the exposed crew position while preserving enough personnel to operate the cannon. Full-route assertions remain unchanged.


### Commander preservation and route acceptance

Assigning Brown to the Salta gun while keeping San Martín behind it does not yet produce a valid continuation. One approach stalls at terrain; moving the helper to the east side allows more progress but the force loses. These are diagnostic controllers only and are not installed in the fresh-route test.

The shared route helper now rejects a nominal tactical victory when campaign settlement sets `defeated`. This closes a verification gap outside San Lorenzo: owning the captured sector alone does not prove that the campaign can continue. Replaying the known daylight Tucumán result confirms that the new assertion rejects its terminal commander loss. The 26 focused artillery checks and type checking pass. A full fresh-route run is active; no new integrated pass is claimed.


### Salta recapture with a one-person gun

Replacing the newly purchased bronze cannon with a purchased swivel gun removes the need to expose San Martín as the second operator. The unchanged three-person controller wins Salta at hour 3,190 in ten turns and 77 actions. Barcala, San Martín and Brown all retain full health (85, 88 and 85). Six actual shots and reloads consume finite ammunition. Deterministic replay, complete saves, live-commander checks and all prior deaths pass. The Salta preparation helper now buys and explicitly selects the swivel.

The resulting valid save has 9,571 pesos, no active enemy groups and only Jujuy and Humahuaca under royalist control. It is not a completed campaign. A paid return to Córdoba buys the next swivel because Salta has no supplied workshop. The subsequent staged Jujuy assault at hour 3,216 loses after 54 turns; its victory assertion correctly fails. This separate continuation is not integrated as a passing test. The full fresh-start run started before the Salta equipment change and is still pending; its result must not be attributed to the new helper.


### Dawn Jujuy continuation

The full fresh-start run with the previous Salta cannon completes the combined blockade, Santa Fe and night Tucumán route, then fails Salta after 290 seconds. A new run with the swivel correction is active. It started before the Jujuy extension below was added.

A separate dawn Jujuy assault at hour 3,222 wins in fifteen turns and 66 actions using a purchased swivel and the existing three-person controller. Barcala survives at 29 HP with no bleeding; San Martín and Brown retain full health. Replay, campaign settlement and saves pass. The helper and Jujuy victory/survivor/permanent-death assertions are now part of the continuous route. Night swivel and night bronze approaches both lost.

The subsequent Humahuaca preparation remains incomplete. Returning to Córdoba permits paid healing and a gun purchase, but during the long trip and care Jujuy is occupied again. The normal travel and adjacent-assault checks correctly reject advancing through the hostile sector. This exposes a strategic preparation requirement: carry the next gun and sufficient treatment supplies before taking Jujuy, or defend and recapture it through actual gameplay. No ownership or arrival state was overridden.


### Continuous Salta verification and northern reserve experiments

The complete Retiro-only route through Salta recapture passes in 296.5 seconds with the pending artillery-posture correction and revised helpers. This run includes the shared nonterminal-victory assertion. It started before Jujuy was added, so it proves the route through Salta, not Jujuy or the ending.

A second swivel can be purchased only after actual merchant restocking. With that reserve, dawn Jujuy still wins, but a sixteen-soldier force reaches the sector during local healing/rest. The actual defense loses. Immediate departure with the reserve also loses against that force at Humahuaca. Buying a field cannon without waiting keeps the earlier departure, but its three-person crew loses at Humahuaca. These experiments remain outside the route helpers.

A separate dawn Jujuy approach buys both a bronze cannon and a spare swivel, deploying only the bronze. It wins at hour 3,222 with San Martín and Brown alive, but Barcala dies. Replay and saves pass. A two-person continuation is being tested; it does not restore Barcala or change the established all-three-survivor Jujuy helper without further evidence.


### Integrated artillery posture and Jujuy checkpoint

The current full suite passes **2,656/2,656 tests with no skips** in 334.2 seconds. It includes the complete Retiro-only route through the revised mountain and coastal battles, Salta recapture with a swivel, and dawn Jujuy with all three remaining soldiers alive. Every route battle uses actual tactical orders, deterministic replay, complete saves and permanent-casualty checks. Nominal tactical victories that terminate the campaign are rejected. Type checking, the production build and diff checks also pass.

All 49 unrelated files in the preservation snapshot match. Removing only the two new posture changes from the mixed tactical file reproduces its prior working contents exactly; the separate boleadoras changes are excluded from this commit.

This checkpoint does not complete Humahuaca, the ending, or the remaining parity audit. The alternate two-person Humahuaca continuation loses once Brown is legally moved to the gun. Failed reserve-gun and defense probes remain outside the accepted route.


### Artillery transport gap confirmed

The W09 transport gap is present in the current code. `prepareSectorArtillery` permanently issues reserve stock and reuses saved guns only at their existing site. `deployedArtillery` creates reserve pieces with a full load and six rounds. No campaign action recovers a deployed piece for another sector. Merely increasing reserve stock on recovery would create ammunition and discard partial loading.

Any transport implementation must preserve the exact gun identity, model, loaded state, reserve rounds and reload progress; remove the source exactly once; account for travel time and transport capacity; handle interrupted travel and hostile ownership; and validate those records through saves and deployment reports. The armory must expose a preview with rejection reasons. This is an open requirement, not an implemented feature or a change to the proven campaign route. W10 now reflects the integrated Jujuy checkpoint rather than the obsolete one-survivor Salta route.


### Deployed artillery transport implementation

A new convoy action and armory controls move the exact deployed gun to a local destination depot. Identity, load, finite reserve rounds and unfinished reload work survive arrival and later deployment. It requires a secured source, local crew, an organized cart or flotilla route, and capacity. Cut routes delay delivery through the existing convoy clock. Save validation rejects duplicate custody, invalid gun state and overweight shipments. Generic cannon resources remain separate.

Four new transport cases and three panel cases pass, as do the 34 related logistics/equipment/save checks, 23 existing artillery checks, type checking and the production build. A live imported subsystem fixture verifies selection, dispatch, reload/resume, eighteen-hour arrival and the retained two rounds/40% partial load after the squad arrives. Actual redeployment is covered by the automated test. The full integration run is active; the feature is uncommitted pending that result. See [artillery transport](../gameplay/campaign/artillery-transport.md) for adaptations and remaining scope.


### Artillery transport integrated verification

The full suite passes **2,661/2,661 tests with no skips** in 336.3 seconds. The continuous route through Jujuy remains valid. Final focused transport/render checks, type checking, production build and diff checks pass. All 49 unrelated snapshot files remain unchanged. The transport implementation and its exact live/automated boundaries are documented in [artillery transport](../gameplay/campaign/artillery-transport.md).

The next campaign continuation still needs Humahuaca and the ending. The verified Jujuy save has exactly three living roster members (Brown, Barcala and San Martín), all without equipped outfits; reserve uniforms and ponchos are zero. Future preparation must use actual procurement and equipment capacity rather than presume spare troops or protection.

### Humahuaca continuation and renewed blockade

Buying a bronze reserve alongside the Jujuy swivel avoids waiting for a second swivel to restock. Jujuy retains all three survivors at hour 3,222. Immediate Humahuaca deployment at hour 3,228 wins in ten turns and 34 actions. The controller lets Brown approach the two-person gun after combat begins; gathering all three around it during exploration instead obstructed the advance. Barcala retains 29 HP, San Martín 88 and Brown 85. Actual orders, deterministic replay, campaign settlement and complete saves pass in the separate continuation. The fresh-route helper now includes this purchase and battle; the integrated Retiro-only run passes in 304.1 seconds with no skips.

Humahuaca does not yet finish the campaign. All sectors are patriot-owned, but a new sixteen-person coastal force has established a Buenos Aires blockade at hour 3,200. A paid return through Córdoba, medical care and a new bronze purchase reaches Buenos Aires at hour 3,292. That controller stalls at the turn limit with the three soldiers alive and the enemy force intact. It is diagnostic evidence only. No terminal victory or balance correction is claimed.

### Buenos Aires controller diagnosis

The stalled western approach selected the first stored gun at (31,5), although the newly issued piece was beside the arriving squad at (1,23). Prioritizing the deployed piece advances to (4,23), where a building corner separates San Martín from the gun under the existing contact rules. A legal path around the building restores the crew; changing game collision rules is unnecessary. These corrections are diagnostic controllers in temporary files, not gameplay changes.

The corrected pre-dawn bronze approach loses. A dawn western swivel approach also loses. A northern route through San Nicolás with bronze artillery defeats ten of sixteen enemies but loses Barcala and Brown; the remaining commander cannot operate that gun. Allowing normal infantry orders after crew loss ends in defeat. Northern swivel and heavy-gun attempts lose; two purchased swivels after actual restocking produce a tactical retreat at hour 3,318. None is accepted as a campaign continuation. The known Humahuaca save remains intact.

Brown's temporary relief controller also suppresses nearby medical orders while holding beside the gun. Giving first aid priority keeps Brown alive at 25 HP alongside an unharmed San Martín, but Barcala dies and the controller reaches its turn limit with six enemies still active. A replacement-crew controller exposes two invalid orders for a knocked-down soldier: moving and then crouching. Giving the normal stand-up recovery order priority removes those errors, but that run still reaches the turn limit with San Martín at 20 HP, Brown at 85 HP and thirteen enemies alive. No tested final-blockade continuation has passed. This is a test-controller issue and does not establish a missing player medical action or justify combat balance changes.

### Reproduced late-campaign save-size failure

The legally staged final northern approach exposes an independent gameplay defect before combat: `encodeSave(campaign, enterSector(...))` rejects the full save at **5,035,492 UTF-8 bytes**, above the existing 5,000,000-byte limit. Campaign data occupies 4,641,319 bytes; its retained sector states occupy 4,235,564 bytes. The active battle adds 394,080 bytes. The failed attack probes did not establish a saveable final battle. The reproduction is retained at `/tmp/granaderos-final-blockade-north-oversize-raw.json`; it is raw diagnostic data, not an accepted importable save.

This must be fixed before accepting an ending route. Prefer lossless compact storage of repeated terrain data while retaining all sector changes, casualties, gear, active battle state and the existing input-size protection. Verify exact round trips, older saves, malformed compact input, independent restored maps and a real late-campaign reload. Merely increasing the limit again would not address browser storage pressure or repeated map data.

### Compact terrain saves implemented

Large portable/browser saves now store repeated terrain through a lossless palette. Small saves retain schema 1; the loader accepts both versions and preserves the original version markers for legacy migration. The file limit remains 5 MB, with a separate checked 20 MB expansion budget. The reproduced final-battle save falls from 5,035,492 to 1,581,968 bytes and restores exactly. The focused save checks and legacy migrations pass. Live import, automatic save, reload/resume and a further saved posture change pass in the isolated QA slot. See [compact saves](../development/compact-saves.md).

The first full run exposed four legacy compatibility failures and is not a passing checkpoint. The corrected full suite passes **2,664/2,664 tests with no skips** in 356.5 seconds, including the continuous fresh-start route through Humahuaca. Final type checking, production build and diff checks pass. All 49 unrelated snapshot files remain unchanged. No final-blockade victory is claimed.


### Stored artillery sale and repurchase

The final-blockade experiments remain unsuccessful. A fresh inspection confirms that all 48 paid recruits are dead in the accepted Humahuaca checkpoint, so rehiring cannot strengthen that particular route. This does not establish that the campaign is unwinnable.

Exact depot artillery now transfers to finite local merchant stock when sold and returns with its identity, ammunition and unfinished loading when repurchased. Guards reject remote, hostile, unavailable and unaffordable transactions. Save validation prevents duplicate merchant/depot/deployed/convoy custody. The armory exposes prices, retained load and refusal reasons. Twenty-one focused trade, transport, merchant and render checks pass. Type checking and production build pass. A live isolated QA sale/reload/repurchase also passes. The full suite passes 2,669/2,669 tests with no skips in 355.6 seconds, including the continuous route through Humahuaca. The subsequently added loaded-stock refresh/capacity case passes in the final 21-test focused run. All 51 pre-existing changed files retain their original contents. See [artillery trading](../gameplay/campaign/artillery-trade.md) for limits; broader trading and campaign completion remain open.


### Undeployed and emplaced artillery resale

The sale interface now includes actual undeployed camp/local depot stock and friendly guns emplaced at the current workshop. Stock allocation shares the deployment calculation, consumes one correct source count, rejects stale quantity receipts and assigns a unique merchant identity. A field handover needs the model's full local crew and removes the exact piece from the saved battlefield; ammunition and partial loading remain intact. Repurchase restores one local depot record rather than a fresh generic cannon.

Thirty-three focused trade/source/transport/merchant/render checks and type checking pass. A live isolated Córdoba fixture passed both sales, reload and exact eight-pounder repurchase with one round and 60% loading retained. This fixture uses scripted settlement to isolate the interface; campaign balance and the final blockade remain unproven. The full suite passes 2,676/2,676 tests with no skips in 354.2 seconds, including the continuous route through Humahuaca. The production build and diff checks pass. All 51 pre-existing changed files remain unchanged.


### Atomic workshop exchanges

A two-sided armory proposal now transfers offered and purchased equipment together and settles only the net cash difference. This covers stored/used handheld weapons, local new catalog goods and existing artillery sale sources. Stale receipts, funds, capacities, ownership and gun crew are checked before any committed transfer. Imports and consumable/service controls remain separate. Thirty-three focused transaction, save and render checks pass; see [merchant exchange](../gameplay/equipment/merchant-exchange.md).

A live zero-cash QA fixture passed draft cancellation, two-carbines-for-one exchange and reload with both cash balances unchanged at zero. Exact player/shop counts reversed from two/one to one/two. The full suite passes 2,686/2,686 tests with no skips in 350.2 seconds, including the continuous route through Humahuaca. The final UI price readout passes its focused render checks, type checking, production build and live inspection. All 51 pre-existing changed files remain unchanged. The campaign ending and broader audit remain incomplete.


### Local workshop preferences

Retiro remains a general buyer, Caroya now prefers cavalry equipment and refuses handheld host weapons below 25% condition, and El Plumerillo pays more for artillery. These are explicitly documented Granaderos adaptations. All direct sales and combined exchanges use the same local valuation and acceptance, while exact item metadata, finite cash and used-purchase prices remain intact. Six simulation/save cases and two render cases join a passing 59-test focused run.

Live QA passed the Caroya 90-peso cavalry sale, damaged-weapon refusal in both interfaces, reload, a normal twelve-hour march to Mendoza, and sale of that same 20%-condition weapon for 14 pesos at El Plumerillo. The build and type checking pass. The full suite passes **2,694/2,694 tests**, with no failures or skips, in 355.8 seconds. Final diff checks pass; all 51 unrelated snapshot files remain unchanged. The ending and broader gameplay audit remain open; see [workshop preferences](../gameplay/equipment/merchant-preferences.md).

### Finite enemy command reserves

Northern, coastal and interior attacks now consume separate persistent troop reserves. Exhaustion prevents further dispatch without removing existing enemies or refunding casualties. New saves retain the balances; older saves debit retained groups once. See [enemy reserves](../gameplay/campaign/enemy-reserves.md) for tuning, migration limits and remaining strategic work.

The first full run passed 2,697 of 2,699 cases. Two test-fixture issues were corrected: resolved-history trimming happens at launch, and the 1,050-body legacy save-size fixture needs explicit test-only reserve replenishment. All eight reserve/save-size regression cases now pass. Type checking and production build pass. Both accepted late-campaign checkpoints round-trip with the new reserves, preserving their occupying forces and incomplete campaign state; reserve totals remain outside the player-known projection. The corrected full suite passes **2,699/2,699 tests**, with no failures or skips, in 346.3 seconds. All 51 unrelated snapshot files remain unchanged. This does not establish the ending or complete the strategic audit.


### Observed enemy intelligence

Front reports and the player-known state now require fit local scouts, nearby militia, or actual contact. Old sightings retain their last sector, count and time without revealing hidden movement, casualties or arrival schedules. Stationed forces and undefended occupation notices show presence without a troop count. See [enemy intelligence](../gameplay/campaign/enemy-intelligence.md) for source, adaptations, save rules and remaining scope.

Forty-six related simulation/save/projection/render checks pass, followed by the final explicit-field/render checks. Type checking and the production build pass. Live QA verified current observation, stale report aging, reload, actual occupation, and the normal paused defense choices when militia remain. Review also corrected direct-travel scouting at the departure sector and excluded deployed soldiers; nineteen intelligence/projection checks pass with that correction. The first full run passed 2,705 of 2,707 cases; two narrative tests still expected the removed private-order announcements. Those checks now verify the real army command and non-disclosure instead. Review also removed target/activity predictions from the journal while retaining historical commander reference material, verified in the browser. The final 30-test focused run passes. The next full run passed 2,710/2,710 tests with no skips in 355.2 seconds. It started before a subsequent militia scouting correction, which excludes deployed records while admitting new count-only paid cohorts; all thirteen affected intelligence/render cases pass. The final current-code run passes **2,710/2,710 tests**, with no failures or skips, in 358.7 seconds. Final type checking, production build and diff checks pass; all 51 unrelated snapshot files remain unchanged. The ending and broader strategy remain incomplete.


The open T05 interface check also passed in a controlled full-save fixture: Cabral spent 3 AP to crouch during a real interrupt, reload retained the 66/69/69 player budgets, and Continue Enemy Turn returned to player turn two with the same six-second clock and no forced player shot. See [the live record](ja2-live-verification.md#interactive-interrupt-action-and-saved-continuation--21-september-2026). Broader interrupt qualification remains T06.


### Nested interruption persistence

A new full-campaign regression verifies saving at both levels of a nested interruption and exact continuation against the unsaved battle. All fourteen interrupt tests pass. Live QA restored the deepest window after reload, returned to the parent window, and resumed player turn one with unchanged player AP and six elapsed seconds. See [live evidence](ja2-live-verification.md#nested-interrupt-save-and-return-windows--21-september-2026). This test/documentation change does not alter runtime behavior. Hearing-only and door-triggered live checks, the broader parity audit, and the campaign ending remain open.


### Hearing and door interruption verification

Live hearing-only QA verified an unseen reloader grants Cabral an interrupt without exposing its identity or exact position. A paid crouch and reload retain the anonymous area, 97 AP and six-second clock. Live door QA verified opening the door exposes the guard, triggers its reaction shot and returns control on the same turn. A new action-driven projection regression protects non-disclosure. All 25 interrupt/projection tests pass; T06 now records completed live checks. These are subsystem checks, not evidence of the remaining strategic features or campaign ending.


### Critical-care supply demand

A donor could supply bleeding care but ignored a non-bleeding patient below the critical-health threshold, although medics already supported that treatment. Supply sharing now uses the same critical-first-aid predicate. The new regression failed before the fix and passes through an actual enemy turn with finite dressing/AP use, recovery from 10 to 15 HP, unchanged patient equipment and exact saved replay. Dead, stable, absent, routed, surrendered, unseen and unaffordable cases do not trigger handovers. All 22 sharing cases, type checking and the production build pass. The full suite passed 2,713 of 2,714 tests in 200.4 seconds. Its continuous fresh-start route now loses the first Tucumán assault; the enemy has two critically wounded soldiers restored to 15 HP. The correction remains uncommitted while route tactics are investigated. The required victory and later route assertions remain unchanged. All 51 unrelated snapshot files are unchanged.

#### Critical-care route investigation

The full-run failure is reproducible from a validated campaign/battle checkpoint at Tucumán, hour 172 (04:27). A second validated checkpoint preserves the preceding Córdoba victory. Both are generated by the continuous ordinary-order route, with no granted resources or authored outcomes. Replacing the player policy with the generic enemy policy stalled through turn 81 with only one action; that is not victory evidence. A damage-focused shot policy reproduced the original turn-17 defeat. Preparation inspection found two spare muskets carried by one soldier while another carried only a blade. A temporary preparation variant deposited spare guns through ordinary sector inventory and armed all ten soldiers, but still lost on turn 33. A four-hour pre-march wait produced an 08:00 arrival and a real turn-10 victory with two dead soldiers and one routed critical survivor. The route helper now uses those ordinary equipment deposits and the wait; its original victory assertions are unchanged. Full continuation/replay validation is in progress, and the medical AI fix remains uncommitted.

The first updated continuation passed Tucumán and failed a staging assertion: five additional survivors made the old “all squads” selection deploy thirteen people where the route intended eight. Salta preparation now selects the officers' active squad and its named support squad explicitly, retaining the other local survivors. The next run reached the actual Salta battle but lost at its 04:00 arrival (turn eleven). The victory assertion remains intact. A validated pre-Salta checkpoint is being generated to test deliberate daylight staging without replaying or modifying the earlier campaign.


The saved Salta staging state validates at hour 225. An eight-person daylight assault still lost. Including the five real additional Tucumán survivors, through their existing squads and normal queued routes, produced a turn-13 daylight victory at hour 248. The helper now explicitly expects the thirteen deployed soldiers and pays the four-hour staging delay. The officer, Dorrego, Quiroga and Paz died in that trial; those losses are retained. Full route replay and later campaign validation are still required before acceptance.

The reinforced route passed Salta victory, exact replay and full-save settlement, then stopped at the recruitment visit. Inspection confirmed Güemes and Macacha alive, and Azurduy alive at 88 HP in a different squad from the active survivor (126). The continuation now selects Azurduy's actual squad and assigns her alone as the envoy before the ordinary visit. Other survivors keep their records and equipment at Salta. A focused Yatasto continuation from the validated Salta victory is running before another full route pass.

The explicit-envoy continuation completed Yatasto at hour 266 with phase three and squad `[1,0,8]`. The next staging check encountered the surviving Salta garrison's real northern defense before Córdoba. Cuyo preparation now uses the ordinary retreat choice to move that garrison to friendly Tucumán and restores selection of the Cuyo squad. The later-route check has passed actual Córdoba defense at hour 294 and Mendoza assault at hour 298, including replay/save settlement and the existing casualty and resource assertions. Production, mountain stages and later battles are still running; the overall fix is not yet accepted or committed.

Production preparation initially failed for insufficient cash and then copper. It now waits, within a bounded interval, for actual territorial income and material yields before issuing each paid recipe. The first batch then passed its existing 200-infantry/two-cannon and save assertions. The longer schedule exposed enemy-group-4's real Tucumán defense at hour 408, because the new route retains northern survivors. Army production now invokes the ordinary automatic defense for that distant sector, preserves its actual outcomes, and restores the selected production squad. The new continuation is running; no later mountain victory or full-suite success is claimed yet.

The distant-defense continuation passed full army production: the existing assertions confirmed 3,000 infantry, three cannons, Córdoba control, Tucumán loss and valid saves. Mountain preparation then rejected an unnecessary fifteen-dressing addition because the medic retained earlier supplies. It now buys only the shortfall to fifteen carried dressings, preserving surplus stock and ordinary capacity/payment checks. The continuation is being rerun with a validated army-production checkpoint before the mountain assault.

The new continuation won Uspallata at hour 1332 and Los Patos at hour 1890, with exact battle replay and validated settlement saves. Medical recovery now tops up existing carried dressings instead of adding a fixed quantity. Eight Los Patos survivors exposed an invalid single-squad return. Andes preparation now queues both existing squads to Mendoza within the six-person limit and explicitly selects Macacha's squad for the subsequent visit. Return and coastal continuation checks are running; the campaign ending and full-suite acceptance remain open.

Both queued return squads reached Mendoza and the San Martín recruitment/coastal staging assertions passed. Ensenada then stopped on a rejected movement order for San Martín to (31,21), with “Destino inaccesible o puntos de acción insuficientes.” The route still rejects invalid orders rather than silently skipping them. A temporary trace is reproducing the encounter and saving its exact pre-order state for path diagnosis. No Ensenada victory is claimed for the revised route.

The Ensenada trace identified an actual movement mismatch: the destination held an unseen enemy, and execution recalculated the route using hidden occupancy. Ordinary movement now plans from observed occupants and uses the existing complete-field check at each actual step. The captured order advances from (27,24) to (30,22), spends 71 AP and stops before the hidden enemy at (31,21), without an error. Five new regressions cover hidden destination/intermediate occupancy, shared sight, civilians, atomic rejection and saved replay. Focused 25- and 38-test runs pass; the full Ensenada battle is running. See [movement knowledge](../gameplay/tactical/movement-knowledge.md). This runtime change also needs fresh full-route validation.


After the movement fix, the original Ensenada tactics won the battlefield but killed San Martín; the nonterminal-campaign assertion correctly rejected that outcome. The existing coastal command policy instead kept him behind the battery, won on turn fifteen, retained him at 88 HP, and passed exact replay/full-save settlement. The fresh-route test now uses that policy for Ensenada. Other casualties remain real, including Beltrán, Cabral and operative 109. Later coastal care must account for the actual survivors, and the changed movement runtime still needs full-suite validation.

The movement-knowledge full run passed 2,718 of 2,719 tests. The continuous fresh route now loses San Lorenzo on turn six (75 actions), before the later medical-route checkpoints. Type checking and the production build passed. This means the later isolated victories do not establish a continuous route with the new movement behavior. A new checkpoint from ordinary opening orders preserves the pre-assault support state; reserve and daylight preparation are being checked without changing combat rules or weakening victory assertions. Both runtime corrections remain uncommitted.

A two-hour ordinary wait before the San Lorenzo march gives an 08:00 arrival and a turn-eight victory (98 orders). Exact replay and full-save settlement pass with the commander alive. The test preparation now includes that wait, and a continuous route run is active. The reserve-only alternative reached the controller limit with an active battle, so it is not victory evidence. Fifty unrelated files remain byte-for-byte unchanged; the original tactical file is preserved separately for staging only the movement patch.

The continuous daylight route confirms San Lorenzo victory but stops at northern care after 28.6 seconds: the helper requires both hard-coded relief doctors to remain alive. Actual losses must be preserved. The next step is to select and fund available medical support through ordinary campaign orders, then continue the route. No integrated pass is claimed.

Northern relief now selects two living, available doctors, preferring retained contracts before replacements. The fresh daylight route uses Molina and Lagos after Villalba dies; paid recovery and save assertions pass. The eight opening-playthrough tests also pass (66.0 seconds). Córdoba with the original eight-person force retreats under both ordinary and cautious orders. A real morale-rest/renewal probe raises the force above 35 but still retreats, so it was not added to the accepted route. That probe exposed and fixed a test-controller error that selected a dropped primary weapon.

Four ordinary paid recruits (117, 121, 126, 129), equipped from actual San Nicolás remains, reinforce the Córdoba attack. The twelve-person assault wins on turn ten at hour 108 (150 orders), with exact replay and full-save settlement. The route now uses this preparation. Routed survivors 111 and 100 receive actual care, recovered/paid dressings and transport to Retiro; both are fully healed at hour 145, and all prior deaths remain. The old fixed patient list and return-squad list now follow the actual survivors.

Córdoba is attacked at hour 150 while the returning relief squad rests in Retiro. The helper now stops at that real encounter and selects the local garrison instead of submitting another invalid wait. Its four defenders (116, 127, 121, 129) lose on turn six. The victory assertion remains unchanged. Next work must provide a viable ordinary defense or campaign recovery; the continuous route and full gameplay completion remain unproven. Current changes are uncommitted.

Córdoba's hour-150 counterattack now has two additional paid defenders (144 and 146), supplied from actual recovered guns and typed ammunition. The six-person defense wins on turn six (51 orders), with exact replay and full-save settlement. The route uses this preparation. All living contracted survivors then travel to Córdoba through ordinary walking routes; posta is not yet unlocked. Eleven soldiers, including the newly hired 133, win Tucumán at hour 206 on turn twelve (159 orders), again with replay and save checks.

The actual wounded survivor is now 101 at Córdoba. A paid relief officer treats that survivor with recovered Córdoba dressings, then the squad travels to Buenos Aires and recruits Paroissien and Dorrego. Recovery/recruitment completes at hour 232 and the ordinary northern return at hour 271. Patient and contract assertions follow actual living personnel; deceased 122 and 126 are not reused. A fresh-start run confirms the route through this return in 98.0 seconds, then fails an outdated support-list assertion that still included dead 126. That assertion is corrected to the actual two officers.

A separate Salta probe using the northern combat policy wins at hour 294, but its controller differs from the continuous test's Tucumán policy; an exact-controller replay is running. In that probe Córdoba falls to a real interior group at hour 294. Buenos Aires and Retiro count as one locality for recruitment, so the loss leaves fewer than five liberated localities and Macacha correctly refuses recruitment. The northern supply route is also cut. The route needs actual territorial defense or recapture before Yatasto; no continuous-route or full-suite pass is claimed.

The exact Tucumán-controller Salta probe also passes victory, deterministic replay and full-save settlement. Its output is preserved separately from the alternative-policy result. Fifty unrelated snapshot files remain unchanged; the pre-existing tactical file content is still preserved separately from the scoped movement correction.


## Tucumán preparation correction — 22 September 2026

The fresh route no longer assumes eleven survivors after Córdoba. It preserves
actual living, uncaptured recruits and forms squads of at most six. Before
waiting or marching, local medics stabilize critical patients; a surviving medic
travels from Retiro to Buenos Aires to treat the routed wounded soldier. Care
uses recovered dressings, then one-at-a-time purchases from finite Córdoba stock
as treasury funds permit. Contracts renew during care, and the actual squads
complete normal reload orders before departing.

The seed-8 checkpoint has eight soldiers at full health, no bleeding, one loaded
round each, nine to twelve reserve rounds, and 90 pesos remaining at hour 260.
The fallen remain dead. See [preparation evidence](../evidence/tucuman-preparation-2026-09-22.json).
This is preparation evidence, not a won battle: the existing tactical controller
still loses Tucumán. The full fresh campaign test remains red, and later route
stages remain unverified on this state. No combat or economy rule was weakened
to force that route to pass.


## Daylight Tucumán victory and distributed relief — 22 September 2026

The same prepared eight-person force wins Tucumán after waiting for daylight
through normal campaign commands. The earlier night assault lost. This changes
the player's timing, not combat rules, enemy strength, resources, or casualties.
The tactical result repeats exactly and passes battle-time synchronization and
complete campaign/battle save round-trips. Five hired soldiers survive; one has
routed to Córdoba, while the other four remain at Tucumán. See [victory evidence](../evidence/tucuman-victory-2026-09-22.json).

Relief now treats each actual patient location with ordinary tactical medical
orders and finite recovered dressings. It stabilizes critical wounds before
travel and evacuates the distant patients to Córdoba. Paid officer recruitment,
contracts and medical care then proceed through the campaign dispatcher. A real
royalist counterattack (`enemy-group-2`) interrupts hospital care at hour 294.
The route must resolve this encounter; it does not suppress it or grant a result.
The full fresh campaign test remains incomplete at that stage.


## Hospital defense through Yatasto — 22 September 2026

The hospital defense now has purchased, compatible ammunition for the relief
officer. It wins through ordinary combat, with the officer and one patient
killed. Recovery chooses surviving local medics, uses existing or purchased
dressings, and finishes treatment without restoring either casualty. The party
reaches Buenos Aires at hour 335 and recruits Paroissien and Dorrego through
physical dialogue.

Northern reunion keeps every available survivor in squads of at most six and
does not wait for a counterattack already defeated at the hospital. The route
wins Salta, then resolves a new Salta counterattack before the Yatasto journey.
Güemes dies in that battle; Juana and Macacha complete the physical mission
handover and reach phase 3 at hour 424. Tactical victories have deterministic
replay, time synchronization, casualty settlement and save-round-trip checks.
See [checkpoint evidence](../evidence/northern-phase3-2026-09-22.json).

The new casualty assertions require matching actual battle deaths. They do not
accept unexplained missing patients or revive actors to retain an old party
count. These checkpoints do not establish the later Cuyo, mountain, coastal,
or ending route, and do not complete the overall gameplay goal.


The fresh-start rerun (`node --test tests/fresh-campaign-recovery.test.mjs`)
confirms the hospital defense, casualty-aware recovery, reunion, both Salta
battles and Yatasto handover on the current worktree. It then fails in Cuyo
preparation at the unaffordable one-day contract for recruit 142 (1,290 pesos).
The route needs a valid spending/recruitment plan; no funds or free recruit were
injected. Full campaign and gameplay completion remain unproven.


## Cuyo budget and care module initialization — 22 September 2026

The Cuyo route bought fifteen medical kits even when both travelers were at
full health. Preparation now derives treatment needs from wounds and the actual
doctor's rate, subtracts carried supplies, and buys only the deficit. The current
party therefore pays the real 1,290-peso daily contract and stages at Córdoba
with 345 pesos left. It resolves an actual reported counterattack when present,
instead of requiring a repeat of an already defeated attack. See [staging evidence](../evidence/cuyo-preparation-2026-09-22.json).

A direct medical-module import exposed a real initialization cycle between
care, work, squad validation and assignment notices. Shared assignment labels
now live in a data-only module, while notice issue-code lookup initializes on
first use. Public exports and assignment/save semantics remain the same. Fresh
process tests cover medical-care, assignments and sleep as entry modules. All
62 focused logic/rendering checks, typecheck and production build pass; static
export verifies 960 files and 856 asset references.

Mendoza preparation now completes ordinary reload orders and uses daylight.
The current three-person force still loses that assault under the existing
controller. This is not a campaign victory, and combat rules were not weakened.


The final fresh-start rerun for this change confirms Cuyo preparation and its
budget, then fails at the actual Mendoza victory assertion (defeat, not victory).
The route therefore remains incomplete. The passing 62 focused checks and build
are evidence for the care initialization change, not a green full-game suite.

### Native-density scenery follow-up

The current production forest walk meets the 60 FPS budget at 100%, including
movement immediately after zooming out. Day and night each record 518 moving
frames, maximum 10.3 ms, with no slow frames. Zoom no longer rebuilds scenery
textures. Enlarged cached scenery can look softer above 100%. Cold loading,
large combat, and zoom-click timing are not yet accepted. See
`docs/evidence/frame-rate-2026-09-22.json`, `nativeDensityFollowup`.

### Morale and final northern return

The five recovered veterans still had morale between 5 and 22.1. Normal paid
rest restores morale at hour 3798, but groups 9–11 occupy Jujuy, Salta and
Tucumán during that time. A real Mendoza trip purchases the six finite arsenal
grenades. The final force recaptures Tucumán at hour 3826 using legal arrival
placement: the cannon crew stays together and infantry enter on both flanks.
The battle wins in 22 turns and 191 orders, passes identical replay and save
settlement, and defeats group 11. Operatives 107 and 141 die permanently.
Survivors are 1000, 139 and 144; 139 has 15 HP and no bleeding. Treasury is
8,578 pesos and San Martín remains alive at Córdoba. Fourteen deployment and
controller checks pass; the separate controller/morale run passes 15 checks.

The continuing route must heal 139, provide real garrisons, clear groups 9, 10
and 8, win Humahuaca, and prove the ending. The full fresh integration has the
new preparation stages but is not accepted past this focused checkpoint.

## 26 September: garrison recovery and invasion search

Paid recovery and two real militia courses finish at hour 3880. Operative 139
has 79/79 HP, six militia guard Tucumán, and treasury is 8,728 pesos. Group 12
arrives at hour 3888. The first defense exposed two test-driver errors (manual
militia orders and treating militia as hired roster records) and a runtime
stall: after the hired force died, surviving militia and invaders remained
apart while invaders only patrolled their original posts.

Incoming strategic attackers now search fixed sector quadrants without using
hidden enemy locations. Guards keep their local patrol. Save validation covers
the search assignment, and a later occupation clears the invasion order.
The exact defense now ends in defeat on turn 55. Identical replay, tactical
save, public settlement and campaign save all pass. This is a losing branch,
not a completed campaign or a winning-route checkpoint. The healthy, supplied
pre-defense checkpoint remains available for further tactical validation.

All 163 focused AI/militia/world tests pass, plus seven final world checks,
typecheck and production build. See
[evidence](../evidence/invader-search-2026-09-26.json). Full fresh integration must
be rerun after this runtime change; prior battle continuations do not prove it.
