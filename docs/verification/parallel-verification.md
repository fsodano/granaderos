# Complete CI verification in parallel groups

Workflow/script source: `5ff4186b334a6596eee40c49c4112fac2917f204`.

The previous successful supply PR ran 1,054 tests in one job and took 18m47s.
The largest single test took 360.9 seconds; the complete fresh historical route
used 201.1 seconds. The following change reduces the serial CI bottleneck without
removing tests or weakening acceptance.

The workflow runs four independent simulation jobs. The script reads the same
non-hidden `tests/*.test.mjs` set as the ordinary full-suite command, sorts the
files and partitions them by position modulo four. It verifies that all targets
are regular files, each group is nonempty and every test file appears exactly
once. Unexpected target types fail instead of being silently omitted. Group
arguments outside 1–4, missing arguments and extra arguments are rejected.
Each group runs Node's test runner with two concurrent files and no name filter.
The exit status propagates to CI, including process failure or termination.

All four matrix jobs must pass. Fail-fast is disabled so one failure does not
cancel the remaining evidence. The existing web job independently checks the
documentation register, reference values, browser types and production export,
then retains the downloadable artifact. The 30-minute job limits remain. The
ordinary `npm test` command is unchanged. No third-party action or dependency is
added. Existing push, PR, tag and manual triggers remain unchanged.

## Verification

At this source the manifest contains 178 test files, grouped as 45/45/44/44.
The initial complete partition run passes 1,073 tests: 240/312/259/262 by group,
zero failures or skips. Local durations were 259.749, 118.704, 228.845 and
101.284 seconds. An additional unsupported-target guard leaves the manifest
unchanged. The complete application rerun on `cb8b732f20e04fb7d9b35093f8dd51b25c9be72b` also passes **1073/1073**,
zero failures or skips, with the same 240/312/259/262 case counts. Final group
durations are 407.342, 141.729, 278.697 and 127.848 seconds; other local suites
were running concurrently, so these are not hosted-runner performance results.
Four standalone infrastructure tests verify exact fixture coverage, seven invalid command forms, a non-file target and actual child-test failure propagation. These run in each simulation CI job before the application suite. The failure-propagation test exposed an inherited Node runner context suppressing nested execution. The final helper clears that internal context before starting its child runner; all four infrastructure cases now pass. The application files and partition manifest remain unchanged. Exact-head CI repeats the entire application suite on this correction.
The workflow parses and retains each simulation, document, reference, type,
export and artifact step. The unchanged browser runtime passes types and production export (722 files,
632 references); all 36 baseline comparisons pass. Documentation validation
passes with 242 requirements and 81 evidence records, retaining the original
50 and parity 87 rows.

The exact PR head passed all five hosted jobs. The slowest group finished in
6m49s; the other simulation groups took 3m45s, 6m29s and 3m18s, and the web job
took 1m22s. The preceding single-job PR took 13m37s. These particular runs show
a shorter publication gate; they do not guarantee that duration for future
changes or establish game performance. These are verification-infrastructure checks,
not new game mechanics, live-browser acceptance or a claim that the overall game
is complete. QA-01 and overall integration remain open.

## Publication

Published in [PR #104](https://github.com/fsodano/granaderos/pull/104) on 2026-09-28.
Exact head `0b78eb86b5f8c794a2435968b2531412694cef9e` passed [CI run 36495763245](https://github.com/fsodano/granaderos/actions/runs/36495763245), including the full suite, types and production build. Merge commit: `4b157161c8f50f374d26cdf07f4dff43652cdb62`. This publication does not close the broader artillery or campaign requirements.
