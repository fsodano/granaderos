# Campaign verification through Salta and Yatasto

Verified 12 September 2026, starting from a fresh seed-8 campaign. This extends the [opening checkpoint](opening-control.md) under the current turning, finite-supply and weapon-fitting rules. It proves a legal route through Córdoba, a real defeat and rescue at Tucumán, paid recovery, a joint assault on Salta, and the Yatasto meeting that opens phase 3. It does not prove the complete campaign or general balance.

| Battle | Turns | Tactical orders | Result |
| --- | ---: | ---: | --- |
| San Nicolás | 10 | 122 | Victory |
| San Lorenzo | 12 | 110 | Victory |
| Córdoba | 8 | 99 | Victory |
| Tucumán, first attack | 5 | 80 | Defeat: two deaths, four captives |
| Tucumán, rescue attack | 4 | 86 | Victory and release |
| Salta, joint assault | 7 | 128 | Victory: five more operative deaths |

Every battle uses the ordinary tactical reducer and repeats with an identical result. Campaign time is synchronized before actual battle reports are accepted. Save encoding and decoding preserve each checkpoint. The original opening actions and assertions now live in `tests/opening-campaign.mjs`; the opening test uses that same scenario and adds recovery, defeat/captivity and recapture/care subtests. Every reported outcome comes from the actual returned tactical state. The first three victory requirements remain unchanged; the failed attack is retained as a real loss, not converted into victory.

## Recovery and march

The opening leaves eight permanent operative deaths, a nine-HP field medic, and three earlier survivors in reserve. The continuation hires doctor 112 for a prepaid week and collects twelve discovered, reachable dressings from the actual San Nicolás equipment pool. The source loses exactly twelve dressings, and treatment consumes all twelve. Patients 110 and 116 recover to full health over twelve hours. Six further hours of rest restore the doctor's energy. Morale remains low: 17.4 and 3 for the two patients.

At hour 78, the route buys day contracts for operatives 128, 142 and 105. The six-person field squad is 1000, 115, 112, 128, 142 and 105. The recovered patients stay behind. The real twelve-hour march reaches Córdoba at hour 90, second 263.

Córdoba falls at hour 90, second 311. All six field operatives survive, but doctor 112 has only 13 HP. Treasury is 1,992 pesos after ordinary costs, income and rewards. The three day contracts expire at hour 102. The continuation resolves these constraints through actual care and contract actions; the verifier does not restore health, morale, supplies or contracts by direct state changes. All eight opening deaths remain permanent.

## Córdoba recovery and the first Tucumán attack

Doctor 122 is hired for a prepaid week in Córdoba. Seven dressings are purchased from the workshop, reducing its stock from 40 to 33 and costing 210 pesos. Together with the doctor's two carried dressings, these supply nine hours of treatment for operative 112. His 51 missing HP are restored through the normal medical rate. Six hours of rest follow. All six original field operatives are alive, at full health and no longer bleeding when they depart at hour 105.

At hour 100, the reference renews contracts 128, 142 and 105 using the current expiration as a stale-order guard and pays the actual quotes. Each contract now runs to hour 124, covering the march and battle. The original health, supplies, treasury and contract records are never overwritten to prepare the test.

The squad reaches Tucumán at hour 117, second 311. Its current urban control strategy loses at hour 117, second 341: officer 1000 and operative 128 die; 115, 112, 142 and 105 are captured with 12, 4, 2 and 14 HP respectively. This loss is replayed exactly. The campaign accepts the actual defeat report, removes the captives from active service and squads, and holds their contracts and ammunition in captivity. Córdoba remains patriot, the field squad is empty, and the reserve remains available. The campaign is still in phase 2.

A diagnostic order trace showed the force approaching the urban center, making contact at short range and entering close combat. No combat rules, enemy health, source seed or driver decisions were changed to produce a passing victory. This is evidence of one losing strategy, not proof that Tucumán is unwinnable or balanced.

## Recapture and urgent care

The reference selects the existing reserve squad in San Nicolás. Operative 110 marches to Córdoba, arriving at hour 129. Doctor 122 is still there. Four new volunteers, 106, 145, 109 and 147, receive paid day contracts; these six operatives form the rescue force. Captive health, equipment and contract records remain unchanged throughout this preparation.

The rescue force reaches Tucumán at hour 141. The battle loads the saved, uncleared sector and its surviving garrison rather than replacing it with a fresh enemy force. Four turns and 86 real orders produce victory at hour 141, second 365. All six rescuers survive. The four captives are released with their existing wounds and equipment; their frozen ammunition balance is released once. Their contracts resume with the hours remaining at capture: expiration is 192 for 115, 252 for 112, and 148 for 142 and 105. The ten operative deaths accumulated on the route remain permanent.

Three freed soldiers are still bleeding. The reference immediately assigns all four freed soldiers as patients and assigns healthy soldiers 106, 109 and 145 as doctors. One real hour of care consumes exactly three carried dressings and stops all three hemorrhages. At hour 142, the freed patients remain at 12, 4, 2 and 14 HP. Stopping bleeding does not restore their missing health. Supplies, recovery and another renewal are still required before a further advance.

