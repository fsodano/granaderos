# Workshop buying preferences

In the campaign armory, workshop choice changes the price paid for player equipment and can change whether a damaged weapon is accepted. The shop profile is visible in the armory. Direct weapon sales, all artillery sale sources and combined exchanges use the same local buying rules. New catalog prices and the 80% used-purchase fraction remain unchanged.

| Workshop | Preferred equipment | Buying fraction of new value | Refusal |
| --- | --- | --- | --- |
| Retiro | General buyer | 40% | No positive service/recovery value |
| Caroya, Córdoba | Carbines, horse pistols, sabres, lances and facones (1803, 1805, 1809, 1810, 1812, 1813) | 50% preferred; 30% other equipment | Handheld host weapon below 25% condition |
| El Plumerillo, Mendoza | Bronze/heavy cannon and swivel guns | 50% artillery; 40% other equipment | No positive service/recovery value |

Handheld prices are multiplied by actual condition. An attached bayonet is valued separately at its own condition and local rate. Caroya checks the host weapon's condition for acceptance; a separately offered bayonet is itself the host. A refused assembly remains intact and can be repaired, separated through the existing equipment actions, or offered at another workshop. Artillery has no added condition system: its load and remaining rounds remain exact custody data, with no separate ammunition payment.

These roles, equipment groups, percentages and thresholds are **Granaderos balancing choices**, not historical market quotes or JA2 constants. The setting already identifies Caroya with cavalry blades and El Plumerillo with the army foundry. The gameplay reference is JA2's dealer-specific valuation and acceptance: `EvaluateInvSlot` reads the dealer's buying multiplier, and `WillShopKeeperRejectObjectsFromPlayer` consults `CanDealerTransactItem` in [ShopKeeper_Interface.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/ShopKeeper_Interface.cc).

Local funds, supply, crew, shop capacity, item condition and normal ownership checks still apply. An exchange receipt from another town cannot retain the earlier quote. Refusal does not destroy an item or change cash. Existing saves preserve all exact equipment and merchant stock; current profiles apply when a new quote is requested. Every buying fraction is below the used-purchase fraction, preventing profit from simply buying an unchanged used item and selling it in another town.

## Boundaries

This does not add individual merchant relationships, negotiated prices, background sales to other customers or a campaign-wide demand economy.
