# Equipped sprite variants

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../verification/published-progress.md) for the main branch baseline.

Status: implementation in progress. Equipment classification exists; the
renderer still uses the existing family artwork. Programmatic edits were approved
by the user. The first weapon-removal prototype is review-only and has not been
published. Classification tests do not
prove that the four visible weapon variants are available.

The 2026-09-22 blade candidates also failed review. Grid counts, facing
directions, grips or blade visibility were incorrect. See
`assets/previews/equipped-sprites/blade-generation-review.json` for retained
prompts and candidate files. These images were not added to the runtime atlas.

## Contract

- Standing, crouched and mounted characters use the selected main-hand item:
  long gun, short gun, blade, or bare hands.
- Pistols 1805, 1806 and 1808 use the short-gun category. The other authored
  firearms use the long-gun category.
- Sabres, knives and loose bayonets use the blade category. The existing lance
  also classifies as a melee weapon; its distinct polearm artwork is not yet
  covered by these four categories.
- A weapon carried in another slot does not determine the action silhouette.
- Tools, medical equipment and throwables use the bare-hand body pose rather
  than retaining a rifle. Their contextual effects remain separate.
- Prone firearm and prone unarmed movement artwork remain unchanged.
- A prone character must stand before a blade or bare-hand attack. The gameplay
  planner must validate the combined preparation and attack cost before changing
  state. Insufficient action points must not cause a partial attack.
- Dead and unconscious states retain their existing life-state priority.

## Art acceptance

Preserve each family's approved idle face, proportions and clothing. A weapon
swap must also update hands, weapon occlusion and muzzle effects where needed;
renaming an atlas or drawing a pistol over an existing rifle is not a correction.
Base art and skin masks must stay aligned in every direction and frame.

Review standing, crouched and mounted idle, movement and applicable actions for
all eight family appearances. Gun firing/reloading must not be used for blade
or bare-hand attacks. Include crouched blade and bare-hand attacks in the review.
Verify the actual game with Dorrego's pistol, a long gun, a sabre/knife and empty
hands before marking this work complete.
