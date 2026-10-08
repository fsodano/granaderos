# Native climb and mount test gates

The clothing review found six quick-test failures. All six also failed on
the exact pre-clothing main `f01916b070b4dfd59a92ef20c50d184ba8a194a1`.
This increment corrects three old test assumptions. It changes no runtime,
game rule, model, animation bank or profile.

The climb test requested a 120 ms display interval and expected half of the
climb after 60 ms. The released native climb takes 4.616667 seconds. The
current display also enforces the minimum vertical pace. The test now checks
the released interval, the early in-flight state, half completion, the final
cell and height, and unchanged paid state.

The mount test expected an immediate commit. The current recorder presents
one protected 2.3 second preparation and a result before it commits once.
The corrected fixture uses a React state owner, as the real page does. It
checks zero early commits, one paid result, exact AP and cells, busy-input
rejection, and no repeated cue after a renderer callback or state commit.

The roof test expected a straight ladder path. The supported path includes
the Root setback and crest. The test now checks actual paid ascent and
descent against that contact plan, with the roof plane measured separately
from the rendered mesh. Sprite feet and hit frames must share that position.
Endpoint, reversal and phase-continuity checks remain. Stairs and independent
platforms keep their existing linear rules.

All 16 checks in these three files pass locally. The
[source and cause receipt](native-climb-mount-gates-2026-10-08.json) records
the original failures, unchanged runtime and bank hashes, and private checks.
The integration checkout repeats the same selection on main `9002e91c`.

```sh
node --test tests/actor-unit-motion-distance.test.mjs \
  tests/artillery-battlefield-playback.test.mjs \
  tests/elevation-interface.test.mjs
```

This does not establish a green full quick suite. The separate flat-roof,
church-tower-foot and porch-placement failures remain under review. No
browser or full motion sweep is required for this test-only correction.
