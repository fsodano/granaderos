# Retiro walking and retained scenery — 29 September 2026

This is evidence for the **development checkout served on localhost:3000**.
It is not verification of GitHub main or full-game acceptance.

## Reproduction

Use a separate QA save (`?qa=1&performance=1`). Start a fresh campaign, hire
Baltasar Acosta for one day, enter Retiro, set the camera to 100%, center it on
the selected soldier, and walk from `(23,20)` to `(23,14)` through the ordinary
field control. Measure 20 seconds without inspecting the page during capture.
This is a night scene with one player; it is not loaded-combat evidence.

| Build | Mean position update | 95th percentile | Longest position gap |
| --- | ---: | ---: | ---: |
| Original port 3000 development server | 36.83 ms | 84.1 ms | 224.9 ms |
| Same source, production build | 17.93 ms | 24.8 ms | 66.6 ms |
| Retained-scenery fix, production build | 17.43 ms | 25.0 ms | 58.3 ms |

Most of the measured improvement comes from using the production build. The
cache change also prevents equivalent room-discovery descriptions from restoring
and rebuilding unchanged SVG scenery. Changed doors, lighting, textures, floors,
walls and roofs still invalidate their layers. Shared immutable room metadata
uses weakly held comparison results.

The fixed production capture had no tasks longer than 50 ms. Its moving display
frames averaged 8.57 ms on this high-refresh display, with a 33.3 ms maximum.
These are bounded measurements, not a guarantee of sustained 60 FPS.

## Checks and installation

The focused renderer and movement group passed **41/41**, with zero failures or
skips. Type checking and the production build passed. The original checkout also
built successfully: 1,098 exported files and 992 checked asset references.

Only `web/app/StaticSceneLayer.tsx`, `web/lib/static-scene-content.ts` and
`tests/static-scene-content.test.mjs` were applied to the running checkout after
checking its source hashes. Existing unrelated edits were retained. Port 3000
now runs `vinext start --port 3000` from `web/`. The separate QA save loads after
the server change. Reload an existing game tab to load the new client build.

A second capture on the updated port 3000 continued that test save and walked
back from `(23,14)` to `(23,20)`. Position updates averaged 17.04 ms (95th
percentile 24.1 ms; maximum 41.7 ms). Display frames while moving averaged
8.33 ms, with a 9.3 ms maximum. No browser console errors were recorded. This
return walk used already discovered scenery and is not the fresh-entry baseline.

## Open work

The illustrated walking atlas still contains four poses at five frames per
second. Better rendering does not add the missing intermediate artwork. New
art candidates were reviewed and rejected; none replaced the current atlas.
Full combat, larger squads, other sectors and complete campaign acceptance
remain open. Enemy-turn presentation was published in PR #125 and is now
[integrated into this local checkout](local-enemy-playback-2026-09-29.md), with a
separate worker-export correction in PR #126.
