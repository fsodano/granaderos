# Drop and recover carried weapons

Runtime/test source: `f2176b48d9a7e53c7529fda4d5515329bde892e4`.

The production inventory can leave one recovered firearm or blade on the current
cell. It costs four combat AP or one exploration second. A stack loses exactly
one piece; an exhausted entry disappears from the backpack. The existing field
collection control recovers one loose weapon before inspecting an occupant, so
standing over the piece does not hide it. Ground supplies that remain entangled
with a soldier are not selectable as free equipment.

The piece retains its authored definition and image, weight, load, unfinished
reload, condition and jam. Full saves, sector settlement and return retain the
same state. Collection uses a unique carried key even when different fields use
the same local ground index. It cannot overwrite a previous field's weapon.
Invalid records, absent/depleted pieces, insufficient AP and the 2000-entry field
limit fail before custody or costs change. Saved drop quantities must represent
one piece; optional legacy weight/quantity fields remain readable.

## Verification

Six simulations and one mounted production-game case pass **7/7**; the related
weapon, HUD, save and campaign clock group passes **31/31**. Complete regression
passes **1144/1144**, zero failures or skips, in 264,705 ms. Types, production
export (722 files, 632 asset references), 36 baseline comparisons and the
documentation audit (251 requirements, 90 evidence records) pass.

The main fixture uses actual paid attack entry, authored opposing weapons and
actual melee death in explicitly compact geometry. It collects the secondary,
leaves it, saves, retreats, returns and equips the same piece. Another actual
recovered gun has explicitly prepared wear, jam and unfinished loading to test
mechanism preservation; these prepared values are not claimed firing history.
A declared two-piece stack checks quantity, weight and exploration time. A
prepared carried/ground key collision represents crossing between two fields.
Rejections preserve custody; full-save corruption checks cover quantity and
weight. The mounted production-game test operates the actual inventory button,
then the field collection control on the occupied cell, checks the image and
reads the normal persisted save.

The implementation does not add dropping held weapons, loose ammunition or
medical items, throwing or direct handoff, complete pocket capacity, global item
identities, live-browser interaction or performance acceptance. Broader physical
inventory and campaign requirements remain open. Exact-head CI remains required
before publication.
