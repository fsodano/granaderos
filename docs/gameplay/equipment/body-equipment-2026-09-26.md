# Body equipment in the main campaign — 2026-09-26

The shared outfit system now has head, torso and leg slots. `outfit` remains the
saved torso field, so old ponchos retain their existing meaning. `headwear` and
`legwear` contain separate exact garment records. Missing fields in older saves
mean empty slots, not free replacement equipment.

New recruits receive a felt hat and campaign trousers with their initial service
kit. Ponchos still consume the existing finite depot stock. Repeated initial
issue calls do not replace clothing after it has been removed. These garments
have weight and condition; no new armor protection or clothing sprite variants
are claimed.

Both inventory screens use the same body-slot component and equipment cursor.
Garments may be taken, held, exchanged, packed or dropped as ordinary items.
They need a large pocket and cannot be combined. The garment type must match the
body slot; a hat cannot be worn on the torso. The redundant stow-clothing button
was removed. Existing direct outfit orders remain compatible.

Weight, corpse inventory, campaign return, prisoner escape custody, item identity
validation and player-visible state include all three slots. Clothing still uses
the existing equipment action costs and timing. Stored records retain condition
and identity. Invalid placement must not consume or overwrite an item.

## Verification

- 180 focused tests passed, covering outfits, cursor placement and cancellation,
  campaign equipment, save validation, prisoner equipment, HUD rendering and main
  campaign entry.
- New integration coverage recruits normally, packs the hat, saves, deploys,
  wears it through the tactical cursor, saves again, returns and reenters.
- Incompatible slots, duplicate garment identities and malformed saved clothing
  are rejected. Older missing body fields load as empty.
- On the normal `localhost:3000/?qa=1` page, imported a campaign produced through
  public recruitment and sector-entry actions. The main equipment screen showed
  Cabeza, Torso and Piernas. Moved the hat to large pocket 4 and back. Moved the
  trousers to pocket 4, reloaded, continued the campaign and reopened equipment:
  the leg slot remained empty and the trousers remained in that exact pocket.
- Visually reviewed the compact equipment screen. Browser warnings/errors were
  empty. The separate QA save key preserved the normal user save.

Remaining broader requirements include held-weapon artwork, full loaded-scene
60 FPS validation and a completed campaign route under the new enemy scaling.

Follow-up coverage verifies worn hat and trouser identities and 47% condition
through transfer, ground drop/recovery and corpse loot. Each garment leaves its
previous owner, appears once at its destination, and passes battle validation.
The complete current-tree audit is recorded separately in
`docs/verification/current-worktree-regressions-2026-09-26.md`; it found unresolved route and
presentation checks outside the focused body-equipment suite.
