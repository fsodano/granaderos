# Slice 49: the aimed shot rules into the domain

**Branch:** `migration/targeted-combat`
**Intent:** Move the rules that decide where a shot lands and what it does into
the domain, beside the body region that owns them.

## Why this slice exists

`packages/game/targeted-combat.js` holds the rules of an aimed shot: whether
the target may be aimed at a body region at all, which regions the player may
choose, the profile of a region with its label, the aiming penalty of a
region at a range, and the effects a region has on the damage.

The domain already owns the body region: `BodyRegion` in
`packages/game/domain/combat/body-region.ts` "owns the accuracy and
physical-injury modifiers for a targeted body region". The rules that read and
apply it belong beside it.

## What it changes

- `packages/game/domain/combat/targeted-combat.ts` holds the rules.
- `packages/game/targeted-combat.js` becomes a thin re-export of it, and the
  files that import it keep importing it from the same path.

The rules do not change: the same regions, the same labels, the same penalties
and the same effects.

## Tests

- `packages/game/domain/combat/targeted-combat.test.ts` covers the rules: a
  standing conscious target may be aimed at, a prone, fallen, unconscious or
  knocked down one may not, the regions of an aimable target are the body's
  regions, and the profile, penalty and effects of a region are the ones they
  were.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.53` to `0.2.54`.
