# Campaign opposition progression — 2026-09-26

New campaign garrisons and newly issued enemy groups use current territorial
control to set their force size. They no longer use player squad size or elapsed
time to set the number of new troops. Existing accuracy and morale rules remain
separate from this count.

| Controlled sectors | New enemies |
| --- | --- |
| 1 | 4 |
| 2 | 6 |
| 3 | 9 |
| 4 | 11 |
| 5 | 13 |
| 6 | 16 |
| 7 | 18 |
| 8 | 21 |
| 9 | 23 |
| 10 | 25 |
| 11 | 28 |
| 12–13 | 30 |

The first stage corresponds to Retiro alone. Twelve controlled sectors leave one
hostile sector to conquer. Losing territory reduces the size of subsequently
created forces. This is game balance, not a historical troop-count claim.

The campaign attack dispatcher supplies the count to the shared opposition
generator. The strategic group launcher uses the same calculation, capped by
its command's remaining reserves. A final reserve of three can still form a
three-soldier group; fewer than three cannot launch.

The authored San Lorenzo mission retains its previous opposition rule. Existing
occupation groups and unfinished battles retain their actual troops, casualties,
wounds and equipment. Scaling does not add replacements to them. Multiple real
groups in one place can still total more than 30; the limit applies to each new
force, not a deletion of already present soldiers.

## Validation

`tests/campaign-opposition-progression.test.mjs` checks the normal campaign attack
and battle-handoff path at every ownership stage. It verifies save/load and
distinct defender positions. It also checks 30-enemy deployment in Tucumán,
Salta, Jujuy, Humahuaca, Uspallata and Los Patos; unchanged wounded troops on
re-entry and occupation; finite reserve use; and unchanged groups already issued.

These tests use explicit ownership fixtures. They do not claim a played winning
campaign. Existing coordinated assault, enemy intelligence, reserves, defense,
automatic resolution, mission assault and main-campaign integration checks were
also run. Type checking and the production export passed.

Older subsystem tests were adjusted where they assumed three-enemy groups.
The held-border test now provides twenty trained defenders for the larger
invasion. The reserve-history test uses four-soldier groups and still exhausts
finite pools and exercises history trimming; no reserve is replenished.

## Remaining acceptance work

The new balance needs a fresh played campaign route through the ending. Previous
route checkpoints are not evidence for this balance. Frame-rate acceptance with
30 enemies, reactions and night lighting is also still open. Equipment art,
body slots and revised light art remain separate unfinished requirements.
