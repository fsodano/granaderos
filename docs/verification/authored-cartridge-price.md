# Authored cartridge price and finite return value

Runtime/test source: `6beb6cdf4d028b839592d0d2902face825936fc7`.

The campaign rules editor can set an optional integer cartridge price from zero
to one million pesos. An absent price keeps the existing one-peso rule. The
original four rule fields remain required; the adapter does not add the new
field to older packages or alter their saved content identity. Resetting the
rules removes the optional price and restores the original funds and quantities.

The entry/assault quote and payment multiply the issued cartridge quantity by
the pinned campaign price. The pending deployment still records cartridges as
quantities; firearm capacity, reserve, enemy allocations and militia stock do not
become money values. The armory explains the actual price. Editing the draft does
not reprice a running campaign or its saved deployment.

Both sector departure and battle settlement convert the existing finite return
count with that same price. Actual discharged or lost rounds are not refunded.
Retained body/source limits and already-settled request rejection remain in
force. The refund helper keeps count accounting separate from currency and
rejects a credit beyond the one-billion-peso treasury limit before settlement.
Zero price is an explicit author choice; it does not create extra cartridges.
Blade primaries and zero allocations still issue none.

## Verification

Five simulations cover optional-field compatibility and content identity; strict
limits, round-trip and pinned save protection; real paid sector entry and saved
return without duplicate credit; a real paid assault, one actual discharge, an
active save and ordinary retreat refunding six of seven issued cartridges;
zero-price/blade behavior and unaffordable entry/assault atomic rejection; and
finite recovered-round bounds with an over-limit treasury credit rejection.
The assault fixture uses compact tactical geometry to isolate accounting, not a
full campaign route. The recovered-body and treasury-limit check is a prepared
accounting fixture, not a claim of a played loot route.

One mounted editor case checks defaults, undo/redo, empty and fractional input,
restoration, pinned launch and actual deployment. One mounted campaign case
checks the 28-peso entry control for seven cartridges at four pesos each, saved
charge, departure credit and re-entry. The five simulations pass; the filtered
three-case group overlaps the compatibility simulation and adds both mounted
cases. The eight existing rules/ammunition/control checks also passed before
adding the explicit refund-limit guard.

The complete runtime/test source passes **911/911 tests**, with zero failures
or skips (210,255.967 ms). Types, production export (722 files and 632 asset
references), all 36 baseline comparisons and the documentation audit (223
requirements, 62 evidence records, retaining all 50 original and 87 parity rows)
also pass. Exact-head GitHub CI also passed; see the publication record below.

## Limits

This is the campaign's shared cartridge unit price. It does not add ammunition
calibres, separate dealer prices, physical strategic cartridge custody, magazine
items, buyback discounts or artillery ammunition authoring. Mounted DOM and
simulation checks do not establish loaded-browser performance.

## Publication

[PR #85](https://github.com/fsodano/granaderos/pull/85) merged at
2026-09-28 16:39:50 UTC as `26580f24a6c6616ad638eadc1201664cc434ed46`.
[GitHub verification](https://github.com/fsodano/granaderos/actions/runs/36450580957/job/109024007924)
passed at 16:38:47 UTC for the exact PR head
`eeb567348892036425552979950307db97faaf8c`.
