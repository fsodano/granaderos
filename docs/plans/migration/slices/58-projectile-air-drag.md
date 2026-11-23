# Slice 58: projectile air-drag rules

The domain determines whether a weapon has a usable air-drag profile and
calculates how much projectile energy remains after travel through air. The
profile gives the fraction that should remain at the weapon's range. The retained
[`projectile-air-drag.js`](../../../../packages/game/projectile-air-drag.js)
validates the shared campaign-file record and re-exports the domain rules.

## Input validation boundary

The retained module keeps `validProjectileAirDrag`, the check for a weapon's
campaign profile and energy record. It uses the shared
[`projectile-profile-schema.js`](../../../../packages/campaign-format/projectile-profile-schema.js)
to require the profile's exact fields, a syntactically valid model identifier,
and a finite retention greater than `0` and at most `1`. The root check then
requires the supported model identifier and validates the associated
projectile-energy record. The domain does not import
`campaign-format`; without this boundary check, malformed campaign data could
reach a calculation that expects typed values.

## Domain rule

[`projectile-air-drag.ts`](../../../../packages/game/domain/combat/projectile-air-drag.ts)
works with validated, typed weapon data. Its predicate treats a profile as
usable when the profile is present, its retention is below `1`, the weapon's
range is finite and positive, and projectile-energy data is present.
`retentionAtRange` is the fraction of energy retained after traveling the
weapon's range. With no active profile or a nonpositive distance, the retention
factor is `1`; otherwise an exponential curve reaches `retentionAtRange` at the
weapon's range.

This is range-normalized game tuning, not a measured aerodynamic coefficient.
The profile range and the projectile path use abstract tactical distance units.
[`projectile-cover.js`](../../../../packages/game/projectile-cover.js) applies
the domain air-drag rule only outside active material spans. Material resistance
applies inside a span instead, so one segment does not pay both types of energy
loss. [`material-intervals.ts`](../../../../packages/game/domain/combat/material-intervals.ts)
owns interval ordering, overlap/touch merging, and entering/leaving events;
`projectile-cover.js` still traces the trajectory and collects the intervals.
See the [material-interval note](60-material-intervals.md) for that rule.

## Example

The [domain test fixture](../../../../packages/game/domain/combat/projectile-air-drag.test.ts)
uses a 12-gram projectile with a 0.5 retention fraction at range 30. It retains
about 0.707 of its energy at distance 15, 0.5 at 30, and 0.25 at 60. A weapon
without an air-drag profile retains all of its energy at any distance. These
values come from test data, not an authored campaign weapon.

## Behavior checks

[`projectile-air-drag.test.ts`](../../../../packages/game/domain/combat/projectile-air-drag.test.ts)
covers missing profiles, decreasing retention with distance, the exponential
curve at selected distances, and nonpositive distances. The domain tests
exercise the typed runtime rule; the retained root module owns file-contract
validation.
