# Escort gameplay work

Status: **in progress**. The movement layer exists; an escort cannot yet be accepted or directed through the campaign interface. This does not close W07 or W08.

## Physical movement

A saved civilian escort directive identifies a leader and whether the civilian is waiting. On the existing civilian cadence, a following escort uses actual cardinal routes, doors, occupancy and climbing links to approach an adjacent cell. Movement uses the existing finite civilian budget and never grants player AP. The civilian waits if the leader is absent, incapacitated, departed, routed or unavailable, or when no route reaches the leader. Restraint and knockdown prevent escort movement. Heard danger takes precedence over following and waiting; the existing shelter behavior runs until the threat expires.

Directive shape is validated in tactical saves. The order survives deterministic save restoration. Existing civilians without a directive retain their normal routines.

Twenty-three focused civilian, escort and grenade-lifecycle checks pass. Type checking and the production build also pass for the initial movement implementation; the subsequent restraint guard is covered by the focused run.

## Required integration

- Add an authored contact and escort objective with explicit acceptance, following and waiting controls.
- Bind tactical directives to the accepted campaign quest, including changing the leader through a local interaction.
- Require actual arrival at the named destination; do not infer success from a strategic visit or time passage.
- Preserve intermediate positions, injury, death failure, completed outcomes and one-time rewards through all save and return paths.
- Verify the full user flow through dialogue, movement, rejected actions, completion and reload in the live game.
- Implement prison rescue and escape separately; a following civilian is not proof of prisoner custody or release.
