# Guerrilla defense on upper surfaces — 4 October 2026

The defensive `guerrilla_tactician` specialty now reads the target's occupied
tactical surface. Previously it read the ground tile at the same map position.
That gave an exposed roof defender a bonus from unseen cover downstairs and
missed the bonus from actual roof cover. The existing ground rule and its
twelve-point accuracy adjustment are unchanged. This is a Granaderos specialty
correction for V05/V08, not a new ballistic or historical protection claim.

The existing [trait test](../../tests/custom-traits.test.mjs) now includes a
declared roof arena after Acosta's real 420-peso weekly hire and six-hour arrival.
His native health, skills and ten issued rounds remain intact. The opposing
defender and roof geometry are declared before the first official save; this
does not prove a native Retiro battle or conquest.

An exposed roof gives a 91% forecast. Changing only unseen ground cover to 20
or 100, or the ground type to forest or scrub, changes neither the forecast nor
the physical flight, public cues, duration, final unit state or random state.
Actual roof cover gives 71% without the trait and 59% with it. The representative
seed 45 produces a real injury, leaving the defender at 39 health. Each branch
pays one round, 12 AP, one condition point and six seconds; Acosta keeps nine
rounds, and the treasury stays at 2,780 pesos. Ordinary and presented results
match, and the complete official initial-save replay matches the final save.
Existing ground-trait checks remain in place.

This bounded acceptance does not prove a full finite campaign, all elevated
combat combinations or full-video parity. It adds no assets, renderer, cannon,
personality condition, equipment or save field. Long campaign validation and
live player-browser checks are not part of this correction.

## Validation

The frozen candidate passes 83/83 affected checks and the complete short suite:
4,885/4,885 tests, all 700/700 selected files complete out of 708, eight declared
extended files excluded, eight workers and no name filters. Failures,
cancellations, skips and pending checks are zero; `complete: true`, elapsed
321.95 seconds. Type checking, production build, documentation/baseline audits,
five shard self-tests, complete 708-file partition coverage and whitespace
checks pass. The static export contains 1,133 files and 1,033 asset references.

The branch starts at main `e4147b09e6f251d0c92ae1dbdc6fcd7683914aa1`.
The tested and built production SHA-256 is
`dbe438a5cb02bd3bccb076696e43dce594d2ab484ee1acded3575204a2ae4ec2`.
All 875 test/support paths retain SHA-256
`4bdd86945a0dc0b4b7c93372f0965e8fc82b5ed8569065467e1d88d7227077b6`.
Production and test inputs remain unchanged after validation. The separate
stock-campaign worktree and its evidence remain on their own source.
