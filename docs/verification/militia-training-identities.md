# Individual militia through paid promotion

Runtime/test source: `5ebb46107c279883aee24fc1833498a8f8de0417`.
Runtime implementation: `c75135e3a97d233d758a9410932be328b7deb932`.

A new paid promotion reserves three actual soldiers of the preceding rank.
They leave the deployable garrison while they attend the course. Each must have
at least 15 health, more than 10 energy, no bleeding, and no unconscious or routed
state. Deployed soldiers cannot enter another course. Reading eligibility does
not create soldiers or issue equipment. A rejected order spends no money.

Completion returns those same people at their new rank. Health, maximum health,
remaining ammunition, weapon definitions, supplies and inventory stay with each
identity. Promotion adds 8 marksmanship, 5 leadership and one experience level,
with the existing attribute caps. These gains are Granaderos tuning. Promotion
is not a medical treatment and does not issue a replacement rank kit.

Cancellation, departure or death of the instructor returns the reserved people
at their previous rank. Spent tuition is not refunded. Enemy occupation disperses
the course. It does not create rescued prisoners or return troops behind enemy
lines. A completed course is retained even if another squad is currently inside
the sector: closing that deployment merges its surviving defenders with the
soldiers who have since returned from training.

The campaign screen explains when fewer than three fit soldiers are available.
It lists the health of the actual course participants. Saved courses validate
physical records and reject duplicated identities across courses, the ordinary
garrison or an active deployment.

## Compatibility

Older paid courses stored only counts. Those courses remain readable and keep
their previous count-based completion/cancellation contract. No migration can
recover identities or possessions that the old save did not record. New courses
always store individual participants. The new identity guarantee applies to
these new courses, not to unrecorded older participants.

## Verification

Nine new simulation tests and one mounted production campaign-screen test pass.
Actual paid training, saved visits and normal orders establish the cohorts. A
real enemy pistol wound is treated with two existing dressings, leaving the
soldier at 19/60 health. Both subsequent promotions preserve that wound, identity
and equipment through saving and reentry. Cancellation and instructor dismissal
return the same records without rank or health changes.

Other checks cover an actual paid contract expiry, an authored starting wound
that kills an instructor, course completion during another squad's tactical
time, strict saved-record rejection and count-only compatibility. Exhaustion,
shock and territorial-loss checks use explicitly prepared boundary states.
They do not establish a fresh successful defense route. The production screen
rejects the critical patient, permits promotion after actual treatment, lists
participants and cancels without replacing or healing them.

The initial combined focused group passes **28/28** checks. The first complete
run of `c75135e` reports **947/948**, zero skips (227,011.063 ms). Its sole failure
is the prior authored-equipment test expecting promotion to replace a worn,
partly loaded pistol with a fresh rank kit. That expectation contradicts
individual equipment conservation. The revised test instead checks the same
actual shot, depleted loading, wear, health and identity through both promotions.
A separate explicit older-count fixture still verifies all three authored
starting kits. The corrected focused group passes **17/17** checks.

Types, all 36 reference baseline comparisons and production export pass
(722 files, 632 asset references). Final complete regression on
`5ebb461` passes **949/949**, zero failures or skips (226,463.688 ms). The
documentation audit passes with 228 requirements and 67 evidence records,
retaining all 50 original and 87 parity rows. Successful exact-head GitHub CI
is still required before merge; this delivery is not yet on main.

## Remaining scope

This delivery does not add combat-earned promotion, city redistribution,
independent trainee medical care, unloaded militia bleeding, strategic corpses,
prisoner custody or the full advanced militia behavior. The new course preserves
its participants' health until completion or cancellation. A wounded but stable
participant must return from the course before receiving local militia care.
Mounted checks are not live-browser or performance acceptance.
