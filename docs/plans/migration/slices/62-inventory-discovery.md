# Slice 62: the discovery rule into the domain

**Branch:** `migration/inventory-discovery`
**Intent:** Move the rule that decides what the player knows about the ground
into the domain, beside the perception rules it belongs to.

## Why this slice exists

`packages/game/inventory-discovery.js` decides what the player has found on
the field: the loose equipment and dropped weapons they have seen, the bodies
they have come upon, and the chests they have opened. The comment states the
limit of what it grants: discovery survives losing sight, and it grants
knowledge of loose equipment, never of hidden bodies, living opponents' packs
or unopened containers.

The domain already owns what the player may perceive: `VisionObserver` holds
the condition and posture that determine perception, `VisibilityPolicy` the
range and posture rules, and `KnownSectorPolicy` what the player may know
about a sector.

What the domain cannot take is the question of what the observer can see
from where: that is the tactical simulation, so the retained module keeps
asking it and hands the answers to the domain.

## What it changes

- `packages/game/domain/perception/inventory-discovery.ts` holds the rule that
  decides what is found.
- `packages/game/inventory-discovery.js` keeps asking what the observers can
  see, and now calls the domain.

What the player finds does not change: the same items, the same weapons, the
same bodies and the same chests are marked as found.

## Tests

- `packages/game/domain/perception/inventory-discovery.test.ts` covers the rule:
  loose equipment in sight is found, equipment out of sight is not, a dropped
  weapon in sight is found, a body is found only at arm's length, and an open
  chest is found only when one of its cells is in sight.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.66` to `0.2.67`.
