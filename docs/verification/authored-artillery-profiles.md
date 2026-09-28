# Authored artillery models and images

Runtime/test source: `fb49f84e6787bc73737a949bd6d0a60282fcf181`.

**Armas → Artillería** edits the three supported gun families. Each model has its
own name, uploaded image, purchase price, required crew, firing/loading/movement/
pivot AP, range, damage, canister scale, solid-shot penetration, initial loaded
state and initial reserve. The panel searches model names, validates every field,
restores defaults and participates in the editor's existing undo/redo and launch
flow. It edits the fixed three families; it does not create a fourth gun type.

The campaign pins optional `artilleryProfiles` to its package. Older packages
omit it and retain their content identity and existing behavior. Edited prices
including zero govern actual purchases. Deployment issues the configured initial
load and reserve once, then retains the physical gun's remaining ammunition.
Changing the editor draft cannot alter a launched campaign. Enemy and militia
artillery use the same pinned model and actual crew/action rules.

The armory, battery selectors, tactical selector and battlefield use the edited
name/image. The field picture is the authored inventory/model image in the existing
cannon display; this feature does not generate directional firing animations.
Uploaded PNG/JPEG/WebP images accept up to 250 KB. Saved tactical definitions
reference the immutable campaign package, so the uploaded image is serialized
once instead of once per deployment and retained sector. Full inline definitions
also validate. Foreign references, malformed profiles and mismatched tactical
reports/saves reject instead of changing the campaign's gun rules.

## Field bounds and behavior

Names accept 1–80 characters, prices 0–1,000,000 pesos and crews 1–6 people.
Firing, dragging and pivoting accept 1–100 AP per artillerist. Loading accepts
1–300 AP and can span real turns. Range accepts 1–200 cells, damage 1–300,
canister scale 1–20 and penetration 0–10. Initial reserves accept 0–1,000 rounds;
an independently configured checkbox decides whether the delivered gun is loaded.
These are authoring limits and Granaderos tuning, not historical claims.

The canister scale determines its existing cone, up to twice that scale in range.
Solid-shot penetration is consumed by people and walls. Authoring does not replace
the underlying trajectory/morale rules. Resupply permission, price per shot and
reserve cap remain under **Reglas**. The editor explains that the cap does not
remove existing rounds or override each model's one-time purchase allowance.

## Verification

Eight simulations and three mounted checks pass. Complete regression passes
**1084/1084**, zero failures or skips (242,633.821 ms), on the source above.
Types, production export (722 files, 632 asset references), all 36 reference
comparisons and the documentation audit (242 requirements, 81 evidence records)
pass. Exact-head CI remains required before publication.

The initial full run on `53b0a6c852996429da3cb1384a091406322f3dec` passed
1083 and failed one existing armory display assertion: a default name changed
capitalization. The final code preserves the original catalog label when a
campaign does not author a profile. Both the existing emplacement panel and new
field-image mounted checks pass unchanged, followed by the full run above.

The simulations verify optional compatibility and strict field bounds; all three
actual purchase prices; paid attack deployment with configured finite load;
compact paired-save references; rejected altered reports and references; real
crew costs, partial loading and next-turn continuation; changed range, damage,
penetration and canister effects; an actual enemy phase using an edited crew size;
and a purchased gun retained through an actual established-area victory, ordinary
firing, campaign return and saved reentry. Prepared tactical boundaries isolate
ballistics and action costs; they are not broader campaign-balance acceptance.

The mounted editor changes every model field, searches, uploads/restores an image,
undoes/redoes/reset changes, rejects invalid crew counts and launches a pinned
campaign used for an actual purchase and attack entry. The mounted armory displays
and charges the authored model. Production Home restores a real paired attack
save and displays the edited field image and selector name. These are DOM checks,
not live-browser or loaded-performance acceptance.

## Remaining work

Artillery transport/recovery, dealer stock/trade, additional gun families, separate
solid/canister reserve types and directional artillery animation remain separate.
The overall equipment, artillery and story-editor requirements remain partial.
