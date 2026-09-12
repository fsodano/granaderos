# Northern campaign route verification

## Current regional terrain and weather checkpoint

Checked on 12 September 2026 from `be30998`, with the opening equipment repair at `1706034`. San Nicolás, San Lorenzo and Córdoba each reach a real victory and repeat deterministically. The complete route does not yet pass on this checkpoint.

All six original soldiers survive San Nicolás. San Lorenzo leaves 110 and 114 alive; 1000, 115, 123 and 107 remain dead. Northern preparation selects actual living donors instead of requiring dead soldier 123 to transfer items. It collects sixteen finite battlefield dressings and receives four carried dressings from 110 and 114. The paid doctors use three to heal 114. Four paid recruits fill the squad to six; available rifles and outfits are taken through ordinary sector inventory orders.

Preparation ends at hour 72. Córdoba falls at hour 84 after 16 turns and 99 orders. Only 134 and 117 survive that assault, at 68 and 15 HP. The helper repeats the battle, saves its synchronized result, and preserves all actual deaths. No soldier or item is created to match the earlier route.

The named playthrough passes its first two checks. Its next check stops when hiring doctor 139 automatically fills a vacant squad slot, while the old preparation expects the squad to stay unchanged. Later checks still contain casualty identities from the earlier checkpoint. Tucumán defeat, rescue, paid care, Salta and Yatasto remain required and unverified with current regional conditions. The results below are historical evidence only.

## Earlier building-map checkpoint

Checkpoint: 12 September 2026, on the building maps introduced at `d90e52b` and the gameplay engine at `4c10749`. The route uses the actual opening casualties, finite field supplies, and paid contracts. It also runs against the working checkout's higher elite prices. This is an **established southern campaign**, with Buenos Aires and Ensenada explicitly secured before the scenario begins. It does not prove the full Retiro-only campaign or the ending. See [Retiro opening](retiro-start.md) for the separately verified fresh start.

| Battle | Turns | Orders | Actual result |
| --- | ---: | ---: | --- |
| San Nicolás | 17 | 160 | Victory |
| San Lorenzo | 10 | 99 | Victory |
| Córdoba | 17 | 114 | Victory; all six attackers survive |
| Tucumán, first assault | 5 | 58 | Defeat; three deaths and three captives |
| Tucumán, rescue | 3 | 59 | Victory; Villalba dies and all three captives are released |
| Salta, joint assault | 9 | 119 | Victory; five deaths and a critical survivor |

Each battle repeats deterministically from its request and saved sector. The route reports the actual outcome, synchronizes tactical time, saves and restores the full campaign/battle pair, and retains permanent deaths. These counts describe this scenario; they are not balance targets or a general winning strategy.

## Recovery and captivity

The opening leaves eight dead and four living hired soldiers at hour 60. The old verifier expected a dead doctor to work and twelve dressings on one body. The revised route hires Villalba and Molina for 294 pesos, collects twenty dressings from the two real battlefields, and receives four donated dressings. The doctors use 27 dressings to heal Ledesma, Soria and Ojeda. Recovery and staging end at hour 96. Affordable replacements recover actual rifles and clothing before the next march.

Córdoba falls at hour 108. Soria needs further treatment. A paid replacement doctor buys twelve dressings from the local shop and uses ten during recovery. The squad rests and departs at hour 124.

The first Tucumán assault loses at hour 136. Ledesma, Véliz and Silva die. The custom officer, Soria and Quiroga are captured at 10, 13 and 1 HP. They leave the active squads; their wounds, equipment records and unused contract time enter custody. The surviving medical staff remain at their real locations.

The rescue brings reserves from San Nicolás to Córdoba, hires six ordinary replacements for 553 pesos, buys 24 dressings and recovers available long guns. Two squads make a coordinated assault at hour 160. Villalba dies, and the victory frees all three prisoners with their existing wounds and property. Three actual treatments stop their bleeding at hour 161. Captive contract pause and release on sector recapture are current Granaderos adaptations, not full JA2 prison parity.

## Finite supplies and Salta

Ojeda makes a real round trip to Córdoba while Molina treats the first patient. Earlier purchases have reduced shop stock, so the courier buys twelve available dressings for 360 pesos. Sixteen field dressings and three donated dressings supplement the medical supplies. Treatment and rest finish at hour 203. The scenario checks stock deductions, source counts, contract payments, actual travel time, recovery and saves.

Health recovery does not restore morale immediately. The three freed prisoners and Ojeda still have very low morale; Soria has also lost his rifle. Sending that group straight into Salta fails. The final route leaves them in recovery, hires Blackwood for one day and three ordinary replacements for a week, and transfers real firearms from the reserves or the recovered sector inventory. The new force remains within the available funds at the working checkout's elite prices.

The two squads reach Salta at hour 228. Their victory costs Ferreira, Peralta, Delatour, Bridget and Morel. Doyle survives at 3 HP. Available healthy doctors stabilize the wounded. The specialist can finish his existing contract locally; the route does not assume a second specialist payment. A doctor then travels to the Yatasto meeting after the ordinary northern-pact payment. Dialogue and movement complete the mission and reach phase 3 at hour 241, second 1163. All seventeen deaths remain permanent, while the custom officer survives in reserve.

## Verification boundary

`tests/opening-playthrough.test.mjs` runs all eight checks, including the enclosing route. The route helpers issue ordinary orders; they do not set health, refill inventories, edit clocks, fabricate victories or revive old casualties. Each selected combat request replays before its result is accepted. The original source campaign is checked for mutation, and full saves preserve the resulting state.

The earlier `fede464` route used different casualties, supply quantities and cheap elite contracts. It is historical evidence only. This building-map checkpoint restored the original combat, loss, rescue, courier, coordinated-assault and mission requirements on those maps. It still needs integration with a full Retiro-only start and continuation through Cuyo, the mountain passes, counterattacks and the ending. A passing route is not a claim of complete JA2 parity or broad campaign balance.

Verification: all 1,579 tests pass in the isolated checkout. The working checkout, including its concurrent elite-price changes, separately passes all eight northern-route checks. No product source files change in this checkpoint.
