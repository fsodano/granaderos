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
the delivery receipts below when complete.

Python contracts passed all 15 tests without skips in the primary checkout with
the clean pinned engine submodule. All 39 relevant candidate Python, table and
asset inputs are byte-identical to that checkout. The strict C++17 black-powder
contract check also passed. The current review archive passed independent hash
verification. These checks have limited scope and do not replace the Node gate.

## Delivery receipts

The [integration evidence directory](../evidence/pending-work-integration-2026-10-09/)
retains exact branch equivalence, source inventory and validation receipts. The
final PR describes any remaining failed checks. Merge status must be verified
against remote main after the requested merge.
