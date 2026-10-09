# Custody guard exhaustion, 9 October 2026

An occupying guard can spend its last three energy points on prisoner care.
The previous code retained the guard's weapon readiness and awake condition
after energy reached zero. The next official campaign restore rejected this
saved sector. The canonical enemy group also retained the stale condition.

`advanceDetentionCare` now refreshes the military condition of both records
after the existing energy debit. Exhaustion clears AP, weapon readiness,
overwatch, mounting and bracing through the existing condition helper. Care
still consumes the same finite dressing and produces the same prisoner health
result. The fix does not change equipment, wounds, custody or save admission.
Previously invalid modern saves remain rejected.

## Validation

Executing code commit: `85742fa0ec30f8755d42c2682753ea2c407714c7`.
Production source: `9d03e36370d6`.

The two added regressions fail against the previous main implementation: 25 of
27 checks pass and two fail. With the correction, all 27 checks in the two
custody files pass. Another 24 checks in five affected files pass. All 51 checks
have zero skips. The integrated regression starts from the declared detention
scenario, follows actual capture and care settlement, restores the official
campaign save and checks the next rescue deployment save. It is not a full
campaign combat acceptance result.

The complete local run covers all 927 files with no exclusions. It reports
6,973 tests: **6,963 passed, seven failed, three skipped**. There are no
cancellations or TODOs. The run took 1,256.0 seconds on Node 25.9.0 with eight
file workers. All 13,647 frozen file entries and the engine gitlink match
before and after the run. The input digest is
`56b0afa121f466e6c8b9693f2d232a1d08ba98e461c635fe8fe7607a4b3671b0`.

The complete gate remains failed. The recorded failures are:

- The recovery route tries to start a direct return journey through a town
  captured by an actual enemy counterattack.
- The ordinary stock ending route retreats at Tucumán after nine turns.
- The opening rescue route retreats at Tucumán after 29 turns. Its parent
  check also fails, and three dependent route checks are skipped.
- The created northern, Cuyo and historical loss routes reach the rear-port
  meeting helper, which fails to reveal the representative during its map sweep.

These outcomes are retained without changing battle results or granting
campaign progress. The latter three routes have passed the earlier care-helper
formation assertion corrected in `19380a32`. They now expose the later meeting
gap. This correction does not claim to resolve those route failures.

TypeScript, documentation, all 38 baseline references, five shard self-tests,
full 927-file partition coverage and the whitespace check pass. The production
build passes with 1,377 static files and 1,045 asset references. All 15 Python
checks pass in the clean pinned engine checkout; 39 relevant inputs match the
candidate. The strict C++17 black-powder check also passes. Independent review
found no actionable issue in the custody correction.

The [validation receipt](../evidence/custody-guard-exhaustion-2026-10-09/validation.json),
[full report](../evidence/custody-guard-exhaustion-2026-10-09/full-report.json),
[exact failures](../evidence/custody-guard-exhaustion-2026-10-09/full-failures.txt)
and [independent review](../evidence/custody-guard-exhaustion-2026-10-09/independent-review.json)
retain the measured results. This document and its receipts follow the frozen
code commit; they do not change its production source identity.
