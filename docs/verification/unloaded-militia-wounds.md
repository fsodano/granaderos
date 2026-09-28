# Militia wounds outside the loaded sector

Runtime/test source: `61bdfa00e0ded0d88effae5c54ae6094d621d3f8`.
Initial implementation: `5de9a17a2f29731cd660a2a09c2fca0f466542bb`.

Retained local militia now use the campaign's authored hourly bleeding rule.
Each campaign hour, local physicians work first. A soldier whose wound remains
open loses `ceil(bleeding × bleedingDamagePercent / 100)` health. The default
percentage is 25; zero disables this strategic damage. Waiting, squad travel and
tactical time in another sector share that clock. Actually deployed militia keep their tactical damage and receive no second
strategic charge. Opening the separate Yatasto conference does not freeze the
town garrison or the physician left to treat it.

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

Eight new simulations and one mounted production campaign-screen test pass.
The initial overlapping group passed **30/30**; the final reviewed group,
including mission and recruited-person care checks, passes **49/49**. The
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
- A separate Yatasto scene anchored in Tucumán while the town militia stays
  outside it, including a local physician left in another squad. The northern
  headquarters, paid cohort and enemy wound are real; only the historical
  conference gate is explicitly prepared. This is not a northern-route victory.

The earlier locality-care test now stabilizes its critical militiaman before
leaving on the long march. Its previous untreated patient died under the new
clock; the test no longer expects an off-screen wound to remain frozen. The
initial new travel check incorrectly assumed that march alone lasted until
death; the reviewed check measures the actual travel loss and continues through
the next real tactical hour in Buenos Aires.

The first complete source `5de9a17` passes **956/956**, zero failures or skips
(229,642.844 ms). Review then added a separate-scene regression: a wounded town
soldier incorrectly stayed at 13 health during Yatasto, instead of falling to
12. Exclusion now checks actual deployed identities. A second check showed that
the physician left in town was also blocked: the patient fell to 10 instead of
remaining at 13 after finite stabilization. The town-care boundary is now
separate from the conference. Both regression checks pass in the reviewed group.

Types and all 36 reference baseline comparisons pass. Final complete regression
on `61bdfa0` passes **958/958**, zero failures or skips (229,423.091 ms).
Production export passes with 722 files and 632 asset references. The
documentation audit passes with 229 requirements and 68 evidence records,
including all 50 original and 87 parity rows. [Exact-head GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36465815536/job/109075499522)
passed at `c4d0e094fe6127933392d2e84b380cd1ec1a6dc6`.
[PR #91](https://github.com/fsodano/granaderos/pull/91) merged on
2026-09-28 at 18:47:57 UTC as `7be4aa7c8b80cc5cbded49f38055431c82f8e113`.

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
