# Local equipment exchange

The armory's **Intercambiar equipo** control accepts an offer from both sides and settles one cash difference. A player can exchange goods even when neither participant can afford the two separate purchases. JA2's `PerformTransaction` compares the player's offered value against dealer goods and checks the dealer's available cash against the change owed; see [ShopKeeper_Interface.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/ShopKeeper_Interface.cc). The period workshop inventory, prices and limits remain Granaderos adaptations.

## Player flow

Choose equipment to deliver and receive, set quantities, and add each line to the proposal. The proposal shows both totals and the cash payment or payout. Removing lines or cancelling changes no campaign state. Confirmation transfers everything together. The draft is local UI state, clears when leaving the workshop, and is not a saved equipment custodian.

Supported offers are unequipped stored handheld weapons, exact local used weapons, local new catalog goods, and all artillery sources supported by workshop trading. Used weapons retain condition, ignition faults, identity, fittings and loading. Cannon crew, local ownership, supply and safety rules still apply. Imports stay separate because they originate with the Ensenada merchant and follow the shipment contract. Ammunition, medical supplies, repairs and NPC gifts retain their existing separate controls.

## Transaction rules

- The [local buying preference](merchant-preferences.md), 80% used purchase and catalog prices determine the exchange. This adds no price bargaining or favorable exchange multiplier.
- Only the net cash difference is required. Final player, merchant and storage balances must be valid. Outgoing goods free capacity for incoming goods during the same exchange.
- Each selected offer carries its exact current record, price and available quantity as a receipt. A changed item or stock count requires reselection. Missing, repeated, remote or invalid lines reject the entire exchange.
- Catalog quantities are removed once. Exact weapon and cannon records move between custodians; buying does not repair or refill them. A new cannon retains the existing deployment ammunition allowance, without duplicating its stock count.
- There are at most 100 distinct lines and 100 units per line. The existing inventory limits still apply to the resulting inventories. Direct one-item buy/sell actions retain their original cash and capacity checks.

## Evidence and boundaries

Eight transaction/save cases cover a cashless exchange, a net payment, a net payout funded by artillery, stale or malformed offers, full merchant storage, multiple undeployed pieces, a fitted loaded musket, and crew/cash refusal without partial changes. Two render cases cover actual armory integration, named controls and local catalog scope. Related buyback/artillery cases run alongside these checks.

In a separate live QA fixture, treasury and merchant cash both started at zero. Cancelling a draft kept two player carbines and one shop carbine. Offering both player carbines at 72 pesos each paid for the shop carbine at 144. Confirmation and reload retained zero cash on both sides, one player weapon and two shop weapons. The fixture isolates trading and is not campaign-completion evidence.

[Workshop preferences](merchant-preferences.md) now change the sale price and can refuse damaged handhelds. Background sales to other customers, cross-merchant exchanges and negotiation dialogue remain outside this implementation. The broader gameplay audit remains open.
