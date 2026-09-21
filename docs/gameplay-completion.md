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

Tucumán now has a carried dressing errand with partial deliveries, quantity refusal, persistent ownership, notebook progress and a one-time loyalty reward. All 49 focused checks, type checking and the build pass; see [medical delivery](physical-medical-delivery.md) for exact scope and the remaining live check. This does not complete escort, prison or alternative quest resolutions.

## Work order and completion evidence

1. **Stabilize the integrated game.** Run the complete current suite, resolve failures without removing finite supply, permanent casualties, legal movement, or save checks. Preserve separate artwork and roster changes. Verify type checking, the production build and relevant live controls.
2. **Prove the complete campaign (W10).** Start at Retiro with no recruits and no free sectors. Use paid hiring, actual tactical battles, finite supplies, medical recovery, contracts, production, travel, local recruitment and mission interactions through the ending. Retain casualties and saves between phases. Replace old fixed-hour route assumptions with checks of actual game events. Keep earlier established-area scenarios as subsystem evidence.
3. **Finish capture, dialogue and quests (S09, W05–W08).** Implement playable detention/rescue or escape, escort destinations, alternative resolutions, failure consequences, physical deliveries and one-time rewards. Keep historical setting and finite equipment custody. Include interface, persistence and real tactical-path verification.
4. **Finish strategic decisions (R01–R06, S02, S05–S08, W02–W04, A02–A03, A07).** Cover contract choices and risk, relationships and departures, equipment repairs and merchants, militia orders and care, enemy reinforcement resources and uncertain intelligence, transport capacity and passenger rest, arrivals during battle, and interruption notices. Each exposed choice needs working consequences and save validation.
5. **Finish tactical and equipment choices (T07–T09, C03–C04, C10–C12, V02, V06, V09, P04, I01–I09, E02–E05, A06).** Complete supported observation, movement, protection, damage, demolition, tools, hand operations, artillery handling and field progression. Research period support before adding camouflage, armor, fittings or ammunition variants; label numerical adaptations. Do not close a requirement merely because an existing simpler mechanic resembles it.
6. **Complete visible acceptance.** Exercise the audit's remaining live checks for interrupts, awareness, sound, stealth, movement, melee, items, merchants, militia and campaign controls. Verify actual production assets, keyboard and pointer input, previews, rejected actions and save continuation. Recheck every audit row against the final integrated game before claiming completion.

## Reporting rules

Record exact tested scope and remaining gaps. A fixture that injects a victory is never a campaign-playability proof. A test that supplies a starting injury or terrain can verify settlement but must disclose that boundary. Do not mark the goal complete while required audit rows remain missing, partial or unverified.
