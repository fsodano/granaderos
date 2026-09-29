# Choose a ground supply bundle and quantity

Runtime/test source: `d68ce4104b96e53888f2696d2a5933b50055f8d7`.

The ordinary field collection control opens a supply picker for a nearby loose
bundle of priming, flints, rations, torches, dressings or bolas. The picker lists
the available bundles on that cell and lets the player choose one and an exact
whole quantity. Eight combat AP or one exploration second moves only that amount.
Other bundles and the uncollected remainder stay in place. Full saves, ordinary
campaign exit and reentry retain both holders and every remainder.

The picker shows actual stock, carried quantity and cost. Its shared preflight
checks availability, adjacency, walls/furniture/closed corners, quantities,
receiving numeric bounds and AP before mutation. A whole bundle that exceeds
the receiving bound can be reduced to a valid partial selection. Missing,
empty, entangled and container-held records are not free ground supplies. A
legacy order without a quantity still takes the entire available bundle.

Opening and canceling spend nothing. The ordinary exploration interval pauses
while the picker is open. Tactical shortcuts do not issue orders through the
dialog; Escape closes it and Tab stays among its enabled controls. The first
selector receives focus and closing restores the previous connected control.
A failed current order leaves the picker available for correction.

## Verification

Four simulations and three mounted production-game checks pass **7/7**; the
related supply and held/stored weapon collection group passes **32/32**. Complete
regression passes **1200/1200**, zero failures or skips, in 272,345 ms. Types,
production export (722 files, 632 asset references), 36 reference comparisons
and documentation audit (259 requirements, 98 evidence records) pass.

The paid campaign fixture drops four authored dressings, collects one with a
different soldier, saves and revisits, collects two, and saves/revisits again.
The actual holder keeps three and the field keeps one. Prepared boundaries
check all six supplies, exact AP/time, omitted quantity compatibility, invalid
or stale stock, null/fractional amounts, held/container records, blocked contact,
ambiguous sources and receiving bounds. Reducing an excessive whole selection
transfers only the accepted quantity without clipping or deleting the remainder.

The mounted Home flow chooses between two actually dropped colocated bundles,
changes quantity and checks the saved untouched bundle and partial remainder.
Another check runs the normal exploration interval for more than six seconds
with the dialog open, verifies no clock/state change, and closes through Escape
and Cancel without cost. A prepared numeric-bound case reduces three priming
charges to one through normal controls and retains the other two on the field.
The existing whole-bundle mounted flow now confirms the normal picker. An
explicit DOM element cast resolved the project's selector typing conflict; the
final type check uses the same runtime behavior.

This picker covers loose personal supply bundles, not whole body/container or
weapon inventories, multi-item batches, automatic walking, cartridge ground
custody or physical pockets. These are mounted DOM and simulation checks, not
live-browser, performance or full-campaign acceptance. Exact-head CI remains
required before publication.
