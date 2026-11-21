# Body equipment in the main campaign

Across the campaign equipment screen and tactical play (exploration and combat), the shared outfit system has head, torso and leg slots. `outfit` remains the
saved torso field, so old ponchos retain their existing meaning. `headwear` and
`legwear` contain separate exact garment records. Missing fields in older saves
mean empty slots, not free replacement equipment.

New recruits receive a felt hat and campaign trousers with their initial service
kit, including one personal poncho. Repeated initial
issue calls do not replace clothing after it has been removed. These garments
have weight and condition; no new armor protection or clothing sprite variants
are claimed.

Both inventory screens use the same body-slot component and equipment cursor.
Garments may be taken, held, exchanged, packed or dropped as ordinary items.
They need a large pocket and cannot be combined. The garment type must match the
body slot; a hat cannot be worn on the torso. The redundant stow-clothing button
was removed. Existing direct outfit orders remain compatible.

Weight, corpse inventory, campaign return, prisoner escape custody, item identity
validation and player-visible state include all three slots. Clothing uses the
existing equipment action costs and timing. Stored records retain condition
and identity. Invalid placement must not consume or overwrite an item.
Incompatible slots, duplicate garment identities and malformed saved clothing
are rejected; older missing body fields load as empty.

A garment leaves its previous owner and appears once at its destination through
transfer, ground drop or corpse loot.

The [garment-care rules](outfit-equipment.md#regional-wear-and-repair) cover
physical regional wear and finite carried repair, plus a torso linen shirt with a
finite [field-dressing recipe](field-dressings.md). Clothing still provides no new
ballistic armor or artwork.

Remaining broader requirements include held-weapon artwork, full loaded-scene
60 FPS validation and a completed campaign route under the enemy scaling.
