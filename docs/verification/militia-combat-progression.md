# Combat-earned militia promotion

Runtime/test source: `34f586ba81842765f2f9382e4801fc0477a1366d`.
Implementation: `2de58da`.

A surviving local militiaman can gain one rank when returning from an encounter
in which it earned new combat credit. The first damaging hit on an eligible
opponent grants one point; a later eligible kill upgrades that same receipt to
three points. Repeated wounds cannot multiply the receipt. Opponent identities
remain stable through an unfinished saved encounter. Civilian harm, friendly
fire, misses and damage to an already helpless or fleeing opponent grant no
credit. Dead soldiers cannot ascend.

The current thresholds are two points for Montonero and five for Veterano.
A rank adds eight marksmanship, five leadership and one experience level,
subject to the existing attribute caps. These numbers are Granaderos tuning,
not a claim of exact JA2 numerical fidelity. They are not yet editor settings.
An ascent retains the actual soldier, remaining wound, energy, finite supplies,
weapon definitions, wear and ammunition. A peaceful return cannot replay it.

New paid courses create cívicos or promote three stable cívicos to montoneros.
They no longer sell veteran rank. The campaign shows each rank count and explains
how veterans ascend. The garrison health list shows individual rank and combat
points. Already-paid veteran courses retain their saved contract, including
older count-only courses whose individual participants were never recorded.

## Verification

Seven new simulations, one mounted production-screen test and one explicit
individual-course compatibility test pass. The overlapping group passes
**54/54**, zero failures or skips. Types and all 36 reference comparisons pass.
Full regression passes **967/967**, zero failures or skips (227,302.340 ms),
on the source above. Production export passes with 722 files and 632 asset
references. The documentation audit passes with 230 requirements and 69 evidence
records, retaining all 50 original and 87 parity requirements.

The main fixture pays for a real cohort, inflicts a real enemy wound, uses finite
dressings and paid care to reach 43/60 health, then waits until daylight. A
purpose-authored pistol and declared compact barrier geometry exercise two
actual overwatch reaction kills using the normal campaign request seed. Each
return advances that same surviving soldier once. It remains at 43/60 health;
its three-round load falls to two and then one, with the corresponding wear.
Save, reentry and peaceful return preserve the veteran and its six points.
This is a bounded integration check, not a historical balance result.

Other checks cover repeated-hit receipts and kill upgrades, actual civilian
and helpless-target attacks without credit, an unfinished saved opponent's
identity, atomic rejection of new veteran tuition, normal paid regular
instruction, prior paid contracts, stale or reduced ledgers, dead participants
and rejection of malformed credit in garrisons, active battles, deployment
manifests and saved trainees. The unfinished-opponent check directly calls the
credit helper to isolate identity persistence; it does not claim another full
combat route.

The mounted screen shows the actual earned veteran, remaining wound and points,
then pays for and completes another civic cohort. That course leaves the existing
veteran unchanged. This is a mounted DOM check, not a live-browser session.

## Limits

This delivery adds bounded progression and preserves the existing training
contract. It does not add autonomous allied turns, restrict direct militia
orders, redistribute soldiers between cities, implement custody or prove the
advanced defense and prisoner routes. The accepted combat sequence uses real
reaction fire after an overwatch order; it does not establish full militia AI.

[Exact-head GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36468396494/job/109084156807)
passed at `86fb6c9e2494eba4ff9581505dae66bb55066b34`.
[PR #92](https://github.com/fsodano/granaderos/pull/92) merged on
2026-09-28 at 19:11:33 UTC as `8dc41470317b8fdee5a4a9a5e8a47e40a512e97e`.
A later [authored-rule review](authored-militia-progression.md) reproduces and
corrects the large-encounter receipt limit; its publication is tracked separately.
The broader integration and complete campaign acceptance requirements remain open.
