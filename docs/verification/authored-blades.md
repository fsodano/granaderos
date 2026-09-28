# Authored melee weapons

The weapon catalogue supports the five existing blade families as well as its nine
firearm families. Authors create named variants, set an image, damage, attack AP,
reach (1–4 tiles, including decimals), weight and price, and assign them to a
character's primary or secondary blade slot. Family choice retains the published
special techniques. Bayonet interception also consumes its edited AP and uses its
edited damage and reach. Ordinary attacks, charge endpoints, counters and enemy
melee read the same definition.

Variants have separate shop prices and stored instances. Buying, armory exchanges,
tactical inventory exchanges and campaign returns preserve identity and condition.
A primary blade taken from a corpse can be equipped in either slot. The secondary
slot does not overwrite the primary definition. Switching active hands does not
change authored equipment weight. The dossier, shop, backpack and both hand images
use the actual definition. Uploaded images remain pinned package references in
saves; altered definitions, wrong families and ammunition in a blade are rejected.

New content includes the original five blades and assigns each character its
original blade family. Old packages without these entries/assignments keep their
numeric secondary equipment and original shop entries. The San Lorenzo ally uses
an explicit authored blade assignment. This checks the ally's equipment and save,
not the entire battle or campaign route.

## Verification

Runtime source: `9574d6f73b59bff42904fe70b3e7d8252de2ee84`.
The first full run at `5844a77` passed 697 tests and failed one legacy HUD
compatibility assertion. The fix preserves the original blade read model when no
authored definition exists. All 13 focused compatibility checks passed.
The final full suite passed **698/698 tests**, with zero failures or skips
(184986 ms). Types, production export (721 files, 631 asset references), all
36 numerical baseline checks and the documentation audit passed. The register
retains 185 requirements and 24 evidence records. Exact-head CI is required
before merge.

- `tests/content-blades.test.mjs`: edited AP/damage/reach in both slots, stable
  weight, family knockdown, actual enemy phase and bayonet interception, separate
  prices/stock, exchanges and condition, saved campaign return/re-entry, actual
  primary corpse loot, image compression, tampering, old packages and ally gear.
  Campaign return begins with prepared recovered equipment. The corpse-loot check
  is a separate compact battle; neither is a complete campaign route.
- `tests/story-editor.test.mjs`: blade creation, family/image preview, decimal
  reach, undo/redo, assignment, character copy, deletion protection, campaign
  launch, actual shop purchase and visible equipped identity. Existing firearm
  upload and launch coverage remains in the suite.
- `tests/content-blades-ui.test.mjs`: actual mounted Home inventory, authored
  secondary image, hand change and exact active autosave.

## Limits

BLADE-01 is bounded; ITEM-01 and STORY-06 remain partial. NPC civilian inventory,
secondary corpse looting, generic troop blade assignments, blade wear, editable
family techniques, attachments, ammunition, artillery and merchant stock rules are
separate work. The shooting range still requires a firearm. Secondary authored
weight is counted; the older numeric secondary loadout retains its legacy weight
accounting. The legacy fallback bayonet/unarmed model and full two-hand item parity
are not closed by this delivery. No live-browser, full campaign, final ending or
loaded-battle performance acceptance is claimed.
