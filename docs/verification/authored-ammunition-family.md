# Weapon ammunition selection in the story editor

A firearm definition can select one of the four published ammunition families.
The optional `ammunitionFamily` value is stored with the pinned weapon definition.
The default remains the original family of its firearm template. Older packages
and inline saves do not gain a new property or change their identity.

In **Armas → Munición compatible → Familia de munición**, choose the family or
**Original**. Undo and redo preserve the choice. Launching a campaign pins it;
later draft changes do not change that campaign. Blades cannot define ammunition.
Unknown families and altered saved definitions are rejected. Strategic militia,
trainees, mission allies and pending deployment records also validate typed
reserves before restoration can normalize them. Missing totals, unknown types,
negative or fractional quantities and mismatched totals are rejected. Validation
checks the known ammunition owners, not arbitrary inventory keys.

Deployment, compatible reserve display, reload, ground recovery and weapon
inventory use the authored family. Fresh enemy troops receive the family of
their authored firearm. Changing or collecting a gun does not convert the
ammunition already carried by its owner. Dropped guns keep their definition.

## Verification

Final runtime source: `e29bca955c048df91943a45348720fa971e8ae73`. Publication is tracked in [PR #132](https://github.com/fsodano/granaderos/pull/132).

- Four new simulations cover every selectable family, consumption of compatible
  stock only, wrong-family rejection, old definitions, invalid input, pinned-save
  protection, actual paid deployment, enemy issue, drops and recovered weapons.
- Two additional save tests reproduce the earlier unchecked militia map, reject
  malformed retained/deployment reserves and preserve valid mixed stock and old
  scalar saves. A legitimate inventory entry named `ammunition` also survives.
- One mounted editor test covers select, undo, redo, restore-original, real campaign
  launch, paid arrival and deployment, saved ammunition, later draft isolation and
  preservation of the ordinary campaign save.
- Types, production export (735 files, 637 asset references) and all 36 reference
  comparisons pass. The complete regression on `b8d269b688df6d99bdc2f6f6f11b33155a25546a` passes
  **1289/1289**, with zero failures or skips. The final validator scope correction
  passes all 26 related tests; the complete remote suite gates the final PR head.
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

Final publication: PR #132 merged at `01364bbdf99f9057d7871370b12b92c60e5b04e7`.
All five [remote checks](https://github.com/fsodano/granaderos/actions/runs/36612467413)
passed for `ca374364ddf6dcce85db78ffedb39ee61f81831a`. The complete four gameplay
groups total **1,289/1,289**, with no failures or skips. Runner preflight cases
are excluded from that count.

Follow-up: [alternative firearm loads](alternate-firearm-loads.md) implements
multiple existing families per firearm. Earlier limits above describe this
document’s original delivery; the advanced inventory adapter remains separate.
