# Authored workshop funds and local artillery prices

Runtime/test source: `a9fcb41672e520a1928a9ba84447f77c55ea16f7`.

The story editor exposes **Reglas → Comercio de artillería**: trade permission,
one-time starting cash per workshop, a general buying percentage, a repurchase
percentage and named-locality buying overrides. Funds are whole pesos from zero
to 1,000,000; percentages are integers from zero to 100. Buying pays the model
price multiplied by its effective percentage and rounded down; repurchase rounds
up. Multiplication uses the integer percentage before division to avoid floating
point errors such as paying 28 instead of 29 pesos for 29% of a 100-peso model.

A local override applies only when a workshop exists there. It does not create
facilities. Defaults retain 1,200 starting pesos, 40% buying, 80% repurchase and
30/50% buying overrides in Córdoba/Mendoza. Removing an override restores the
general rate. The editor adds, relocates and removes overrides, prevents duplicate
locations, validates ranges and supports undo/redo, reset and pinned saved launch.
Optional omission keeps older packages unchanged.

A shop receives its configured cash only when first used. Later sales,
repurchases, saving and elapsed time preserve its actual balance. The armory
shows the effective local percentage, repurchase percentage and current funds.
Disabled or unaffordable trades preserve both balances and custody. Zero rates
allow free transfers. An author may make buying more generous than repurchase;
that subsidy spends the shop's finite cash until it can no longer buy. This is
explicit game tuning and cannot reset the shop's funds through repeated trades.
Campaign packages remain pinned when the editor draft changes.

Workshop access, crew, supply, local threats, fixed storage limits and exact-gun
ammunition/work remain as specified in [finite trading](finite-artillery-trading.md).
This does not configure all equipment merchants, shop locations, cash refresh,
restocking or physical supplies.

## Verification

Six simulations, one mounted editor case and one mounted production-armory case
pass **8/8**. The related trading/transport group passes **19/19**, plus the editor
case. Complete regression passes **1123/1123**, zero failures or skips, in
256,761 ms. Types, production export (722 files, 632 asset references),
36 baseline comparisons and the documentation audit pass.

A purchased/fired gun at a real configured Buenos Aires workshop uses 2,000
starting pesos, a 29% local buying override and 70% repurchase. Sale pays 116;
repurchase costs 280; the shop ends at 2,164 and retains that balance after a full
save and another hour. The same gun keeps its remaining charge and ammunition.
An actual Mendoza headquarters uses its authored 67% override instead of the old
50% default. Actual unissued purchases cover zero-price transfer, disabled trade,
insufficient starting cash and exact 29% rounding for 100/101-peso models.
A 100%/25% subsidy drains a 500-peso shop to 200 and rejects the next 400-peso
purchase. No funds or stock are manufactured.

The mounted editor authors funds and percentages, adds/relocates/removes local
rates, checks invalid values, undo/redo and reset, launches the package, buys a
real gun and performs saved sales/repurchases with its authored 29/63% rates.
The mounted Home/Armory displays and charges its actual 29/70% quote and updates
both balances. These are mounted DOM and simulation checks, not live-browser,
balance, historical-market or performance acceptance.

Broader story, equipment, economy and integration requirements remain partial.
Exact-head CI remains required before publication.
