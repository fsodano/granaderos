# Finite secondary weapon recovery

Runtime/test source: `dac3f896ee53a5e69cb937f4db0270661a8dba52`.

Ordinary body collection now includes the soldier's actual secondary blade.
The existing selective order also accepts `item: "blade"`. Recovery costs the
same eight combat AP and requires the existing close range and incapacitation
rules. A blade moves once into carried inventory, with its pinned definition,
image, condition and other stored properties. The source has blade zero, no
stale secondary definition, no brace, and no selected empty secondary hand.
Repeated collection cannot manufacture another piece. A blade-only body remains
collectible after its other belongings are gone.

The HUD reports an empty secondary slot when it is empty. Existing production
inventory controls show the recovered authored name and image, equip it in
either supported slot and retain the displaced weapon. Tactical return and
campaign loading now admit an explicitly empty secondary slot. A surviving
militia member also keeps that empty slot in garrison storage. Later paid armory
replacement does not return the already recovered source piece to stock.

## Verification

Five simulations and one mounted production-game case pass **6/6**. The related
equipment group passes **27/27**. A final empty-HUD-slot assertion is included in
the full source commit. Complete regression passes **1137/1137**, zero failures
or skips, in 263,092 ms. Types, production export (722 files, 632 asset references),
36 baseline comparisons and the documentation audit (250 requirements,
89 evidence records) pass.

The main fixture starts an actual paid attack and uses its issued opposing
soldiers and authored weapons in declared compact positions. Actual melee kills
the first enemy while a distant second opponent keeps combat costs active. The
real loot control spends eight AP, transfers both slots, presents the blade's
name and picture, and equips it through the production inventory. Full saves,
retreat and reentry retain the empty source slot and the collector's weapon.
This is a bounded compact-geometry check, not a claimed full-map combat route.

Additional cases cover a blade-only body, repeated collection rejection, authored
unconscious paid arrivals, saved empty service slots, real paid replacement,
a declared wounded militia settlement, independent wear/definition, distance,
consciousness and insufficient AP. The initial fixture retained full-map patrol
coordinates after moving troops to compact terrain; save validation correctly
rejected it, and the declared positions were made consistent. A consciousness
rejection fixture now sets the matching derived condition. The first mounted
case opened the inventory before choosing body collection; it now uses the actual
field control, then opens the inventory to equip the recovered blade.

Civilian weapons/armour, conscious theft, complete physical custody, inventory
capacity/organization and unarmed/fitting combat rules remain separate. There
is no live-browser, performance or whole-campaign acceptance. Exact-head CI remains
required before publication.

## Publication

Published in [PR #112](https://github.com/fsodano/granaderos/pull/112) on 2026-09-29 00:37:12 UTC.
Exact head `d66674319b722d67a3f12d5332a5914bd814d9e9` passed [CI run 36503345324](https://github.com/fsodano/granaderos/actions/runs/36503345324), including the full suite, types and production build. Merge commit: `20b40c7fbf0cf200d2babfc4311215e2f31eb86a`. This publication does not close the broader game or campaign requirements.
