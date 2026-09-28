# Finite local artillery trading

Runtime/test source: `9aada7fe1a4e649112817832bf721534153c50ad`.

A controlled, supplied workshop can buy a local depot gun, a friendly local
emplacement or one unissued model from the existing armory stock. The active
squad must have available personnel there. An emplaced gun additionally needs
its complete authored crew. Pending scenes, capable known enemies, unavailable
people, loss of control or supply and insufficient workshop funds prevent sale.

Each successful sale transfers one exact piece into that workshop's inventory.
The shop keeps its identity, loaded charge, reserve ammunition, facing and
unfinished load. Selling unissued stock consumes one count and issues its authored
initial allowance once, with a new physical identity. A stock-count receipt
rejects stale offers. Merchant-held guns do not count toward the player's army.
Repurchase moves the same gun into the local depot; it does not restore generic
stock or grant ammunition. Both sides exchange the displayed pesos atomically.
Duplicate sales or purchases cannot replay either custody or payment.

The shop starts with 1,200 pesos when first used. It pays 40% of model price at
Retiro and other workshops, 30% at Córdoba and 50% at Mendoza, rounded down.
Repurchase costs 80%, rounded up. Ammo has no separate sale value. These are
Granaderos tuning, not historical quotations. The shop has room for 100 pieces;
the local depot retains its 2,000-piece limit. Cash and inventory persist across
saves. There is no periodic restock, cash reset or remote sale in this delivery.
Authored model prices and initial ammunition apply; merchant rates and starting
cash still use these fixed defaults.

The armory's **Comercio de piezas** section shows the workshop balance, each
sale or repurchase price, finite ammunition/work and the actual rejection reason.
The old global unissued armory abstraction remains. Local exact pieces and shops
have physical custody. This does not establish physical ownership for all weapons
or supplies. Stored guns still require a later separate delivery to be sent from
one depot to another; they can currently deploy into a neighboring attack.

## Verification

Six simulations and two mounted production-game checks pass **8/8**. The
transport, emplacement, profile and trading overlap passes **40/40**. Complete
regression passes **1111/1111**, zero failures or skips (273,114.954 ms), on the
source above. Types, production export (722 files, 632 asset references), all
36 reference comparisons and documentation validation (245 requirements,
84 evidence records) pass. The original 50 and parity 87 rows remain.

The main fixture buys a cannon, wins actual San Nicolás combat, fires an ordinary
shot, opens a configured workshop in Buenos Aires using its serving engineer,
transports the gun and travels there. Sale adds 160 pesos, repurchase spends 320,
and the shop changes from 1,200 to 1,040 to 1,360. Full saves, intervening squad
travel and actual Ensenada attack entry retain the unloaded gun and six reserves.
A separate real configured workshop at San Nicolás sells its field emplacement;
a declared 40% fraction isolates unfinished-work custody through repurchase and
actual Santa Fe entry. No combat outcome is assigned in either fixture.

All three purchased unissued models receive distinct identities. The authored
swivel allowance is unloaded with two reserves; resale, repurchase and actual
attack entry keep it. Prepared boundaries separately cover cash, crew, occupation,
supply, local threats, unavailable people, capacities, serial limits, local rates,
invalid saved money/load/orientation and duplicated custody. The initial test
fixtures attempted a non-neighbor attack and lacked funds to repurchase all three
models. They were corrected by configuring a valid local workshop and explicit
starting funds; engine restrictions were retained.

Mounted Home/Armory cases use the real controls to sell and repurchase an exact
depot gun, retain declared unfinished work, save both balances and reject a shop
with 159 pesos. These are mounted DOM and simulation checks, not live-browser,
campaign-balance or performance acceptance.

## Remaining work

Broader artillery, economy, item and integration requirements remain partial.
Merchant authoring, equipment-wide exchange, depot-to-depot shipping, advanced
logistics and physical supply ownership remain separate. The old
[development trading record](../gameplay/campaign/artillery-trade.md) describes a
larger development system and its dated evidence. Exact-head CI remains required
before publication.
