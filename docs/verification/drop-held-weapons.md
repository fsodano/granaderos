# Leave held weapons on the field

Runtime/test source: `eb8d414db4a850e47016547a0f20dc9e5e01a2a6`.

The production inventory can leave the selected primary or secondary weapon at
the soldier's feet. The order costs four combat AP or one exploration second.
The selected empty slot becomes empty hands; dropping an inactive primary keeps
the selected secondary usable. Readiness and bracing clear. The piece moves once
and retains its authored definition, image, weight, loaded charge, unfinished
loading, wear and jam. Ordinary field collection, equip, full save and campaign
return preserve its actual state.

Carried weight includes an actual legacy secondary and the loaded charges in a
packed firearm. Empty secondary slots weigh nothing. Same-field drop, collection
and equip conserve weapon and charge quantities. Campaign settlement retains its
existing policy: surviving loose rounds return to treasury at the configured
cartridge price, while a dropped weapon keeps its own loaded charge. A later
attack with an empty primary receives no new cartridges. Full personal cartridge
custody across deployment remains a separate inventory requirement.

## Verification

Five simulations and one mounted production-game case pass **6/6**; the related
weapon, handover, empty-hand and HUD group passes **38/38**. Complete regression
passes **1169/1169**, zero failures or skips, in 269,966 ms. Types, production
export (722 files, 632 asset references), 36 reference comparisons and the
documentation audit (254 requirements, 93 evidence records) pass.

The primary fixture uses the actual paid attack and issued authored gun from the
finite opposing-equipment case. It drops the loaded gun while a real secondary
is selected, saves, retreats, returns, collects and equips the same piece. It
checks the actual loose-round treasury refund separately from the retained
loaded charge. The initial return assertion incorrectly expected refunded loose
rounds to remain carried. A second assertion ignored ordinary strategic income
during travel. The final checks assert the immediate refund, zero new cartridge
issue and the actual weapon/round quantities; campaign economics were unchanged.

An authored secondary with declared wear tests independent custody. A declared
partial, jammed and worn primary checks mechanism preservation. A legacy blade
checks exploration time and actual weight. Rejections cover ambiguous or missing
sources, unknown hands, enemy control, insufficient AP and repeated drops. The
mounted Home case operates the normal hand selector and drop button, reads the
persisted save, collects from the occupied cell and equips the same loaded gun
with its authored image. These are mounted DOM checks, not live-browser or
performance acceptance.

Loose supplies, arbitrary quantities, container selection, pockets, throwing and
full campaign acceptance remain open. Exact-head CI remains required before
publication.
