# Wounds from actual world appearance

Runtime/test source: `f8ffaa247cc084b9313a8d7df7a6e156a56564b0`.

An authored bleeding resident receives its physical wound record when placed in
the world, before any encounter. Off-screen time uses the existing six-second
civilian wound interval. Bulletin candidates and dormant successors receive no
civilian clock. A successor starts at actual arrival; when the destination is
protected by a loaded scene, its wound waits until that scene closes.

Campaign intervals split at pending appearance deadlines and daily placement
changes, as well as deaths and quest deadlines. A relocated living resident
carries its current wound to its actual new cell; a later body remains there.
Repeated synchronizations, saves and reentry cannot duplicate health damage,
death receipts or successor triggers. Loaded residents still use only the
physical tactical clock. Mission contact identities retain their existing rules.

The civilian ledger now accepts version 2. An older version-1 ledger is validated
before migration. Previously unseen wounds start from the saved health and time,
without damage for hours that the older version did not simulate. Version 2
rejects missing active wound records and wrong living world locations. Existing
service-return migration and historical mission contacts remain supported.

## Verification

The pre-change reproduction authored 12 health and one bleeding point, waited one
hour, and found 12 health, alive, with no physical wound record. That case now
dies at second 72 (minute 1), leaves one saved body and records an unknown cause.
There is no invented player blame or loyalty penalty.

The new cases pass **8/8**; the final related civilian/presence group passes
**56/56**. Eight new simulations cover:

- An unseen wound, an actual visit to its body, reentry and full saves.
- Unhired bulletin and dormant resident exclusions during a full day.
- Three consecutive wounded identities with actual minute-1, minute-4 and
  minute-4 deaths in one hour, without duplicate triggers.
- A successor blocked from a loaded Retiro scene for ten minutes; closing the
  scene starts its own twelve-second life without retroactive damage.
- A minute-239 appearance, a daily move at 04:00 and death in the new cell at
  minute 248. Batched and separate strategic waits agree.
- One hundred real ambient actions with incremental or batched tactical
  checkpoints, saved continuation and the same successor/wound results.
- A declared version-1 three-hour snapshot, migration from its saved health,
  later minute-181 death and rejection of malformed current records.
- Actual paid arrival, movement and finite first aid in the opening sector,
  followed by a full day outside the scene without reopening the wound.

An older initial-condition test now places its urgent patient in the opening
sector so it still verifies loaded bleeding. Its prior travel step depended on
the unseen-wound freeze and would correctly arrive after death under these rules.
The first focused run also caught an existing stale service-bit migration before
its conversion; validation now admits that previously supported migration while
still requiring the physical record. An initial daily-move fixture gave a fully
healthy actor bleeding; strict content validation rejected it, and the fixture
now starts below maximum health.

Complete regression passes **1131/1131**, zero failures or skips, in
269,118 ms. Types, production export (722 files, 632 asset references), all
36 baseline comparisons and the documentation audit (249 requirements,
88 evidence records) pass. This does not establish live-browser, performance or whole-campaign
acceptance. Civilian strategic medical care, off-screen breath recovery, physical
equipment custody and broader game completion remain open. Exact-head CI remains
required before publication.
