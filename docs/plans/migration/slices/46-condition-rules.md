# Slice 46: move condition and outcome rules into the domain

The domain owns the rules for combatant condition, medical-care eligibility, and
completed tactical victory. These are decisions about game state, not storage or
browser behavior.

## Personnel condition

[`actor-condition.ts`](../../../../packages/game/domain/personnel/actor-condition.ts)
uses `HealthRules.CriticalHealth` (15) as the threshold.
`isUnconscious` is true for a living combatant below that threshold or with no
energy. `fieldCapable` means a combatant still counts as holding the field: the
combatant must have at least 15 hit points and must not have departed, fled, or
surrendered. Field capability is separate from consciousness or action points:
a routed combatant still counts as field-capable until leaving.

`refreshMilitaryCondition` recomputes unconsciousness instead of trusting a
saved flag. It lowers the weapon for a dead, unconscious, knocked-down, routed,
or weapon-dropped combatant. Death or unconsciousness clears action points,
mount state, bracing, and overwatch; death also clears bleeding.

## Medical care

[`medical-patient.ts`](../../../../packages/game/domain/personnel/medical-patient.ts)
decides whether a living person is present for care and whether care is
available. A departed, fled, surrendered, captured, captive, or detained person
is not present; a person released from detention can be present. A conscious
routed soldier refuses care, while an unconscious routed soldier can receive it.

## Completed victory

[`completed-victory.ts`](../../../../packages/game/domain/combat/completed-victory.ts)
decides whether the field is won. The battle must be in the player's phase with
no pending enemy or allied turn, interruption, or reaction stack. It must have
victory status, or be active exploration with the sector cleared. At least one
player combatant must still hold the field, and no enemy combatant may still
hold it.

## Retained import paths

[`actor-condition.js`](../../../../packages/game/actor-condition.js),
[`medical-patient.js`](../../../../packages/game/medical-patient.js), and
[`battle-outcome.js`](../../../../packages/game/battle-outcome.js) re-export the
domain rules. Existing callers keep those import paths; rule ownership and
implementation stay in the domain modules.

The domain tests cover condition refresh and field capability
([`actor-condition.test.ts`](../../../../packages/game/domain/personnel/actor-condition.test.ts)),
care presence and acceptance
([`medical-patient.test.ts`](../../../../packages/game/domain/personnel/medical-patient.test.ts)),
and completed-victory conditions
([`completed-victory.test.ts`](../../../../packages/game/domain/combat/completed-victory.test.ts)).
