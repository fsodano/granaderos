# Militia wounds outside the loaded sector

Runtime/test source: `5de9a17a2f29731cd660a2a09c2fca0f466542bb`.

Retained local militia now use the campaign's authored hourly bleeding rule.
Each campaign hour, local physicians work first. A soldier whose wound remains
open loses `ceil(bleeding × bleedingDamagePercent / 100)` health. The default
percentage is 25; zero disables this strategic damage. Waiting, squad travel and
tactical time in another sector share that clock. The currently loaded sector
keeps its tactical damage and receives no second strategic charge.

The screen shows the expected hourly loss beside each bleeding militiaman.
Stabilizing a patient consumes an actual dressing and prevents that hour's
loss. Later care can recover health. New promotion courses require stable
participants, so an untreated critical patient cannot escape into training.
Promotion continues to preserve the stable soldier's remaining wound.

A death removes the individual from the deployable garrison, reduces its rank
count once and records one local death notice. When the saved scene contains
that soldier, it retains the actual body at the last known position with the
same weapon definition, ammunition, wear, supplies and inventory. Saved reentry,
real collection from the body and another return keep the depleted remainder.
New paid cohorts receive new identities and do not replace the old casualty.

## Verification

Six new simulations and one mounted production campaign-screen test pass in a
**30/30** overlapping group covering care, training and military remains. The
shared fixture authors a controlled capital and port, pays for a cohort and a
physician, waits the actual course interval and uses an actual enemy pistol shot
in declared compact barrier geometry. The body-recovery variant leaves a real
passage through that barrier so the player reaches the body through ordinary
movement. It does not teleport a collector or fabricate a combat death.

Checks cover:

- Rates of 0, 25, 50 and 100; equal batched and incrementally saved health loss.
- Actual hourly death, one notice/count reduction, saved body position and
  possessions, finite ammunition and weapon collection, saved depletion, and a
  subsequent paid cohort with distinct identities.
- Finite local stabilization before damage, later health recovery and a stable
  promotion retaining the remaining injury.
- Health loss during actual travel to Buenos Aires and death while another
  sector consumes tactical hours.
- Loaded-sector exclusion and the ordinary settlement of its actual tactical
  bleeding casualty.
- Explicit older-record compatibility when no retained scene supplies a body
  position; no position or replacement soldier is invented.
- Visible hourly loss, a real wait, local assignment, finite treatment and save.

The earlier locality-care test now stabilizes its critical militiaman before
leaving on the long march. Its previous untreated patient died under the new
clock; the test no longer expects an off-screen wound to remain frozen. The
initial new travel check incorrectly assumed that march alone lasted until
death; the reviewed check measures the actual travel loss and continues through
the next real tactical hour in Buenos Aires.

Types and all 36 reference baseline comparisons pass. Complete regression passes
**956/956 tests**, zero failures or skips (229,642.844 ms). Production export
passes with 722 files and 632 asset references. The documentation audit passes
with 229 requirements and 68 evidence records, retaining all 50 original and
87 parity rows. Successful exact-head GitHub CI is required before merge; this
delivery is not yet on main.

## Limits

The boundary is the campaign hour, matching the currently integrated military
wound rule. It is not a separate per-person fractional wound timer or an exact
JA2 numerical claim. Only existing retained militia are advanced; reading the
clock does not materialize fresh rank counts. Occupied sectors do not simulate
patriot garrison care or bleeding.

Older wounded records without a retained scene can lose their soldier and count,
but cannot supply a trustworthy physical body location. Their death remains a
campaign notice; no map or body coordinates are fabricated. New actual tactical
wounds retain their scene. Redistribution, prisoner custody, combat-earned
promotion and complete advanced defense routes remain separate requirements.
Mounted checks do not establish live-browser behavior or performance.
