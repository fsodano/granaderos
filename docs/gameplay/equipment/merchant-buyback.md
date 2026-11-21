# Local used-weapon trading

In the campaign armory at a supplied friendly workshop, selling a stored handheld weapon transfers that exact item record to the local merchant's used stock so the player can buy it back later with its condition and fittings preserved. Classic JA2 transfers sold player objects into the dealer's inventory and removes purchased objects from that dealer. See [JA2 Stracciatella, ShopKeeper_Interface.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/ShopKeeper_Interface.cc), `MovePlayerOfferedItemsOfValueToArmsDealersInventory` and `RemoveItemFromDealersInventory`. This is gameplay reference material. The pricing and workshop model below are Granaderos adaptations.

## Ownership and purchase

Selling a stored handheld weapon now transfers its exact record from the campaign armory to the current workshop's used stock. The record retains its identity, model, condition, ignition failure, matching fitting pattern and mounted bayonet. The merchant still needs enough cash to pay the existing sale price. Only unequipped, stored weapons can be sold.

The Armory shows **Armas usadas del comerciante** for the current locality. Each offer identifies its condition, ignition failure, mounted fitting and price. Buying transfers that exact record back to the armory and removes the offer. It does not repair it, replenish ammunition, change a fitting, create an import shipment or consume a unit of the ordinary new-weapon catalogue. Campaign ammunition continues to use the existing separate stock and deployment-allocation rules; this change does not claim independent hand loading between deployments.

New weapons and used weapons remain separate inventories. Used stock is not replenished by the daily catalogue refresh and is not moved between workshops. Buying or selling requires the same friendly, supplied, local workshop and absence of an active deployment as existing trading. An exact offer ID and its locality are checked again when the purchase is submitted. Money, local stock and the armory roll back together on a rejected order.

## Explicit tuning

- The merchant's purchase from the player follows its [local buying preference](merchant-preferences.md), adjusted for each component's condition. Retiro retains the general 40% rate; Caroya can refuse badly damaged handhelds.
- The player's used purchase costs 80% of new value, adjusted for each component's condition. Each component is rounded down separately. There is no profitable immediate sell/buy cycle.
- Each merchant can retain at most 1,000 used weapons; a full merchant refuses further sales. The existing 10,000-item armory limit also applies to used purchases.
- Used weapons remain available until the player buys them. Background sales to third parties are unsupported. [Workshop preferences](merchant-preferences.md) supply local valuation and condition-based refusal. [Equipment exchange](merchant-exchange.md) supports a combined net payment, and artillery trading retains exact gun custody.

## Saved used stock

Ownership validation counts merchant-held weapons and fittings as physical items. Missing used-stock fields in older saves mean an empty list; historical sales are not reconstructed. Worn and fitted weapon metadata, capacity rejection and duplicate identity protection apply to every purchase and sale.
