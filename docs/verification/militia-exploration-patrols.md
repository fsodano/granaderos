# Saved local militia patrols

Runtime/test source: `cd0d8367f7a8a18d397f23826433671f3d44ff22`.

Local militia now scout when the loaded sector is in exploration. Each existing
six-second ambient tick permits one legal step toward a fixed map waypoint.
Planning uses a bounded budget, while the actual exploration step spends energy
without spending action points, cartridges, priming or medical supplies. Movement
lowers the firearm. The waypoint schedule does not use hidden enemy positions.
Hired soldiers remain under manual control. Incapacitated, bound, routed and
explicitly stationary defenders cannot patrol.

A defender that would drop below 50 energy rests for that tick and recovers up
to ten energy, capped at 100. The patrol therefore retains a reserve for contact.
The waypoint cycle, cadence and reserve are Granaderos tuning, not claimed JA2
constants or newly editable content fields. The shared map search also gives a
militia combat phase a legal search order when visible contact has been lost;
that combat movement spends ordinary remaining AP.

Sight is checked before patrols and after each step. Contact stops ambient
movement and starts the existing combat initiative. Positions, energy, cadence
and contact remain in the tactical save. Existing pause and hidden-document
guards still stop the exploration clock. Campaign synchronization saves the
same elapsed time once. Returning to a paid garrison preserves its people,
positions, wounds, ranks and finite possessions.

## Verification

Nine simulations and one mounted production-game check pass **10/10**. The
earlier overlapping militia/equipment group passes **79/79**, before the final
combat-search and mounted-pause cases were added. The initial exploration and
civilian group passes **32/32**. All 36 reference comparisons pass. Complete
regression passes **993/993**, zero failures or skips (235,750.841 ms), on
the source above. Types and production export pass with 722 files and 632 asset
references.
The documentation audit passes with 234 requirements and 73 evidence records,
retaining all 50 original and 87 parity rows. Exact-head CI remains required before publication.

Prepared tactical boundaries cover one-step movement and AP conservation, actual
visual contact, hidden-position-independent waypoints, exact saved continuation,
incapacity, a 50-energy pause and the next paid movement, and a 600-second rest
compared with 100 ordinary ticks. Every completed step is reachable; equipment
does not refill. A declared 28-AP lost-contact boundary permits only the search
movement affordable from that remaining budget.

A campaign case starts from actual paid and treated militia, visits the normal
Retiro map, advances twelve ordinary ambient ticks, synchronizes and round-trips
the complete save after every tick, and compares direct and resumed continuation.
Returning and revisiting keeps the actual garrison positions and finite loadouts.
The common paid/wounded setup uses the declared ambush documented in
[autonomous combat verification](autonomous-militia-combat.md).

The mounted game starts from that validated campaign visit. A controlled interval
clock verifies no change while paused or while the document is hidden. A visible,
resumed tick moves actual defenders and automatically saves the synchronized
campaign/battle pair. This is a mounted DOM test, not a live-browser session or
a frame-rate measurement.

## Remaining work

The broad militia and JA2-S05 requirements remain partial. City redistribution,
advanced search/support, artillery crews, custody and wider defense routes are
separate. This delivery does not import the advanced interrupt or elevation
systems from the development checkout.
