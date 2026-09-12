# Individual outfit equipment

Implemented 12 September 2026. This closes the requested general outfit slot, not the full JA2 armor system.

Each soldier has one outfit slot, separate from the two hands and the twelve pockets. The first supported garment is a wool poncho. It has a retained condition and a 2 kg weight. A spare occupies one large pocket. Two equivalent garments may share a quantity record, but still need two physical pockets.

In the tactical inventory, select the worn outfit to give or drop it. **Guardar vestimenta** puts it in a large pocket. Select a pocket containing clothing and use **Ponerse vestimenta** to wear one garment. An exchange uses the vacated pocket for the previous outfit. The operation fails without changing either item when the destination cannot fit. Clothing changes cost 8 AP in combat; exploration advances time without spending AP. The selected hand, gun load, and attachments stay intact.

The sector inventory also supports wear, stow, drop, and pickup. Equipment changes need a conscious soldier present in a safe sector. Ground transfers additionally need a discovered, accessible, cleared field. **Retirar poncho del depósito** takes one actual garment into a large pocket. It uses the local depot first; the general reserve is available at Retiro. It cannot withdraw absent stock, bypass pocket capacity, or operate during a pending battle.

Initial service clothing is issued once from the six ponchos in the campaign reserve. After those are assigned, later recruits have an empty outfit slot. Assaults, visits, return reports, rehires, and save loading do not recreate garments or grant protection from a pooled stock total. Clothing can be transferred, left in the sector, recovered from a body, or retained in captivity. Its condition and any instance identity follow its current owner. Historical return records do not become duplicate owners.

A serviceable worn poncho retains the existing climate and melee modifiers. A packed or zero-condition poncho supplies neither modifier. The UI says **Vestimenta**, not ballistic armor. Weight, AP cost, and the retained damage modifier are Granaderos tuning. Region coverage, penetration, garment wear, and garment repair remain separate unfinished requirements. Appearance changes are not part of this gameplay change.

## Verification

- Eleven focused cases cover the common slot, one-large-pocket rule, equivalent quantities, full-pack exchange, atomic rejection, exact AP, exploration time, climate protection, transfer/drop/body recovery, invalid records, finite initial stock, map issue, campaign return/reentry, save loading, and public-state privacy.
- The existing capture/rescue test also verifies exact outfit condition and identity through custody and release.
- Live production UI: depot withdrawal reduced stock by one; map stow/equip and full save/load succeeded. Tactical stow changed the outfit slot to empty and occupied a second large pocket. Wearing one again freed that pocket. Two exploration clothing changes advanced the clock from 6 to 8 seconds while Inés retained 95 AP. Campaign/battle save loading retained the worn poncho and one spare.
- The complete isolated gameplay suite passes 1,502 tests. Type checking, the production build, and static export pass (278 files and 189 asset references). The standalone fresh northern route reaches Yatasto and verifies every saved checkpoint.

## Campaign effects

Removing free assault protection changes later combat outcomes. The stationed-artillery fixture now uses legal reserve withdrawals and equips real garments before marching. It still verifies an actual victory and persistent guns.

The fresh seed-8 reference route keeps the opening victories, Córdoba victory, and Tucumán defeat. The rescue succeeds in eight turns and 98 actions; Farías dies. The two surviving doctors stabilize the captives with two dressings. Nine dressings are recovered and the medical courier buys 30 more for 900 pesos. Recovery finishes at hour 179.

The next assault hires Montreuil to replace Farías. Two paid squads capture Salta in five turns and 128 actions. A further soldier, Leiva, dies; Soria bleeds and Arnaud survives with critical health. The surviving doctors treat them before the northern pact and Yatasto. The route reaches phase 3 at hour 217, second 1235, with 2187 pesos and ten permanent deaths. Arnaud remains at 7 HP and needs further care. This is evidence through Yatasto, not a completed winning campaign.
