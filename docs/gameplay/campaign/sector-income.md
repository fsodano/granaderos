# Loyalty and local income

Each controlled sector's daily contribution now equals its economic base multiplied by local loyalty / 100. Damage retains one quarter of that result; a coastal blockade retains one quarter; a cut supply route retains one half. These reductions multiply, and the final contribution is rounded down once. Royalist sectors contribute nothing.

At midnight, politics is resolved first. All contributions are then calculated from the same state and paid once. The existing one-point loyalty recovery in supplied patriotic sectors occurs after payment and affects later income. A damage expiry at that hour is already effective. Current map figures are current rates, not a guaranteed future payment.

The selected-sector panel shows its base, local loyalty, contribution and disruptions. The map's Resources view lists the same calculation for all thirteen economic sectors and a total before expenses. Visual city districts never generate additional income. City-wide quest and battle loyalty events and local requisition losses now change the following contributions. The existing loyalty and campaign clock fields suffice for saved continuation; there is no extra income cache or payment ledger.

## Reference and adaptation

[JA2 Stracciatella's Strategic_Mines.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Strategic_Mines.cc) calculates the player's workforce from town loyalty and controlled town sectors, then scales mine extraction by that workforce. Patusco's guide, printed pages 59–60 and 69–70, links loyalty with mine revenue.

Granaderos retains its thirteen existing local contribution sources, one daily payment, local rather than averaged city loyalty, and existing damage/blockade/supply factors. These are game rules for the period adaptation, not historical tariff estimates or a copy of JA2's mineral extraction, depletion, head-miner dialogue or production shifts. At the initial 65% loyalty, the three starting sectors contribute 286 pesos per day instead of 440. Their economic base values are unchanged.

## Evidence

`sector-income.test.mjs` checks loyalty extremes, local independence, combined reductions, midnight ordering, passive recovery, damage expiry, supply loss, one-time quest rewards, an actual frontier requisition, and saved continuation before and after payment. The map's existing payout comparison uses the shared rule. Component tests check the selected-sector explanation and table total against the real campaign payment. This change has not had a live browser check or a complete campaign balance playthrough.

Validation: all 1,143 tests passed in the isolated gameplay checkout, including the existing opening campaign paths. Type checking and the production build also passed. This does not establish complete campaign balance. Concurrent art and recruitment edits were excluded and preserved.
