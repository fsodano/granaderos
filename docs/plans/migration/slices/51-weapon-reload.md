# Slice 51: weapon reload rules belong to the domain

A firearm reload needs one owner for the action-point cost of each round, the
validity of saved partial progress, and the plan for applying work to the
weapon. [`ReloadWork`](../../../../packages/game/domain/combat/reload-work.ts)
calculates completed rounds and the next partial progress; `ReloadRules` in the
same module supplies the reload multipliers. Keeping the surrounding
calculations beside them prevents callers from using different costs or
accepting progress that reload work cannot apply.

## Domain ownership

[`weapon-reload.ts`](../../../../packages/game/domain/combat/weapon-reload.ts)
owns `reloadRoundCost`, `validateReloadProgress`, and `planReload`.
`reloadRoundCost` combines the weapon's total reload work and capacity with the
combat-balance multiplier, the combatant's stance, assistance, and gunsmith
training. `validateReloadProgress` accepts no stored value or a finite fraction
of one round strictly between zero and one, and rejects progress when the weapon
has no remaining capacity or is dropped. `planReload` passes loaded rounds, reserve
ammunition, capacity, saved progress, and round cost to `ReloadWork`. It limits
work by available action points during combat and allows unbounded work during
exploration; `ReloadWork` calculates completed rounds and remaining progress.

Test data in
[`weapon-reload.test.ts`](../../../../packages/game/domain/combat/weapon-reload.test.ts)
uses `reloadAP: 10` (total reload work) and `capacity: 5` (round capacity). An
unassisted standing round costs 2 action points; prone stance makes it cost 3.
Without one shared cost rule, combat action-point budgets can disagree with the
progress assigned to a reload.

[`weapon-reload.js`](../../../../packages/game/weapon-reload.js) re-exports the
domain functions so existing callers keep their import path.

That test file covers standing and prone costs, assistance and gunsmith
modifiers, and valid or invalid stored progress.
