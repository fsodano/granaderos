# Collect loose equipment beneath a resident

Runtime/test source: `bf7a3384e02e723360017606ddb103dd12335473`.

In collection mode, clicking a resident's figure now uses the same loose-ground
priority as clicking a soldier or cell. A dropped weapon remains collectible,
and a loose personal supply bundle opens its normal exact-quantity picker.
The resident's own health and supplies do not change. Once no free equipment
remains on that cell, an unconscious resident can still provide their own finite
supplies through the existing body action. Entangled and container-held records
do not conceal other free items or count as loose equipment.

## Verification

Three mounted production-game cases pass **3/3**; the related exact pickup and
weapon/supply placement group passes **13/13**. Complete regression passes **1203/1203**, zero failures or skips, in
275,195 ms. Types, production export (722 files, 632 asset references), 36
reference comparisons and documentation audit (260 requirements, 99 evidence
records) pass.

Each fixture uses actual paid arrivals, ordinary map entry and a real held or
supply drop. The resident's position is explicitly placed on the dropped-item
cell to test the overlap boundary; this is not evidence of the walking route
that brought the resident there. The normal field collection cursor and resident
figure recover the exact loaded gun or select two of three actual dressings.
Both checks read the normal persisted save and retain the resident's own stock.

The third case authors the resident's critical starting condition in the actual
content package. It collects the loose bundle, then uses the same figure to
collect the unconscious resident's actual supplies, while leaving entangled and
container-held records untouched. The initial fixture changed only the visible
health and was correctly rejected by the campaign consistency validator; it was
replaced with real authored initialization. No save restriction was relaxed.

This fixes access through an occupying resident. Full body/container selection,
weapon batch selection, automatic approach, physical pockets, performance and
complete campaign acceptance remain separate. These are mounted DOM checks,
not live-browser acceptance. Exact-head CI remains required before publication.