## Medical courier and recovered squad

From hour 142, doctor 122 collects ten discovered dressings from the actual Tucumán equipment pool and treats doctor 112. Operative 147 forms a separate medical courier squad and travels twelve hours to Córdoba. The courier leaves two torches and one boleadora in the local equipment pool to make room, buys thirty dressings for 900 pesos from finite merchant stock, and returns twelve hours later. The route pays contract renewals before both legs. No cargo, health or money is injected into the campaign.

The returned dressings are dropped at Tucumán and split between doctors 122 and 112. Seven additional dressings come from the actual carried supplies of healthy soldiers. Normal hourly treatment restores the four freed captives and the wounded courier to full health. Six hours of rest follow. At hour 190, all five patients have full health and 100 energy, the treasury has 2,002 pesos, and the ten earlier deaths remain permanent.

The strategic clock continues during care. A hostile naval group reaches Buenos Aires at hour 176 and establishes a blockade. The city remains patriot and the northern supply line remains available. Medical recovery does not pause strategic threats.

## Joint assault and northern mission

At hour 190, the route pays expiring contracts and assembles two local squads with six and four soldiers. Both queue actual marches to Salta and become ready at hour 202. The ordinary joint-assault action deploys all ten soldiers. The saved deployment includes both the campaign request and its actual tactical state.

The test controller uses the game's existing shot, cover and medical evaluation after contact, with the original reconnaissance routine before contact. It checks proposed movement against squad-visible occupancy. This corrects a test-controller mismatch where an enemy unseen by the moving soldier was already visible to teammates; it is not evidence of a production hidden-enemy pathfinding defect. Combat rules, enemy strength and the campaign seed are unchanged. The original opening controller remains the default for earlier battles.

The assault wins in seven turns and 128 orders, with an identical replay. Operatives 110, 106, 145, 147 and 112 die. There are now fifteen permanent operative deaths. Earlier trials with the original controller lost with both six and ten soldiers; those trials are not applied to this continuing campaign. The successful route proves one legal outcome, not general balance or a low-casualty strategy.

At hour 202, second 407, doctor 122 has one dressing left and operative 142 is bleeding. One hour of treatment consumes that dressing and stops the bleeding without restoring missing HP. The northern pact then consumes twenty muskets, ten horses and ten powder. Actual contract renewals cover the next journey. Doctor 122 returns to Tucumán while the other four survivors remain in Salta with their wounds.

The doctor enters the Yatasto scene, walks to Belgrano and San Martín, completes the three required conversations, and leaves through the ordinary mission report. At hour 215, second 496, Yatasto is complete, Salta is supplied, and the campaign advances to phase 3. Treasury is 2,007 pesos. The four survivors in Salta retain their actual wounds; none is bleeding, and no dead operative returns. This is the next starting point for Cuyo, defense and ending verification.

## Reproduce and inspect

Run from the repository root:

```sh
node tools/verify-northern-route.mjs --output /tmp/granaderos-northern-route-check
```

The tool starts a fresh campaign and writes twelve validated saves: `opening.save.json`, `prepared.save.json`, `cordoba.save.json`, `tucuman-prepared.save.json`, `tucuman-defeat.save.json`, `rescue-prepared.save.json`, `tucuman-rescued.save.json`, `rescued-stable.save.json`, `rescued-recovered.save.json`, `salta-deployment.save.json`, `salta.save.json`, and `yatasto.save.json`, plus `report.json`. Each save is read back and validated against the actual campaign and, for the pending Salta deployment, tactical state. The report records recovery orders, timing, battle results and remaining personnel. Without `--output`, the tool creates a new temporary directory. It does not access browser storage or change the player's campaign.

The complete isolated suite passed **1,322/1,322 tests**. A separate fresh command-line run completed all six actual battles and their deterministic replays, completed Yatasto, and wrote and reloaded all twelve saves. Whitespace checks passed. This checkpoint changes verification tools and documentation only; runtime code is unchanged.

## Remaining evidence gaps

Cuyo progression, defenses and the ending remain unverified through this real-outcome route. Sector-recapture rescue now has real campaign evidence; a dedicated prison escape scene remains absent. Older late-campaign tests that inject victory reports do not supply that evidence.

The earlier Córdoba checkpoint exposed an equipment access gap. San Lorenzo has a saved mission snapshot and discovered equipment, but no campaign sector of its own. The strategic inventory requires a controlled campaign sector and rejects that mission snapshot; selecting San Nicolás shows only its separate equipment pool. The opening leaves 29 known rows at San Lorenzo, including two dressings, without a strategic pickup path. That checkpoint recorded the gap without claiming to fix it.

The subsequent [mission inventory fix](sector-inventory.md#mission-sites-12-september-2026) resolves this access gap for San Lorenzo and Yatasto. The route above remains unchanged and does not depend on those extra supplies.
