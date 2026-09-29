# Authored firearm stock attacks

Runtime/test source: `49d1ac3997976025d4a2242f5dcfee7c3d3181aa`.

The normal weapon editor exposes stock AP, base injury and contact reach for
firearms. Optional `stockAP`, `stockDamage` and `stockReach` fields override the
existing 16 AP, 18 injury and 1.5-cell defaults independently. AP and injury must
be whole values from 1 to 100; reach must be from 1 to 1.5 cells. These are author
choices and Granaderos defaults, not historical numerical certification.

An older pinned gun keeps its exact definition shape. Missing optional values
use the defaults at execution, without rewriting saved content. A blade cannot
carry these firearm-only fields. Invalid authored and forged pinned definitions
are rejected. An authored strike still applies existing momentum, protection,
counterattack and wound rules. It does not consume cartridges or add another
weapon. Physical bayonet attachments and separate blunt accuracy/breath rules
remain open.

## Verification

The complete regression passes **1214/1214**, zero failures or skips, in
305,642 ms. Four new simulations and one mounted production editor check cover
custom and partial profiles, old pinned definitions, invalid fields, a narrower
contact distance, exact AP, weapon mass and ammunition. The affected authored
and secondary-weapon group passes **10/10** after the inherited blade fixture
was corrected to select its actual owned weapon. Types, production export
(722 files, 632 asset references), 36 reference comparisons and documentation
audit (262 requirements, 101 evidence records) pass.
Exact-head CI remains required before publication.

The mounted editor changes all three values, uses undo/redo, rejects invalid
values and launches the authored package. A real paid gun uses 23 AP for its
stock strike. A separate actual campaign route retains its configured 9 base
injury and 1-cell reach after a strike, ground drop, recovery, equip and full
saved campaign return. No stock damage is inferred only from editor text.

These are simulations and mounted DOM checks. They do not establish live-browser
acceptance, loaded frame rate, all-seed balance or completion of the game.
