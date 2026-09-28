# Civilian wounds outside the loaded sector

Final runtime/test source: `abff99203b5086194efa6ece6308f6de3a2f7c0e`.

A witnessed, still-bleeding resident no longer freezes when the squad leaves.
Strategic waiting/travel and actual tactical time in another squad advance that
same resident's wound. The resident carries the unfinished six-second interval
through departure, reentry and saves. Loaded civilians receive their damage only
from the tactical clock. Field aid that stops bleeding removes the pending wound
interval; it does not grant health regeneration outside the sector.

The campaign clock splits a batched tactical checkpoint at real hour boundaries,
off-screen death times and authored quest deadlines.
Off-screen wounds consume only the elapsed delta, including a partial hour.
Confirmed off-screen deaths retain the actual death minute. Presence transitions
process those deaths in order before later daily moves and successor deadlines;
a saved succession delay therefore starts at death, not at the end of a long wait.
Required-character quest failure uses the same death time. A later deadline cannot
replace that earlier cause. The active sector still defers a newly arriving successor under the existing rule.

The single civilian record and retained scenes receive the same health. The body
stays in its recorded scene. Responsibility, loyalty consequences, failed errands,
historical command loss and successor activation occur once. The campaign log
reports the off-screen death. A successor retains its own identity, health and
allocation. Hired service actors are excluded from this civilian update. Unhired
bulletin candidates gain no world appearance or civilian record.

Death receipts describe the final damage interval; one accumulated update and
several short updates therefore retain identical incident data.

An older wounded snapshot without an individual remainder starts from its saved
health and zero pending seconds. No damage is inferred for time before this
version. Invalid remainders, inconsistent record/scene values and clocks attached
to a stopped wound are rejected.

## Verification

Eight new simulations use actual paid recruitment, travel, movement, wounding,
medical supplies, squad selection and the campaign save codec. They cover:

- Departure followed by strategic waiting, actual death minute, one delayed
  successor, the earlier body on reentry and saved continuation.
- One-second orders in another squad, a save between intervals, reentry with a
  two-second remainder, and no duplicate processing of a repeated checkpoint.
- A loaded resident receiving each interval once, then finite field aid stopping
  further damage during a day outside the sector.
- Failure of both offered and unoffered local errands, with original attacker
  responsibility and one loyalty penalty.
- Older missing clocks, malformed or inconsistent remainders, and an unhired
  bulletin candidate remaining absent from the map.
- A ten-minute remote rest crossing midnight, retaining the actual earlier death
  minute and activating the successor before the final checkpoint. The starting
  clock is an explicit boundary fixture; health and subsequent actions are real.
- A wounded historical commander dying after departure, with explicit defeat
  retained by saving. The chapter and controlled road are prepared fixtures,
  not a full northern campaign claim. Repeated real approach orders account for
  the moving commander and local blockers.

- Identical wound history, death minute, quest failure and successor state after
  one accumulated checkpoint or forty actual short advances. Saving accepts both;
  later rest past the quest deadline cannot replace the earlier death cause.

The earlier civilian/succession group passed 20 tests. The first five new cases
and seven time-bridge cases passed 12 checks. The expanded civilian-health group
passed 22 overlapping checks. The historical case uses the actual approach. The first complete source
`7cb73e141f41e1a13e89463ceea86da23b32ff38` passed 917/918 tests, zero skips
(217,435.123 ms), types, production export and all 36 baseline comparisons. Its
failure exposed a campaign-ending quest deadline recorded at the following hour
boundary. The final source resolves each deadline and off-screen death at its
own timestamp. The overlapping event-order group passes 33 tests. The expanded
batch-versus-incremental case also passes with an actual required-character quest.
The corrected source `cd9cbdfe1f721b602b300f0e544812a7a7f0c208`
passes 919/919 tests, zero failures/skips (216,908.110 ms), types, export and all
36 baseline comparisons. Final review then added an explicit guard against
nonpositive event intervals. Its focused test passes and verifies atomic rejection
of a malformed in-memory clock. The final guarded source passes **919/919 tests**, with zero failures or skips
(217,449.841 ms), types, production export (722 files, 632 asset references), all
36 baseline comparisons and the documentation audit (224 requirements, 63
evidence records, retaining all 50 original and 87 parity rows).

Published through [PR #86](https://github.com/fsodano/granaderos/pull/86).
[Exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36453922698/job/109035294959)
passed for `1ed164502aeab9cf2dd34ad4f56b09ecf83c126a`. The PR merged on
2026-09-28 at 17:08:44 UTC as `1302eecd04eb7929aafbf9b5d7674b07b9f99127`.

## Limits

This extends previously recorded civilian wounds while the identity remains out
of service. It does not add strategic care for civilians, off-screen breath or
fatigue recovery, unseen battles, military bleeding outside deployment, civilian
armour/weapon custody or arbitrary transfer of a dead actor's possessions. A
former recruit's service condition becomes civilian state at its next actual
civilian checkpoint; this change does not create a second service simulation.
Simulation checks do not establish loaded-browser performance or full-game parity.

The subsequent [service-return delivery](civilian-service-return.md) resumes
previously recorded residents when they leave military service. Its limits and
verification are separate from the wound-clock checkpoint above.
