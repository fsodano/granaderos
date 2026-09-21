# Gameplay completion work

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

- Accepted errands now have a permanent contact-death failure branch with saved evidence and a once-only campaign notice. Physical partial deliveries stay delivered, and completed errands are retained. See [quest failures](quest-failures.md). The Cuaderno lists known errands, acknowledged delivery progress, requirements and permanent outcomes; empty and failed entries were checked in the live browser. This does not complete escort, alternative-resolution or prison gameplay.

- Automatic field care now includes visible civilians, with finite supplies, ordinary typed treatment orders and named civilian save/reentry checks. All 57 focused care and inventory checks, type checking and the build pass. A live adjacent civilian treatment consumed one dressing and two seconds, stopped bleeding without restoring noncritical HP, and retained the result after reload; see [automatic civilian care](automatic-civilian-care.md).

## Fresh San Lorenzo victory checkpoint

The fresh-start integration test now continues from its actual San Nicolás victory into paid mission preparation. It hires Quiroga, Delatour, Barrera, Morel, Ricci and Villalba for a week, collects existing long guns through legal tactical movement and looting, and takes up to ten reachable battlefield dressings for the medic. It preserves all previous deaths, checks the exact contract debit, and validates saves. The full fresh-start test passes in about 19 seconds. This is preparation evidence, not San Lorenzo victory.

Three additional controlled continuations did not win: keeping the commander in western shelter preserved him but lost the field squad; returning him after two rounds lost the mission; the stronger squad with more recovered medical supplies also lost. No battle rules, enemy strength, initial health or victory conditions were changed. These failures do not by themselves prove a balance defect.

Coordinated mission deployment is now implemented: the desk explicitly selects eligible co-located squads, retains a validated manifest, and uses the existing arrival and return/save rules. Eight-person placement, reload and entry passed live; focused tests cover settlement and a supporting soldier's physical exit. See [mission squads](mission-squads.md). The integrated suite passes 2,557/2,557 with no skips; type checking and the production build pass. This integrated run preceded the fresh-campaign mission victory below.

The continuous fresh-start test now wins San Lorenzo with twelve explicitly selected soldiers. The support squad uses paid contracts and existing equipment; missing recovered rifles are not supplied for free. The commander moves to western shelter, then rejoins through ordinary tactical orders. Both northern battles replay deterministically. The final saved checkpoint is phase 2, hour 54, second 1472, with 417 pesos, San Martín at 88 health, and all 20 cumulative deaths retained. The test passes in 26.5 seconds. No victories, money, sectors or revived soldiers are injected. This proves this route through San Lorenzo; later phases and the ending remain unverified from a fresh start.

## Fresh northern recovery checkpoint

The continuous Retiro route now continues through actual recovery at San Nicolás. It retains the surviving doctor's existing contract and pays 119 pesos for the second doctor. Capacity-aware pickups leave surplus dressings in the sector; later care can collect them when space becomes available. Two patients recover fully using 20 dressings. Paid ammunition production and rest advance the route to hour 72 with 361 pesos. Every prior death remains permanent and the saved state validates.

An actual six-person Córdoba continuation loses. This is not a successful fresh northern campaign, and no enemy, health, supply or victory rule was changed to make it pass. The established-area northern scenario remains separate evidence. Its eight regression checks pass with no skips; the expanded fresh-start check also passes. These checks cover the route changes, not the full gameplay audit.

## Physical medical delivery

Tucumán now has a carried dressing errand with partial deliveries, quantity refusal, persistent ownership, notebook progress and a one-time loyalty reward. All 49 focused checks, type checking and the build pass; see [medical delivery](physical-medical-delivery.md) for exact scope. Live partial delivery, excessive-quantity refusal, completion and reload/notebook verification now pass. This does not complete escort, prison or alternative quest resolutions.

## Integrated medical-delivery verification

The current integrated suite passes **2,561/2,561 tests with no skips**. Added medical-errand checks cover permanent contact-death failure, retained completed rewards, physical supply custody, duplicate synchronization and rejection of missing saved receipts. All 49 unrelated files in the preservation snapshot remain byte-identical. This run does not close the remaining partial or unverified audit requirements.

## Local escort gameplay

Jujuy now has an accepted escort with local follow/wait and leader-change orders, actual movement to the western boundary, controlled-destination checks, one-time rewards, death failure, saved directives and notebook outcomes. Live acceptance, waiting, following, arrival and reload/notebook checks pass; see [escort gameplay](escort-gameplay.md) for exact scope. W07 remains partial for broader quest consequences and alternatives. W08 prison rescue/escape remains open. The integrated escort run passes 2,571/2,571 tests with no skips. The last intermediate-return and failure-text changes pass a separate 14-test follow-up; final type checking and the build pass.

## Prisoner custody preparation

The prisoner panel now exposes detention time, wounds, unavailable equipment and paused service. Sector recapture and the panel use a shared contract-restoration rule; 13 focused checks, type checking and the build pass. See [prisoner custody](prisoner-custody.md). This does not implement a prison scene, physical rescue or escape; W08 remains open.

