# Militia experience and training

Across tactical combat and strategic militia training courses, *Patusco's JA2 Strategy Guide 1.3* (source `G` in [the parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)), printed pages 59–60, distinguishes trained regulars from veterans. It states that veterans reach their rank through battle experience. New Granaderos courses recruit cívicos or train them to the middle rank; they cannot purchase veteran rank.

## Combat credit

A militia soldier below veteran rank earns one point for first damaging an active opponent. A lethal hit is worth three points for that opponent in total, including any earlier wound point. Repeated damage cannot repeatedly award the first-wound point. Friendly fire, zero damage, and attacks on an already routed, surrendered, unconscious or critically incapacitated target grant no credit.

Each opponent receives a stable credit identity on first contact with this system. That identity survives an unfinished sector revisit. New encounters include their battle and starting-clock identity, so a later opponent can reuse a local enemy ID without being treated as the old opponent. Credit records survive saves and militia training. Their IDs remain private; the public UI exposes only the soldier's rank and point total.

On a valid deployment return, a living retained or physically departed militia soldier can advance one rank if they earned new points in that deployment. The thresholds are two total points for the middle rank and five for veteran. Old points alone do not grant promotion during a peaceful visit. Dead and dispersed soldiers do not return as promoted replacements. A withdrawing soldier is counted at the destination only.

A promotion adds eight marksmanship, five leadership and one experience level, within the normal attribute caps. It does not increase HP or maximum HP, remove wounds, replenish ammunition, repair equipment, grant a horse or replace a weapon. The same militia identity and full carried equipment record return to the garrison. The campaign journal reports the promotion, and the map shows the three rank counts.

These points, thresholds, gains and one-rank-per-return rule are Granaderos tuning. They are not a reconstruction of JA2's promotion formula. Credit is bounded to 100 distinct opponents and 300 points per soldier; veterans stop accumulating it.

## Formal training custody

A new promotion course reserves three actual local cívicos. They must be stable, not bleeding, capable, above ten energy and outside the current deployment. Their records leave the deployable garrison while the course runs. Completion returns the same soldiers at the middle rank; cancellation or the instructor leaving returns them at their original rank. Occupation still disperses the course under the existing campaign rule.

Training preserves wounds, condition, loaded rounds, reserve cartridges, fittings, carried items and combat experience. The regular course costs 120 pesos and consumes no horses. New-recruit course costs and duration formulas retain their existing tuning. If old aggregate militia counts have never been materialized, reserving trainees first creates their ordinary finite garrison records and takes initial cartridges from the campaign stock once.

Already paid legacy courses without individual trainee records remain readable. They complete or cancel under their original count contract, including a legacy top-rank course. Existing veterans also remain. This compatibility exception does not permit starting a new veteran course. Saved trainee identities and fitting ownership are validated, including against other courses and the deployable garrison.

## Remaining work

Militia remain directly controllable in tactical play. Autonomous militia commands remain an open requirement (S05, local militia combat, persistent casualties and control distinct from hired soldiers in the [parity requirements](../../requirements/ja2-parity.md)). That command model, militia medical assignments and a general strategic reinforcement economy remain outside this feature.
