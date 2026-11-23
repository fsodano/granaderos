# Slice 49: aimed-shot rules belong to the domain

An aimed shot needs one rule owner for target eligibility, available body
regions, each region's label and profile, its range-based aiming penalty, and
its effects. These decisions are shared by the tactical interface, combat
validation, and tactical AI.

## Domain rule

[`targeted-combat.ts`](../../../../packages/game/domain/combat/targeted-combat.ts)
owns the aimed-shot rules. `canChooseShotLocation` decides whether a target may
be aimed at a body region. `shotLocationsFor` returns the available choices; a
target that fails the eligibility check exposes only the torso option.
`getHitLocationProfile` returns a region's modifiers with its label.
`shotLocationPenalty` calculates the region's penalty at a range, and
`shotLocationEffects` derives the impact from the selected region.

The rule module uses [`BodyRegion`](../../../../packages/game/domain/combat/body-region.ts)
for region profiles, aiming penalties, and physical impact. A standing,
conscious target with health and energy can offer the torso, head, and legs;
a prone, unconscious, knocked-down, or depleted target offers only the torso.
The Spanish labels and region effects come from the same domain rules used to
validate and resolve the shot.

## Compatibility path

[`targeted-combat.js`](../../../../packages/game/targeted-combat.js) re-exports
the domain functions so existing callers can keep their import path. The root
module is a compatibility entry point; it does not own a second copy of the
aimed-shot rules.

The tests in
[`targeted-combat.test.ts`](../../../../packages/game/domain/combat/targeted-combat.test.ts)
cover target eligibility, available regions, labels and profiles, range
penalties, and region effects. If the interface, combat validator, and AI
calculated those choices independently, they could offer, reject, or resolve
different regions for the same target.
