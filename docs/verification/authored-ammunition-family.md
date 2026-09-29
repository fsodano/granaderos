# Weapon ammunition selection in the story editor

A firearm definition can select one of the four published ammunition families.
The optional `ammunitionFamily` value is stored with the pinned weapon definition.
The default remains the original family of its firearm template. Older packages
and inline saves do not gain a new property or change their identity.

In **Armas → Munición compatible → Familia de munición**, choose the family or
**Original**. Undo and redo preserve the choice. Launching a campaign pins it;
later draft changes do not change that campaign. Blades cannot define ammunition.
Unknown families and altered saved definitions are rejected.

Deployment, compatible reserve display, reload, ground recovery and weapon
inventory use the authored family. Fresh enemy troops receive the family of
their authored firearm. Changing or collecting a gun does not convert the
ammunition already carried by its owner. Dropped guns keep their definition.

## Verification

Runtime source: `f5ced0b8e5630754649600bd2faf06d4b980295a` (subsequent publication merges change documentation only).

- Four new simulations cover every selectable family, consumption of compatible
  stock only, wrong-family rejection, old definitions, invalid input, pinned-save
  protection, actual paid deployment, enemy issue, drops and recovered weapons.
- One mounted editor test covers select, undo, redo, restore-original, real campaign
  launch, paid arrival and deployment, saved ammunition, later draft isolation and
  preservation of the ordinary campaign save.
- Types, production export (735 files, 637 asset references) and all 36 reference
  comparisons pass. Full regression passes **1287/1287**, with zero failures or skips.
- The production browser on port 3134 shows the original musket family, accepts
  rifle ammunition and correctly restores both selections with undo and redo.
  The chosen family survives a page reload.
  No browser console errors. [Desktop capture](../evidence/authored-ammunition-family.png).

This allows one family per authored firearm. It does not add alternative loads
with different effects, new ammunition families, family-specific merchant prices,
strategic ammunition custody or integration with the advanced local checkout.
The broader equipment and story requirements remain open.

The [evidence record](../evidence/authored-ammunition-family.json) retains the
source and verification log hashes. Remote checks gate publication of this source.
