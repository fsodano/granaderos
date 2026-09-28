# City militia distribution and physical arrivals

Runtime/test source: `e00ec37002ce0b2e30208dfb35de9bebd0582560`.

Published in [PR #97](https://github.com/fsodano/granaderos/pull/97).
[Exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36479547644/job/109121542622)
passed at `d4e6d5211dac5cc6603a4d35c721a89f944a38f1` on
2026-09-28 at 20:46:53 UTC. Merge: `1dc6946c5fdaeaceb118e8b017610e6f40c6831d`.

The campaign offers manual destination, rank and quantity controls, plus a
previewed automatic distribution. Transfers use connected controlled sectors
inside the existing operational city area. Buenos Aires, Retiro and Ensenada
form one area; the other current cities have one sector. This existing grouping,
the immediate transfer and the 60-person capacity are Granaderos rules. The
city definition, capacity and arrival approaches are not new editable fields.

Transfers spend neither money nor campaign time. Stable wounded defenders move
with their actual identity, wounds, experience, weapons, wear and finite supplies.
Critical, bleeding, unconscious, sleeping, routed, surrendered, departed or
exhausted defenders remain at their post. Reserved trainees remain separate.
Patients and trainees occupy capacity. The automatic plan distributes experienced
ranks first, respects each sector's room and becomes unavailable when balanced.
Invalid quantities, foreign cities, hostile connections, full destinations and
pending encounters or deployments reject without changing campaign state.

A count-only cohort materializes only the individual records needed for the
transfer. Its first equipment issue follows the same authored allocation as
ordinary deployment. The approved training price still includes that kit; no
separate ammunition treasury is introduced. Moving existing soldiers issues
nothing. An authored zero allocation produces empty firearms.

The saved transfer records its actual final city approach. On entry, the new
garrison occupies exterior ground connected to a legal cell on that boundary.
A large cohort spreads inward in walking order when it cannot fit on the edge.
Blocked approaches fail without placing people in buildings, water or an
isolated pocket. Compact prior scenes and expanded maps both work. Entering
consumes the arrival marker; a subsequent ordinary return retains its positions.
Saved old-source snapshots cannot recreate a defender transferred elsewhere.

## Verification

Fourteen simulations and two mounted production-game checks pass **16/16**.
An earlier overlapping group passes **28/28**, before the final full-capacity
arrival case. Complete regression passes **1009/1009**, zero failures or skips
(236,806.160 ms), on the source above. Types and production export pass with
722 files and 632 asset references. All 36 reference comparisons pass. The
documentation audit passes with 235 requirements and 74 evidence records,
retaining all 50 original and 87 parity rows. Exact-head CI remains required
before publication.

Prepared established-area fixtures cover varied rank mixes, patients, reserved
capacity, incomplete city control, invalid actions, legacy count-only reserves,
strict saved arrival markers and a fully obstructed destination approach. The
optional hostile-group boundary is a prepared fixture, not acceptance of the
separate strategic enemy-group system. Both compact and expanded entry admit an
actual transferred group of 60 with unique positions and unchanged ammunition.

An actual paid course creates three cívicos; their first transfer allocates the
finite included kit once. A second campaign sequence uses real combat wounds,
field treatment and earned promotion. Its defender arrives at Ensenada with
44 HP, three experience points and the original remaining equipment. Revisiting
Retiro does not recreate that defender. Returning it to Retiro uses the southern
approach instead of its previous battle position. Full saves preserve both legs.
The shared wounded setup uses the declared ambush in
[combat verification](autonomous-militia-combat.md).

The mounted game starts from that validated paid/wounded campaign. Its actual
controls transfer the promoted defender, reject an excessive quantity, balance
the three city garrisons and save their unchanged identities, wounds, equipment,
clock and treasury. A prepared hostile connection explains why no transfer is
available. These are mounted DOM checks, not a live-browser session or a new
fresh-campaign conquest route.

## Remaining work

The broad militia and JA2-S05 requirements remain partial. Advanced tactical
support, artillery crews, custody, wider defense routes and configurable city
boundaries/capacity remain separate. This delivery uses the published campaign's
current finite equipment policy; the preserved development-workspace note
[city distribution](../gameplay/campaign/militia-distribution.md) describes a
larger, different integration and its own dated acceptance.
