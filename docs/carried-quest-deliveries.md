# Carried quest deliveries

The Retiro clothing errand now asks for two usable wool ponchos. The player takes real garments from the local depot, keeps them in physical pockets, and selects a poncho for the main hand. Clicking the sargento gives one garment. J still selects conversation; holding an object does not prevent deliberate dialogue.

A gift uses the normal equipped-item command. The preview checks the recipient, visibility, available actor, usable garment and remaining requested quantity before moving. A distant valid recipient gets an ordinary walking approach. Contact or a moving recipient can stop the approach without giving the item; the player must check and issue the order again. Delivery is available in exploration, advances time and spends no AP. The internal four-AP handling cost supplies the normal exploration duration; this is period-game tuning.

Each accepted poncho leaves the giver's inventory and stays in the recipient's `questGifts`, with its exact wear and optional identity. The two-item limit prevents extra gifts after fulfillment. Ruined garments, other objects, dead or unseen recipients and combat delivery are rejected without removing property. Save validation checks recipient, quantity, garment condition and duplicate identities across NPCs, combatants and field equipment.

The conversation shows received progress. After two handovers, **Confirmar entrega** completes the errand and grants the existing regional loyalty reward once. It cannot draw missing goods from the global reserve. Textiles remain unchanged. The campaign completion record prevents a repeated reward, while the actual NPC ownership survives full saves, leaving the sector and reentry. The other bulk powder and cavalry-supply errands still use campaign goods; they are not evidence of physical carried delivery.

## Verification

Five dedicated simulation cases cover exact transfer, rejected gifts, save validation, real approach, depot issue, partial delivery, full save/load, campaign report, reentry and one-time reward. Existing quest and conversation replay cases now perform real handovers instead of subtracting global textiles. The conversation render check covers received progress and acknowledgement wording.

A separate browser preview on port 3023 used the production Battlefield and reducers. A fresh custom officer withdrew two ponchos from finite Retiro stock, approached through legal movement, accepted the errand and held a poncho. Two clicks on the sargento produced 1/2 and 2/2 received. Both full save restores succeeded, including after confirmation. The reserve remained three ponchos, textiles remained 240, and the actor retained 95 AP throughout exploration delivery. This preview uses a separate origin and does not replace the user's campaign.

The full isolated run passed 1,559 of 1,572 tests. Thirteen northern-route and stationed-artillery failures were reproduced in an untouched `d27047a` checkout. They depend on earlier battle outcomes changed by the building maps and remain open. Typecheck and production build passed. The later presentation-only checks were run separately.

After integration into the shared main checkout, all 35 focused dialogue, gift, quest and scene checks passed. Main typecheck also passed. Concurrent sprite and recruitment changes were preserved.
