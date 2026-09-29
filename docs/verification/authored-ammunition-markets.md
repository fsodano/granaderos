# Authored ammunition suppliers

This bounded delivery adds supplier rules to the published campaign runtime and
story editor. It starts from PR #135, main commit
`6772c1cb719d729ae2b6da27728ef88cfc60f5cc`. The advanced local physical inventory
adapter and alternative loads per firearm remain separate work.

Runtime and test source: `cd741d7263df639571f2e6239fabcd941199d220`.

[PR #136](https://github.com/fsodano/granaderos/pull/136) carries this delivery.

## Authoring and use

Open **Reglas → Proveedores de munición**. Select general rules or a town.
A town inherits the general rules until **Usar reglas propias en esta localidad**
is checked. This copies the general profile; later general edits do not change
that town. Uncheck it to restore inheritance. Undo, redo, JSON export/import and
**Restaurar proveedores de munición originales** use the ordinary editor flow.

Each profile controls supplier availability, automatic preparation purchases,
and the replenishment interval (1–720 supplied hours). Each of the four families
has initial stock, maximum stock, replenishment quantity and an optional unit
price. Null price inherits the campaign cartridge price. Zero price permits free
purchases; zero replenishment does not restore stock. Initial stock cannot exceed
the maximum. Quantities and prices are nonnegative integers up to 1,000,000.

Town choices require plausible land reception. Wilderness cells and mountain
passes do not gain suppliers. This restriction does not change character placement
or exact-cell personal stores. Disabled suppliers cannot sell or replenish.
Disabling automatic purchases still permits manual orders. Existing compatible
rounds can load in supplied controlled towns without buying; partial reload work
is preserved. Local stores and owned ammunition remain available under the normal
custody rules.

The optional package field is `ammunitionMarket: {defaults, locations}`. Every
profile contains `enabled`, `automaticPurchase`, `restockHours`, and `families`.
Every family contains `initial`, `capacity`, `replenish`, and nullable `price`.
The campaign pins the package. Later draft edits cannot reprice that campaign.
Packages without the field retain their identity and previous defaults.

Authored campaigns create finite town stock once at campaign initialization,
including empty suppliers. Only enabled, controlled, supplied time advances each
clock. Thus an empty supplier can replenish without a first purchase. Stock and
clock survive restoration; restoration does not reinitialize them. The default
profile preserves 180/60/180/120 stock, 18/6/18/12 replenishment and 24 hours.

## Verification and limits

Five focused runtime tests cover strict validation, unchanged old packages, town
price and stock overrides, actual purchases and deployments, initially empty
stock, free prices, paused clocks, caps, manual-only and disabled suppliers,
local storage, and save round trips. A mounted full editor test checks local
profile edits, validation, undo/redo, reset, independent general changes, launch,
paid purchases and replenishment through normal campaign orders.

The production browser preview checks town selection, editable stock and price,
and draft persistence. The current full-suite result and source hashes are in
[the evidence record](../evidence/authored-ammunition-markets.json).
All five checks at the final PR head must pass before merge. This record does not
close general merchant trading, alternative ammunition loads, advanced inventory
publication, or complete game/editor acceptance.
