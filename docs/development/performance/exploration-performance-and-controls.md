# Exploration, rendering and firearm controls

Updated 2026-09-22. These changes do not complete the campaign or equipped art.

## Playable changes

- B switches the selected firearm between fire and melee mode. An intact,
  compatible fitted bayonet uses a stab. Otherwise melee uses the gun stock.
  B does not install a bayonet. Fitting remains an inventory operation with its
  existing compatibility and action-point rules.
- Exploration walking costs 0.25 base energy per tile, formerly 1, including
  hostile sectors before contact. Running
  costs 1.5, crouching 0.75 and crawling 1.5. Load, mud, riding and trait modifiers
  still apply. Combat movement retains its prior costs and AP rules.
- One exploration rest restores up to 60 energy, formerly 15. It still takes
  ten game minutes. Recovery is earned in six-second slices; contact stops both
  the rest and further recovery. Enemy and militia patrols keep their autonomous
  recovery rules. A completed combat round restores up to 20 energy to the controlled squad,
  formerly 10. Fatigue limits capacity, and critical wounds can keep a
  soldier unconscious. This does not heal wounds or remove sleep needs.
- Rendering reuses unchanged terrain across battle snapshots, groups terrain
  fills and wall details, and caches visibility work between animation frames.
  Tile controls remain separate. Door, roof, prop and lighting changes invalidate
  the terrain cache.

## Browser checks

An isolated Buenos Aires night scene at 100% zoom used the same 1400 by 800 SVG,
120 animation frames, actors and camera before and after the changes. Each tenth
frame cloned the battle snapshot. Both runs used the local development server.

| Measurement | Before | After |
| --- | ---: | ---: |
| Mean frame interval | 187.64 ms | 32.71 ms |
| Approximate frame rate | 5.3 fps | 30.6 fps |
| Mean React update | 21.73 ms | 7.08 ms |
| SVG descendant elements | 32,848 | 14,316 |

These are local measurements, not a promise for all maps or hardware. Screenshots
were compared for the same buildings, camera and lighting. Temporary test routes
were removed after measurement.

Live control checks used an isolated fixture without campaign persistence:
B selected a fitted Brown Bess bayonet, an attack reduced target health from
100 to 45 without using its loaded round, and B restored firing mode. A pistol
without a bayonet used a stock hit, reducing health from 45 to 25 without firing.
Exploration rest raised energy from 20 to 80; a ten-tile walk then used 2.5 energy.

## Equipped artwork remains unfinished

The runtime still uses the existing family artwork for blades. New candidates
failed visual review: wrong row counts, duplicated directions, changed grips,
or missing blades. They are retained under
`assets/previews/equipped-sprites/rejected-blades/`, with prompts and rejection
records in `blade-generation-review.json`. None was registered or published.
Standing, crouched, mounted and applicable attack variants still need correct
art and runtime integration. Classification tests alone do not prove this work.

## Validation and remaining campaign work

- Typecheck, production build and whitespace checks passed. The static export
  contains 960 files with 856 verified asset references.
- The final focused group passed 122 tests. The full stationed-artillery group
  passed all 14 tests after limiting faster rest to cleared sectors.
- The earlier full-suite run passed 2,716 of 2,725 tests. Its movement expectation
  and artillery failures were corrected and their suites rerun as described above.
  This is not a claim that the full campaign suite is green.
- The long fresh-campaign route still fails: its Tucumán preparation expects
  exactly 11 survivors, but the current route has 6. Córdoba defense now completes
  after the recovery driver pays for a local replacement when a routed soldier
  has no recoverable gun. The driver does not create equipment or restore losses.
  A control run using the pre-change tactical module also failed the campaign
  route, later at Salta. Campaign completion remains unverified.
