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
