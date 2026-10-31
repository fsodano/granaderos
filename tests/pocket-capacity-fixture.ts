import { personalPockets } from '../packages/game/personal-pockets.ts';
import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
// Declared full-pack boundary: fill free slots with finite unequipped pieces.
export function fillSparePockets(unit: BattleUnit) {
  unit.inventory ??= {};
  for (const slot of personalPockets(unit).slots.filter((p) => !p.entry)) {
    unit.inventory[`fixture-${slot.id}`] = {
      weapon: slot.size === 'large' ? 1800 : 1813,
      count: 1,
      weight: slot.size === 'large' ? 4 : 1.3,
      loaded: 0,
      condition: 100,
    };
  }
}
