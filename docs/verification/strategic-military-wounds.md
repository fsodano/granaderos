# Military wounds during strategic hours

Runtime/test source: `3963284a8146b9097cb01f987223cf06f77d48bf`.

An untreated military wound now consumes health at each campaign hour boundary
while the actor remains in service outside the loaded tactical deployment. This
includes waiting, marching and elapsed time from another squad's actual actions.
Doctors act first using their existing finite supplies and local assignment
rules. Rest alone cannot stop bleeding. The existing daily recovery no longer
heals a bleeding or critically wounded actor; its fatigue recovery is unchanged.

The optional `careRules.bleedingDamagePercent` is an integer from 0 to 100. The
hourly loss is `ceil(bleeding × percent / 100)`. Its default is 25: intensity 5
costs two health each hour. Zero deliberately disables this strategic loss. The
original nine care fields remain required when the group is authored; absence
of the new field does not change old content bytes or identity. New and loaded
campaigns use their pinned setting, falling back to 25 when absent. Changing a
separate draft cannot alter that campaign.

This is a Granaderos hourly service rule, adapting the available strategic care
model. It is not a claim that the civilian six-second rule and the strategic
hourly rule are identical, or that their numerical balance exactly matches JA2.
No damage is invented for elapsed time before loading an earlier save.

A death records its minute once, clears the care assignment, removes the actor
from marching squads and stops unfinished training. The service history and
remaining possessions are retained without a refund or new allocation. A march
with no survivors stops at the last reached location and at the hour of death.
The existing presence and story checks process successors and required-character
loss. Saving and later dismissal cannot revive that actor.

Unhired bulletin candidates, hires still in transit, former service actors,
captives and deployed actors are excluded. Contract expiry still precedes hourly
medical work; arrivals join after it. Deployed people use their tactical clock.
This change does not apply medical work to civilians outside service.

## Verification

Seven new simulations cover:

- Strict optional settings, old content identity, portable imports and refusal
  to change the pinned package in a saved campaign.
- An actual enemy wound after paid local hiring and assault; equal batched and
  separately saved waits; no midnight healing of open wounds; explicit zero loss.
- Finite physician work before wound loss, and continued bleeding while resting.
- A wounded reserve actor while another squad performs actual scene actions,
  and no extra strategic damage to the loaded wounded actor's service record.
- A real wound killing the sole marching actor, retaining its last reached cell,
  remaining torches, one death log, exact successor delay, save and dismissal.
- An authored campaign's required-character loss at the actual hourly death,
  retained through the save codec.
- Authored initial injuries remaining outside the military clock before hiring,
  during a paid arrival and after dismissal; active service consumes the wound.

The shared injury fixture uses an actual enemy pistol shot and a spent torch in
explicitly compact barrier geometry, followed by ordinary retreat. It is not a
capital-victory route. The new mounted editor case exercises undo/redo, invalid
bounds, reset, launch, real paid hiring and hourly loss after saving. A later
draft edit does not change the running campaign.

The focused medical/return/rest group passes 29 tests. The new and existing care
editor cases pass two mounted checks. Type checking and all 36 baseline
comparisons and production export (722 files, 632 asset references) pass.
The first complete source `560b41b37151e336f56501a29edb85675b0dce99`
passes **931/932 tests**, zero skips (219,121.227 ms).
The historical route reaches victory but returns commander health 49 rather than
the previous expected 88. It had left critical, bleeding survivors untreated
before marching from Santa Fe, changing later deaths, replacements and battles.

The revised route uses local physician assignments before marching. Three hours
in Santa Fe consume six existing dressings; four hours after Ensenada consume
four more. Later recovery in Retiro uses 18 hours and buys 14 dressings for 140
pesos. The route reaches all 13 controlled localities at hour 582, second 512,
with 7,048 pesos and commander health 88. An actual saved 48-hour continuation,
four service expiries and a subsequent sector visit preserve victory and every
death. These orders use living doctors with available supplies; they neither
reset injuries nor reverse a confirmed casualty.

The corrected historical-route regression also passes in the complete run; its
[exact outcome](../evidence/strategic-wound-route-2026-09-28.json) records the care,
casualties, victory and saved continuation. The final complete source passes
**932/932 tests**, zero failures or skips (220,608.377 ms). Types, production
export (722 files, 632 asset references), all 36 baseline comparisons and the
documentation audit pass. The audit retains all 50 original and 87 parity rows
within 226 requirements and 65 evidence records.

Published through [PR #88](https://github.com/fsodano/granaderos/pull/88).
[Exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36459085707/job/109052809002)
passed for `584fe59c67a8a9db9f05bdea6566be12c8336abe`. The PR merged on
2026-09-28 at 17:46:01 UTC as `80b5bf2dd28ff9a331cb55666bbc18be2713de81`.

## Limits

This uses the existing hourly campaign work boundary, not a new per-person
fractional military clock. It does not simulate wounds before service or in
captivity, new unseen battles, civilian medical assignments, morale responses,
physical casualty placement or collection of a body created during strategic
travel. Remaining possessions are retained in the service record; this is not
complete corpse inventory or custody integration. Full travel/incapacity parity,
route balance across seeds, browser performance and full-game completion remain
open requirements.

The subsequent [unloaded militia wound integration](unloaded-militia-wounds.md)
tracks hourly loss and retained local bodies separately, with its own publication
status and compatibility limits.
