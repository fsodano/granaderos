# Authored militia patrol rules

Runtime/test source: `40010d251b5527560e78f521a72d9607fd9ba64e`.

The story editor now configures whether militia patrol and search, how many
intervals each fixed map waypoint lasts, the exploration energy reserve, and
the energy recovered when a patrol rests instead of moving. The original values
are enabled, eight intervals, 50 energy reserved and ten recovered. Each interval
still means one existing six-second exploration tick or one combat round. Map
waypoint positions, one-step exploration movement and combat search AP limits
remain fixed engine rules.

Disabling patrols stops peaceful movement and map search after lost contact.
It does not disable visible combat or reaction fire. Reserve/recovery settings
apply only to exploration patrol rest: no healing, cartridge creation or AP
refresh occurs. Recovery is capped at 100 energy. The editor explains these
limits and offers a reset to the original optional configuration.

The optional package field preserves older content identities without inserting
new default data. Complete configuration is strict: a boolean enabled state,
one to 60 waypoint intervals, zero to 95 reserved energy and one to 100 recovery.
Import/export, undo/redo, reset, launch validation and draft persistence use the
same data. A new campaign pins its own copy. Changing the external draft cannot
alter an existing campaign.

Every new deployment carries its campaign rules into tactical state. Pending,
active and retained scene saves and submitted campaign reports reject changed,
missing effective custom rules or malformed data. Paired campaign/tactical saves
therefore resume the same patrol behavior. Original saves use the original rules.

## Verification

Six new simulations and one mounted editor case pass **7/7**. The final
overlapping autonomy group passes **11/11**. Existing exploration and mounted
pause checks passed during implementation. Complete regression passes **1016/1016**, zero failures or skips
(233,585.851 ms), on the source above. Types and production export pass with
722 files and 632 asset references. All 36 baseline comparisons pass. The
documentation audit passes with 236 requirements and 75 evidence records,
retaining all 50 original and 87 parity rows. Exact-head CI remains required
before publication.

Prepared tactical boundaries demonstrate actual resting energy, paid movement,
no healing/refill, the 100-energy cap, saved continuation and waypoint timing.
Package and standalone snapshot validation reject invalid limits and types.

An actual paid militia course supplies three defenders. Ordinary visits advance
eight ticks while configured to hold position, synchronize campaign time and
round-trip complete saves. Return, reentry and a new attack deployment keep the
same rules. A separate declared flat combat boundary uses that paid cohort and
its actual weapons to verify finite combat shots with patrols disabled. Reports
and pending, active and retained saves reject changed or removed custom rules
without altering the source campaign.

The mounted production editor changes every option, uses undo/redo, rejects an
invalid reserve, restores defaults, launches the configured campaign and pays
for an actual cohort. Ordinary ticks keep its defenders in place; subsequent
draft edits do not change that campaign. The ordinary campaign save remains
untouched. This is a mounted DOM check, not live-browser acceptance.

## Remaining work

The broad configurable-rules and militia requirements remain partial. Editable
waypoint positions, combat-search budgets, city boundaries/capacity, advanced
support, artillery and wider defense acceptance remain separate. This bounded
configuration does not establish balance for every allowed combination.
