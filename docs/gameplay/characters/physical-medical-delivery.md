# Physical medical delivery at Tucumán

The Ciudadela officer offers **Vendas para la Ciudadela** after the player reaches the local contact. The errand requires three carried dressings. Select a dressing pocket, choose its quantity and offer it to the officer. The ordinary movement, visibility, availability and paid interaction rules apply. Using a dressing as treatment remains a separate action.

One delivery can contain several dressings, up to the remaining requirement. Excess quantities and wrong supplies are refused without transferring ownership. Accepted quantities leave the soldier's pack and remain in the officer's validated receipts. The first accepted dressing starts the errand. The third completes it when Tucumán is secured and applies the existing local quest loyalty reward once. This does not debit remote stock or pay a cash reward.

Partial and complete receipts survive tactical saves, campaign return and reentry. The notebook shows acknowledged dressing quantities and the remaining delivery instruction. Existing contact-death failure rules also apply to this accepted errand.

## Verification

- Three simulation cases cover paid carried supplies, actual movement and offers, partial delivery, excessive and wrong offers, exact pack debits, full saves, return/reentry, one-time rewards and malformed receipts. The contact-death case checks both partial and completed delivery: unfinished work fails permanently, completed rewards remain credited, physical receipts survive full saves, repeated synchronization adds no duplicate failure notice, and a save that deletes acknowledged receipts is rejected.
- The integrated suite passes **2,561/2,561 tests with no skips**, including the added contact-death and saved-receipt checks.
- A component check verifies the dressing label, quantity and instruction.
- All 49 focused quest, gift, settlement and notebook checks pass. Type checking and the production build pass.
- The delivery fixture starts with Tucumán secured and the paid medic present. It verifies this interaction, not a fresh campaign conquest. Live pointer interaction now passes in the same established-sector fixture: select one dressing, hand it to the officer, select four and receive a refusal, return them with Escape, then select and deliver the remaining two. The inventory falls from seven dressings to four. Reloading, continuing, returning to the campaign and opening the notebook retain **Cumplido** and **Vendas entregadas: 3/3**. Tucumán shows 73% loyalty from its fixture start of 65%. The campaign log records one completion. Camera centering was needed to bring the imported courier and recipient into the visible field.

The powder and cavalry bulk errands still consume campaign resources. Escort, prison and alternative-resolution mechanics remain separate audit gaps.
