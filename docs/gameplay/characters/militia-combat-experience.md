# Militia experience and training

Patusco's guide, printed pages 59–60, distinguishes trained regulars from veterans. It states that veterans reach their rank through battle experience. New Granaderos courses now recruit cívicos or train them to the middle rank; they cannot purchase veteran rank.

## Combat credit

A militia soldier below veteran rank earns one point for first damaging an active opponent. A lethal hit is worth three points for that opponent in total, including any earlier wound point. Repeated damage cannot repeatedly award the first-wound point. Friendly fire, zero damage, and attacks on an already routed, surrendered, unconscious or critically incapacitated target grant no credit.

Each opponent receives a stable credit identity on first contact with this system. That identity survives an unfinished sector revisit. New encounters include their battle and starting-clock identity, so a later opponent can reuse a local enemy ID without being treated as the old opponent. Credit records survive saves and militia training. Their IDs remain private; the public UI exposes only the soldier's rank and point total.

On a valid deployment return, a living retained or physically departed militia soldier can advance one rank if they earned new points in that deployment. The thresholds are two total points for the middle rank and five for veteran. Old points alone do not grant promotion during a peaceful visit. Dead and dispersed soldiers do not return as promoted replacements. A withdrawing soldier is counted at the destination only.

A promotion adds eight marksmanship, five leadership and one experience level, within the normal attribute caps. It does not increase HP or maximum HP, remove wounds, replenish ammunition, repair equipment, grant a horse or replace a weapon. The same militia identity and full carried equipment record return to the garrison. The campaign journal reports the promotion, and the map shows the three rank counts.

These points, thresholds, gains and one-rank-per-return rule are Granaderos tuning. They are not a verified reconstruction of JA2's promotion formula. Credit is bounded to 100 distinct opponents and 300 points per soldier; veterans stop accumulating it.

## Formal training custody

A new promotion course reserves three actual local cívicos. They must be stable, not bleeding, capable, above ten energy and outside the current deployment. Their records leave the deployable garrison while the course runs. Completion returns the same soldiers at the middle rank; cancellation or the instructor leaving returns them at their original rank. Occupation still disperses the course under the existing campaign rule.

Training preserves wounds, condition, loaded rounds, reserve cartridges, fittings, carried items and combat experience. The regular course costs 120 pesos and no longer consumes three horses. New-recruit course costs and duration formulas retain their existing tuning. If old aggregate militia counts have never been materialized, reserving trainees first creates their ordinary finite garrison records and takes initial cartridges from the campaign stock once.

Already paid legacy courses without individual trainee records remain readable. They complete or cancel under their original count contract, including a legacy top-rank course. Existing veterans also remain. This compatibility exception does not permit starting a new veteran course. Saved trainee identities and fitting ownership are validated, including against other courses and the deployable garrison.

## Evidence and remaining work

Eleven tests in `tests/militia-experience.test.mjs` cover actual paid kills through two returned deployments, wounds and equipment across promotions, repeated-hit limits, unfinished-sector identities, peaceful returns, deaths/dispersal, physical destination accounting, training completion/cancellation, unstable or deployed trainees, legacy courses, malformed records and private projection. Existing militia, garrison, assignment, equipment, exit and auto-resolve suites cover the shared paths.

Two component-render tests check the map's rank counts, the disabled training control for a full regular garrison, and the still-available civic promotion course at capacity. A full garrison cannot use the UI to request a paid veteran course.

The two-kill test uses declared controlled encounter fixtures. It does not fabricate the kills or promotion credit, but it is not a naturally occurring campaign defense. Live UI evidence is in [the verification record](../../verification/ja2-live-verification.md).

Militia remain directly controllable in tactical play. Autonomous militia commands are still an open requirement (S05). This increment does not implement that command model, militia medical assignments or a general strategic reinforcement economy.
