# Shared inventory pockets

This focused checkout resumes the interrupted shared-pocket work from task
`01a0e2c0-642e-7f51-8f7c-225c4e286cd9`. Its base is
`45bcc53861e3891fec40058c862cb256e7912478` (the merged walking timing fix).
The advanced checkout and its port 3000 build are separate.

Weapons, loose cartridges and the six personal supply types now share four large
and eight small pockets. The selected weapon stays in the hand; the other owned
weapon needs pocket space. Quantities and weapon metadata remain in their original
save records. Pocket positions are saved separately and never create extra items.

Collection takes only what fits and leaves the remainder in the body or on the
ground. Explicit quantities and transfers reject when there is insufficient room.
Rejected actions preserve items, action points, time and random state. Campaign
purchases use the same capacity check. Deployment charges only for issued rounds
that fit, including the loaded firearm.

Older overfilled saves retain every item. The excess is visible and can be dropped
or transferred; it does not permit further collection. The selected hand and pocket
positions survive active saves, return to campaign and sector re-entry.

The inventory uses a desktop panel with one pocket grid and a selected-item detail
panel. Moving a stack uses ordinary pocket controls. Once an item leaves the
selected slot, its details clear rather than selecting a different object.
The user explicitly requested desktop only. No responsive layout is included in
this change. Existing unrelated screen-size rules are outside this work.

Verification on source `9ee4e28add5dc0e275b6f311deab38466ec0ab09` passes all **1268/1268 tests**,
with zero failures or skips. Types, production export (723 files / 633 asset
references), all 36 reference-data comparisons and the documentation audit pass.
The desktop browser check at 1280 x 720 shows all 12 pockets, no missing inventory
images, no horizontal page overflow and no console errors. Moving two dressings
from small pocket five to large pocket four succeeds through ordinary controls.
Exact source hashes and log checksums are recorded in the companion [evidence file](../evidence/shared-inventory-pockets.json).

This change does not establish full JA2 inventory parity, complete campaign
acceptance, smoother walking artwork or sustained 60 FPS. Fittings, typed ammunition,
civilian weapon ownership and the advanced checkout integration remain separate.
