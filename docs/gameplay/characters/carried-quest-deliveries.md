# Carried quest deliveries

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The Retiro clothing errand asks for two usable wool ponchos. The player selects an owned poncho in a pocket, hand or outfit slot. Starting clothing and finite found garments are valid sources. Ordinary equipment shops are deferred. Clicking the sargento approaches and offers that exact garment. Preparing it in the main hand is optional. J still selects conversation. The newer [selected-gift flow](selected-npc-gifts.md) adds contact-time refusal and portrait responses; the original equipped-item command remains available.

A gift uses the normal equipped-item command. The preview checks the recipient, visibility, available actor, usable garment and remaining requested quantity before moving. A distant valid recipient gets an ordinary walking approach. Contact or a moving recipient can stop the approach without giving the item; the player must check and issue the order again. Delivery is available in exploration, advances time and spends no AP. The internal four-AP handling cost supplies the normal exploration duration; this is period-game tuning.

Each accepted poncho leaves the giver's inventory and stays in the recipient's `questGifts`, with its exact wear and optional identity. The two-item limit prevents extra gifts after fulfillment. Ruined garments, other objects, dead or unseen recipients and combat delivery are rejected without removing property. Save validation checks recipient, quantity, garment condition and duplicate identities across NPCs, combatants and field equipment.

The conversation shows received progress. In a fresh campaign, the first accepted handover opens the errand if needed. The second leaves it pending until the player speaks with the sargento and chooses either a 40-peso reimbursement or local support (+8 loyalty, capped at 100). Cash gives no civic reward; local support gives no cash. Full delivery and the errand's control conditions are required. Closing the panel, repeating a clock update or reloading does not resolve the choice. Local support can affect militia eligibility; port income keeps its separate control and conversation requirements.

Both garments remain with the recipient. The saved completion records the selected branch, and repeated or opposite choices reject without changing property or rewards. Death before resolution ends the pending errand without a reward; a completed outcome remains credited. Older campaigns or content packages with omitted errand definitions keep their automatic completion rule. Authored physical errands without a reward choice also retain automatic completion. New definitions are pinned with the campaign and tactical deployment. The other current errands use real medical deliveries, escorts or control reports; they do not create strategic supplies.

The editor can enable the same cash-or-support choice for a physical delivery in a city and set its reimbursement. It rejects a simultaneous automatic reward. Removing a referenced resident requires removing or reassigning the errand first.

## Original equipped-item verification

The following record predates selected-cursor gifts, reward choices and the retirement of ordinary shops. Its stock, resource and test totals are historical evidence. Current behavior is described above; current choice verification is in the [video review](../../verification/ja2-video-review-2026-10-03.md).

Five dedicated simulation cases cover exact transfer, rejected gifts, save validation, real approach, depot issue, partial delivery, full save/load, campaign report, reentry and one-time reward. Existing quest and conversation replay cases now perform real handovers instead of subtracting global textiles. The conversation render check covers received progress and acknowledgement wording.

A separate browser preview on port 3023 used the production Battlefield and reducers. A fresh custom officer withdrew two ponchos from finite Retiro stock, approached through legal movement, accepted the errand and held a poncho. Two clicks on the sargento produced 1/2 and 2/2 received. Both full save restores succeeded, including after confirmation. The reserve remained three ponchos, textiles remained 240, and the actor retained 95 AP throughout exploration delivery. This preview uses a separate origin and does not replace the user's campaign.

The full isolated run passed 1,559 of 1,572 tests. Thirteen northern-route and stationed-artillery failures were reproduced in an untouched `d27047a` checkout. They depend on earlier battle outcomes changed by the building maps and remain open. Typecheck and production build passed. The later presentation-only checks were run separately.

After integration into the shared main checkout, all 35 focused dialogue, gift, quest and scene checks passed. Main typecheck also passed. Concurrent sprite and recruitment changes were preserved.
