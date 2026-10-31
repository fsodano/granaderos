import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import {
  addAmmunition,
  isAmmunitionStack,
  weaponAmmoType,
} from '../packages/game/ammunition-types.js';
import { syncUnitAmmunition } from '../packages/game/tactical-ammunition.js';

// Explicit test setup only. Replace physical loose stock, then derive the HUD
// total; changing unit.ammo after creation cannot provision a weapon.
export function setTestAmmunition(
  unit: BattleUnit,
  count: number,
  type = weaponAmmoType(unit.weapon) ?? 'musket_75',
) {
  unit.inventory = Object.fromEntries(
    Object.entries(unit.inventory ?? {}).filter(([, stack]) => !isAmmunitionStack(stack)),
  );
  if (count) {
    addAmmunition(unit, type, count);
  }
  syncUnitAmmunition(unit);
  return unit;
}