## Detention entity construction

A detention manifest and tactical placement layer now preserve captured identities and wounds without duplicating custody equipment. Detained entities remain immobile until freed; 25 focused checks pass. Campaign deployment, health settlement, paid release, safe-exit settlement and live controls remain required. See [detention work](detention-gameplay.md). This is a construction layer, not playable prison gameplay.

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

Captives now deploy on campaign maps. Wounds, ordinary finite first aid and deaths synchronize with service records; full saves, reentry, live treatment and paused-contract sector release are checked. See [detention gameplay](detention-gameplay.md). This introduces an unresolved route issue: untreated physical prisoners can bleed out during the relief battle. The full integration run has 2,584 passes, three failures including the parent rescue scenario, and three dependent skips. Physical release/escape and a verified viable rescue path remain required; W08 is still partial.


## Finite custody-care checkpoint

Able occupying guards now use real confiscated dressings to stabilize prisoners during elapsed strategic hours. The first-aid formula, supply deductions, guard energy, once-per-hour receipts and full saves constrain treatment. Active tactical sectors receive no background care. The two failed sector-recapture routes now pass; the established route completes all eight checks through Yatasto with 11 permanent deaths. The live prisoner panel retains its exact treatment report after reload. See [detention care](detention-gameplay.md#finite-care-in-custody). This restores viable sector-recapture rescue; physical release, safe-exit escape and the full campaign remain open.

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

Local hired doctors can now take a separate militia assignment and treat retained garrison wounds with finite personal supplies. Hourly triage, sleep, training custody, saved stops, paid resupply and real reentry are covered by ten new simulation/render checks. The live interface verified 20→26 health, save continuation, kit exhaustion, a 150-peso resupply and full recovery with a completed-care notice. See [militia medical care](militia-medical-care.md) for rates, restrictions and exact verification scope. The integrated suite passed 2,633 tests; the final 39-check care run also covers the later three added cases and completion-text correction. Type checking and the build pass. Tactical militia commands and the other open audit requirements remain unfinished.


## City militia distribution

The original manual's town redistribution choice now has manual rank/quantity transfers and an automatic distribution preview in the Sector panel. Exact defenders keep their wounds, experience and finite equipment; critical patients and training cohorts remain in place. Transfers obey connected city ownership, encounter restrictions and capacity. Thirteen new simulation/render checks cover custody, real sector reentry, paid count-only cohorts and stable balancing. The live interface moved a wounded veteran, retained the transfer after reload, balanced twelve defenders across three sectors and rejected an excessive quantity. See [city distribution](militia-distribution.md). Tactical commands and the remaining gameplay audit are still open.

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

Four new transport cases and three panel cases pass, as do the 34 related logistics/equipment/save checks, 23 existing artillery checks, type checking and the production build. A live imported subsystem fixture verifies selection, dispatch, reload/resume, eighteen-hour arrival and the retained two rounds/40% partial load after the squad arrives. Actual redeployment is covered by the automated test. The full integration run is active; the feature is uncommitted pending that result. See [artillery transport](artillery-transport.md) for adaptations and remaining scope.


### Artillery transport integrated verification

The full suite passes **2,661/2,661 tests with no skips** in 336.3 seconds. The continuous route through Jujuy remains valid. Final focused transport/render checks, type checking, production build and diff checks pass. All 49 unrelated snapshot files remain unchanged. The transport implementation and its exact live/automated boundaries are documented in [artillery transport](artillery-transport.md).

The next campaign continuation still needs Humahuaca and the ending. The verified Jujuy save has exactly three living roster members (Brown, Barcala and San Martín), all without equipped outfits; reserve uniforms and ponchos are zero. Future preparation must use actual procurement and equipment capacity rather than presume spare troops or protection.

### Humahuaca continuation and renewed blockade

Buying a bronze reserve alongside the Jujuy swivel avoids waiting for a second swivel to restock. Jujuy retains all three survivors at hour 3,222. Immediate Humahuaca deployment at hour 3,228 wins in ten turns and 34 actions. The controller lets Brown approach the two-person gun after combat begins; gathering all three around it during exploration instead obstructed the advance. Barcala retains 29 HP, San Martín 88 and Brown 85. Actual orders, deterministic replay, campaign settlement and complete saves pass in the separate continuation. The fresh-route helper now includes this purchase and battle; the integrated Retiro-only run passes in 304.1 seconds with no skips.

Humahuaca does not yet finish the campaign. All sectors are patriot-owned, but a new sixteen-person coastal force has established a Buenos Aires blockade at hour 3,200. A paid return through Córdoba, medical care and a new bronze purchase reaches Buenos Aires at hour 3,292. That controller stalls at the turn limit with the three soldiers alive and the enemy force intact. It is diagnostic evidence only. No terminal victory or balance correction is claimed.
