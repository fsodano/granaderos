# Slice 54: the dead defaults go away

**Branch:** `migration/dead-defaults`
**Intent:** Remove the two defaults that no caller reaches, so the repository
has one place that says what they are.

## Why this slice exists

The documentation pass found two defaults that nothing in the repository
reaches:

- `REST_HEALING_HOURS`, declared twice, in `packages/game/medical-care.js` and
  in `packages/game/strategic-rest.js`, both holding the same value as the care
  tuning the domain now owns.
- The default price of `refillCost` in `packages/game/equipment.js`, whose only
  caller always supplies the campaign's care price.

A default nobody reaches is a second place that says what a rule is. The
first one also duplicates a value the domain already owns, which is how the two
drift apart.

## What it changes

- `packages/game/medical-care.js` and `packages/game/strategic-rest.js` drop
  the unused constants. Any use of the value reads the care tuning in the
  domain.
- `packages/game/equipment.js` no longer offers a default price for a
  refill, so a caller has to say what it pays.

Nothing changes for a player: no call site reached either default.

## Tests

- The type checker proves the second change: a caller that does not supply a
  price no longer compiles, so the default cannot be reached again.
- The existing medical care and equipment tests keep passing.

## Verification

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.58` to `0.2.59`.
