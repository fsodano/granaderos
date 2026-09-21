# Local escort gameplay

The Jujuy arriero now offers **Escolta hasta la salida de la Quebrada**. Accept through adjacent dialogue. The arriero follows that soldier through the actual tactical map. **Esperar aquí** stops routine following; **Seguir a este combatiente** resumes or changes the leader through another adjacent conversation. Remote orders are rejected.

Lead the arriero to Jujuy's western boundary toward Humahuaca. Both people must be adjacent, on the ground level, with one on that boundary. Speak there and select **Confirmar llegada a la salida**. Jujuy and Humahuaca must be under patriot control. Completion records the actual arrival geometry and grants the existing local quest loyalty reward once. It does not pay cash or move either person into another sector. The arriero waits at the exit for the recua.

## Movement and persistence

On the existing civilian cadence, an escort uses actual routes, doors, occupancy and climbing links. Movement spends the finite civilian movement budget and does not grant player AP. The escort waits when the leader is absent, incapacitated, departed, routed or unavailable, or when no route reaches the leader. Restraint and knockdown prevent movement. Heard danger takes precedence over following and waiting; shelter behavior runs until the threat expires.

Campaign acceptance owns the directive. Active saves reject mismatched following/waiting orders, unauthorized escorts and a missing accepted escort. Intermediate positions and orders survive return/reentry. Death permanently fails an unfinished errand; a completed outcome stays completed. The notebook states the destination, current waiting order, terminal result and required sector control.

## Verification

- Movement checks cover finite steps, doors, occupancy, absent leaders, restraint, danger and deterministic tactical saves.
- Campaign cases use paid recruits in an explicitly secured Jujuy/Humahuaca fixture. Actual movement, civilian following and adjacent dialogue earn completion. They check premature completion, unsafe destination control, one-time reward, leader changes, death, missing/forged directives, intermediate return and completed reentry. This is subsystem evidence, not a fresh campaign conquest.
- Live verification accepted, paused and resumed the escort through dialogue. The leader walked from (25,22) to (0,23), spending energy from 96 to 70. The arriero followed from (25,23) to (2,23), then reached (1,23) during an ordinary rest. Adjacent arrival confirmation completed the errand. Reload, continue and the campaign notebook retained **Cumplido**.

The integrated suite passes **2,571/2,571 tests with no skips**. The final intermediate-return case and failure-text change were added after that run started; their 14-test follow-up passes. Final type checking and the production build pass.

## Remaining scope

This is a local escort objective with a physical exit destination. Cross-sector passengers, alternative resolutions, prison rescue and escape remain separate audit work. The escort feature does not prove captive custody or release.
