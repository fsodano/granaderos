# Gameplay completion work

The objective is complete Granaderos gameplay with classic JA2 parity where appropriate to the period. The requirement baseline remains [the parity audit](ja2-parity-audit.md). This work list does not replace or reduce that baseline. Passing one scenario or one test group does not prove completion.

## Recovery checkpoint — 21 September 2026

- Recovered and committed critical first aid, civilian health persistence and associated campaign corrections as `2c121e3`.
- Verified the preserved pending files against the prior integration snapshot. All 51 unrelated files matched; overlapping gameplay/art files retained their separate changes.
- Re-ran 33 critical-care and automatic-bandaging tests, type checking and the production build successfully. The earlier completed integration log records 301 passes; it is historical evidence, not a new full-suite result.
- Added a coastal defense regression with actual capture, a paid hire, travel reversal and encounter entry. A scripted victory isolates prisoner settlement. It checks wounds, ammunition, saves, duplicate reports and remaining hostile groups. This is not proof of combat balance or a playable prison scene.

## Work order and completion evidence

1. **Stabilize the integrated game.** Run the complete current suite, resolve failures without removing finite supply, permanent casualties, legal movement, or save checks. Preserve separate artwork and roster changes. Verify type checking, the production build and relevant live controls.
2. **Prove the complete campaign (W10).** Start at Retiro with no recruits and no free sectors. Use paid hiring, actual tactical battles, finite supplies, medical recovery, contracts, production, travel, local recruitment and mission interactions through the ending. Retain casualties and saves between phases. Replace old fixed-hour route assumptions with checks of actual game events. Keep earlier established-area scenarios as subsystem evidence.
3. **Finish capture, dialogue and quests (S09, W05–W08).** Implement playable detention/rescue or escape, escort destinations, alternative resolutions, failure consequences, physical deliveries and one-time rewards. Keep historical setting and finite equipment custody. Include interface, persistence and real tactical-path verification.
4. **Finish strategic decisions (R01–R06, S02, S05–S08, W02–W04, A02–A03, A07).** Cover contract choices and risk, relationships and departures, equipment repairs and merchants, militia orders and care, enemy reinforcement resources and uncertain intelligence, transport capacity and passenger rest, arrivals during battle, and interruption notices. Each exposed choice needs working consequences and save validation.
5. **Finish tactical and equipment choices (T07–T09, C03–C04, C10–C12, V02, V06, V09, P04, I01–I09, E02–E05, A06).** Complete supported observation, movement, protection, damage, demolition, tools, hand operations, artillery handling and field progression. Research period support before adding camouflage, armor, fittings or ammunition variants; label numerical adaptations. Do not close a requirement merely because an existing simpler mechanic resembles it.
6. **Complete visible acceptance.** Exercise the audit's remaining live checks for interrupts, awareness, sound, stealth, movement, melee, items, merchants, militia and campaign controls. Verify actual production assets, keyboard and pointer input, previews, rejected actions and save continuation. Recheck every audit row against the final integrated game before claiming completion.

## Reporting rules

Record exact tested scope and remaining gaps. A fixture that injects a victory is never a campaign-playability proof. A test that supplies a starting injury or terrain can verify settlement but must disclose that boundary. Do not mark the goal complete while required audit rows remain missing, partial or unverified.
