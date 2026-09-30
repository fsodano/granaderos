# Animation route setup performance

The animation hook previously built the full reachable-cell overlay for every
moving actor, then selected one destination. A normal full Buenos Aires ambient
update moved five or six guards. That repeated search took about 122 ms before
the animation could start. It runs in an effect, so the previous server-render
profile did not include it.

`movementRoute` now uses the pathfinder's existing `stopAt` option. The search
stops when it settles the destination's physical cell. This retains route costs,
tie ordering, facing intent, ground/roof separation and climb metadata. Recorded
paths, straight charges and terrain fallbacks keep their existing behavior.
There is no new cache. Each query reads its supplied simulation snapshot.

## Local comparison

Measured on 12 September 2026 with Node 25.9.0 on macOS arm64. The baseline is
`4c556cc`; the changed source differs only in the animation route query. Both
processes use initial campaign seed 8, six paid day hires (128, 142, 123, 115,
131, 110), an ordinary Buenos Aires attack and sector entry. The render fixture
sets night lighting. It retains the full 3,072-cell map, 125 upper cells and all
12 units.

The inputs are ten successive ordinary ambient updates and a completed ordinary
17-cell squad move. Each case runs three warmup passes and ten measured passes.
Timers include all changed actors' route queries and actor lookup. Simulation,
output hashing, React rendering, DOM work and painting are outside the timer.

| Route setup | Samples | Median before → after | Maximum before → after |
|---|---:|---:|---:|
| Ambient update, 5–6 actors | 100 | 121.81 → 21.46 ms | 139.47 → 62.10 ms |
| 17-cell move, 4 changed actors | 10 | 81.88 → 3.63 ms | 83.28 → 3.67 ms |

All 110 complete route hashes match, including the previously occupied-cell
fallbacks. The remaining ambient cost includes destinations blocked in the
previous snapshot: those still require an exhausted search and the existing
terrain fallback. These local measurements do not predict browser frame rate
or remove the cost of later animation renders.

[Timing summaries and complete route hashes](../../evidence/motion-routes/benchmark.json)
record the comparison. To repeat it, run
`node tools/benchmark-motion-routes.mjs` in each checkout, or set `PROFILE_ROOT`
to a separate checkout with its web dependencies installed. Compare the output
hash arrays before interpreting timings.

## Behavioral and rendering checks

The focused tests compare destination paths against complete reachable overlays,
including obstacle detours, both facing intents, changed topology, stacked
physical cells and paid climbs. They also check original actor/recorded-node
identity, charges and authoritative fallback endpoints.

The full-map render check completes the same legal 17-cell walk. It compares
51 changing night frames from the old full-range route and the new route through
the actual illustrated `TacticalScene`, including skin layers, current sight
filtering and a following 200% camera crossing viewport bounds. Every complete
SVG matches and unseen enemies remain absent. This checks rendered output; it
does not measure browser effect scheduling, retained DOM, painting or memory.

## Live smoke check

After integrating `d5f23a2`, the existing six-person Buenos Aires preview at
port 3032 completed the same 17-cell walk to ground AD34. Dorrego's energy moved
from 100 to 78, and the journal omitted an AP debit in exploration. In one
observed window the frame monitor recorded a worst gap of 308 ms; the rolling
30 React renders averaged 68.5 ms and peaked at 181.4 ms. These mixed live
samples were collected while other local checks were running. They are not a
controlled before/after frame-rate measurement. Long frames remain; the
controlled improvement established above is specifically route setup.
