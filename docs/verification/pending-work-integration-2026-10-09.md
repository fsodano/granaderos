# Pending work integration, 9 October 2026

The user requested that all pending work be committed and merged into main.
This delivery includes the active gameplay changes, campaign acceptance sources,
current trailer, original feedback images, and editable 3D review sources.

## Source inventory

| Source | Integration treatment |
| --- | --- |
| Structural blast, connected sector roads, tactical sight and reliability changes | Current gameplay code and affected tests retained on the integration branch. |
| Stock campaign acceptance work | All 17 authored pending entries committed in `44b7fcad` and merged, with created and stock route implementations retained separately. |
| Original feedback and JA2 review | All 26 pending reference files committed in `ad40ac7f`; original image bytes retained. |
| Historical gameplay trailer | Main PR #325 retained; current gameplay captures and exact media provenance from `90276255` also integrated. |
| Older graphics branches | All 23 complete patches match existing main squash commits. Their history is retained without replacing subsequent accepted changes. |
| Human character checkpoints and private studies | Exact source/art/test/receipt bytes retained in the labelled review-source archive. Competing and rejected variants are not enabled in gameplay. |

The [3D source record](pending-3d-integration-2026-10-09.md) identifies every
graphics branch and current runtime selection. The archive verifier checks all
1,788 unique blobs and 18,724 available source-path aliases. Their logical
size is 1,408,613,954 bytes. No individual archived blob exceeds 18,626,420 bytes.
Duplicate bytes reuse their Git blob objects.

Dependency symlinks, caches and repeated rendered evidence are local generated
outputs. They are not unfinished authored source. Their original directories
are retained. An app worktree marked `locked initializing` is checked separately
from completed authored worktrees.

## Gameplay and campaign checks

The final complete frozen run at `f88155f9` covered all 927 files, with zero
exclusions: 6,971 tests, 6,961 passed, seven failed and three skipped. Runtime
identity was `2368ae747c42`; all 13,641 source entries matched before and after
execution. The [full report](../evidence/pending-work-integration-2026-10-09/full-frozen-report.json)
and [exact failed checks](../evidence/pending-work-integration-2026-10-09/full-frozen-failures.txt)
are retained. This remains a failed complete gate.

Three failed files stop at one care-helper order assertion: all six actual
actors remain, but doctor112 and actor115 return in the opposite squad order.
Commit `19380a32` corrects that helper through the ordinary squad action. A
strict cohort check and full-state comparison allow only the formation arrays
to change. The exact failing native prefix then passes at `fieldRecovered`,
before Cordoba combat. All 17 affected care/custody checks pass without skips.
Production source is unchanged. This separate correction does not replace or
increase the measured full-run pass count.

The other recorded campaign gaps are an invalid direct return journey to
Cordoba after real counterattacks, a 29-turn opening rescue retreat at Tucuman,
and a nine-turn stock-route retreat at Tucuman. These tests retain the actual
rejected command or native outcome. They do not establish a production defect
on their own.

The earlier complete frozen gate covered all 927 test files. It recorded 6,970
tests: 6,957 passed, 10 failed and 3 skipped. Its input digest matched before and
after execution. That result remains recorded in the
[reliability evidence](../evidence/local-reliability-2026-10-09/full-frozen-summary.json).
It is a failed gate, not evidence of complete campaign acceptance.

Subsequent focused checks corrected the partial reload fixture clock, preserved
finite coastal care and equipment custody, and supplied Mendoza through actual
finite ammunition transfers and completed journeys. The bounded native Mendoza
check won in 15 turns and 278 orders, with exact replay and official saves. All
recorded prior deaths and the four new deaths remain permanent.

The opening prisoner rescue controller still retreats. Created Mendoza urgent
care and the paid return now pass with all 19 living survivors and all 24 recorded
deaths retained. Five real dressings are consumed. The later army-funding
preparation still fails because reachable dressings are exhausted. These results
do not prove a successful full campaign. The final frozen gate is recorded in
the delivery receipts below.

Python contracts passed all 15 tests without skips in the primary checkout with
the clean pinned engine submodule. All 39 relevant candidate Python, table and
asset inputs are byte-identical to that checkout. The strict C++17 black-powder
contract check also passed. The current review archive passed independent hash
verification. These checks have limited scope and do not replace the Node gate.

## Delivery receipts

The [integration evidence directory](../evidence/pending-work-integration-2026-10-09/)
retains exact branch equivalence, source inventory and validation receipts. The
final PR describes any remaining failed checks. The final PR includes the frozen result and this narrow follow-up correction.
Merge status is verified against remote main after the requested merge.
