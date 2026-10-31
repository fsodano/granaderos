import { setTestAmmunition } from './typed-ammunition-fixture.ts';
import { ammoTypeFor } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
// Explicit test setup replaces physical reserves; HUD counts are derived.
export function setReserve(
  unit: BattleUnit & { ammunition?: Record<string, number> },
  count: number,
) {
  delete unit.ammunition;
  return setTestAmmunition(
    unit,
    count,
    present(
      Object.values(AMMUNITION_FAMILIES).find(
        (family) => family.id === (ammoTypeFor(unit) ?? 'ammoMusket'),
      ),
    ).type,
  );
}
