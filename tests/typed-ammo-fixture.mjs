import { setTestAmmunition } from './typed-ammunition-fixture.ts';
import { ammoTypeFor } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
// Explicit test setup replaces physical reserves; HUD counts are derived.
export function setReserve(unit, count) {
  delete unit.ammunition;
  return setTestAmmunition(
    unit,
    count,
    AMMUNITION_FAMILIES[ammoTypeFor(unit) ?? 'ammoMusket'].type,
  );
}
