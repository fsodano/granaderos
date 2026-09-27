# Verified advance to the Mendoza foundry

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](published-progress.md) for the main branch baseline.

Verified 12 September 2026 from the actual hour-274 [Cuyo recovery save](../gameplay/campaign/remote-squad-formation.md#recovery-before-cuyo). This continuation preserves the failed first attack, its physical retreat and captivity, a paid relief force, and the persistent enemy garrison. It reaches the foundry and mountain passage agreement through ordinary local recruitment and campaign orders. It does not establish full campaign completion or general combat balance.

| Operation | Turns | Tactical orders | Actual result |
| --- | ---: | ---: | --- |
| First Mendoza attack | 7 | 47 | Retreat: four dead, one escaped, one captured |
| Relief attack | 4 | 64 | Victory: two more dead; captured doctor released |

Both battles repeat with identical tactical results. Time is synchronized before reporting either result. All five resulting checkpoint saves are reloaded and compared with the actual campaign state.

## Preparation, retreat and captivity

One hour of rest restores doctor 122 to full energy. Operative 142 recovers a discovered Charleville from the Córdoba equipment pool. The force visits the cleared tactical sector, equips that exact carried gun using the normal equip order, then returns through the ordinary visit report. Ten dressings are purchased for the two doctors, and paid renewals cover the march. No health, money, ammunition or weapon is injected into the force.

The first attack reaches Mendoza at hour 287. At hour 287, second 574, the actual battle ends in retreat. Operatives 105, 109, 115 and 116 die. Operative 142 physically crosses the exit to Córdoba with 45 HP and bleeding 2; the returned campaign preserves his exit record and destination. Doctor 122 remains behind with 3 HP and bleeding 4 and is captured. She is removed from service, and her contract and eight reserve cartridges are held in captivity. A living tactical unit is not treated as an escaped survivor unless its actual disposition says so.

All seven enemy soldiers remain alive after the first attack, with wounds preserved in the sector snapshot. Salta falls to the moving northern column during the southward march. The capital remains under blockade. Neither strategic event is reversed to simplify the test.

## Paid relief and release

Doctor 139 receives a paid week contract in Córdoba. One carried dressing stops operative 142's bleeding. Five purchased dressings and the doctor's remaining carried dressing then heal him to full health over six hours. Rest and an actual contract renewal follow. Operative 142 remains in reserve at Córdoba.

The route hires 132, 143, 120, 136 and 134 for day terms and sends them with doctor 139 to Mendoza. At hour 312, the relief attack loads the saved garrison, including its prior wounds. Four turns and 64 orders produce victory at hour 312, second 598. Operatives 136 and 134 die. Doctor 122 is released with the same 3 HP, bleeding 4, equipment and remaining contract time she had in captivity. Her resumed contract expires at hour 331. There are now twenty-one permanent operative deaths across the full route.

## Stabilization, recruitment and foundry

Operative 120 uses one actual dressing and one hour of care to stop doctor 122's bleeding. Her HP stays at 3. Operative 143 then forms the visiting squad and walks to Fray Luis Beltrán for the required recruitment conversation. Beltrán joins through the ordinary campaign and tactical records. The foundry order costs 500 pesos and 20 copper; the passage agreement costs 200 pesos, 60 textiles and 10 sabres.

The meeting verifier previously selected the highest-leadership player-side unit from the entire saved sector, which included corpses from earlier attacks. It now selects a conscious, living, capable speaker from the current deployment. This fixes the test controller; no production recruitment rule changed. The route actually reaches Beltrán and completes the conversation with operative 143.

At hour 313, second 758, the foundry and passage agreement are active. Treasury is 573 pesos. The campaign is still in phase 3. Doctor 122 and operative 132 are critically wounded but stable. Mendoza's new force still needs care and supplies; Salta must be retaken, the blockade removed, the mountain passes secured, and production completed before the ending can be verified.

## Reproduce

After the northern route and Cuyo recovery verifiers, run:

```sh
node tools/verify-mendoza-route.mjs --input /tmp/granaderos-cuyo-recovery-check/cuyo-recovered.save.json --output /tmp/granaderos-mendoza-check
```

This writes `mendoza-prepared.save.json`, `mendoza-retreat.save.json`, `relief-prepared.save.json`, `mendoza-rescued.save.json`, `foundry.save.json`, and an action/result report. The verifier explicitly expects the first battle's retreat. The earlier opening victory requirements remain unchanged. Retreat reports retain the sector's prior owner; the helper still rejects any unexpected battle outcome.

The separate command completed both battles and their replays, the physical recruitment and paid preparation, and all five save checks. The original verification-only checkpoint passed 1,328 tests. The subsequent [reload-work fix](../gameplay/equipment/campaign-reload-work.md) passed all 1,345 tests and was replayed from the fresh northern route through this foundry checkpoint. The subsequent [persistent-load rule](../gameplay/equipment/campaign-gun-loads.md) adds thirty earlier campaign seconds and five seconds of actual reload preparation before Mendoza, without changing these battle results. The verifier checks the 39-hour, 227-second base duration plus recorded reload preparation from its input.
