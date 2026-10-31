import type { EquipmentItem } from './public/compatibility-types.ts';
import type { WeaponCarrier } from './public/weapon-types.ts';
import {
  AMMUNITION_TYPES,
  weaponAmmoType,
  validateAmmunitionStack,
  ammunitionByType,
} from './ammunition-types.js';

type AmmunitionCountStack = Omit<EquipmentItem, 'item'> & {
  item?: string | number;
  itemMetadata?: WeaponCarrier['weaponMetadata'];
};
type AmmunitionOwner = WeaponCarrier & {
  offHand?: AmmunitionCountStack;
  equipmentCursor?: { stack: AmmunitionCountStack };
  inventory?: Record<string, AmmunitionCountStack | number>;
};
export function addAmmoCounts(
  target: Record<string, number>,
  source: Readonly<Record<string, number>> | null | undefined,
  factor = 1,
) {
  for (const [type, n] of Object.entries(source ?? {})) {
    if (
      !Object.hasOwn(AMMUNITION_TYPES, type) ||
      !Number.isSafeInteger(n) ||
      n < 0 ||
      n > 1000000000
    ) {
      throw Error('La cuenta de munición no es válida.');
    }
    target[type] = (target[type] ?? 0) + n * factor;
  }
  return target;
}
export function stackAmmunitionByType(
  stack: AmmunitionCountStack | number | null | undefined,
): Record<string, number> {
  if (!stack || typeof stack !== 'object') {
    return {};
  }
  if (stack.kind === 'ammunition') {
    validateAmmunitionStack(stack);
    if (typeof stack.count !== 'number' || typeof stack.ammoType !== 'string') {
      throw Error('La cantidad de munición no es válida.');
    }
    return stack.count ? { [stack.ammoType]: stack.count } : {};
  }
  const type = weaponAmmoType(
    stack.weapon !== undefined
      ? stack
      : typeof stack.item === 'number'
        ? { ...stack, weapon: stack.item, weaponMetadata: stack.itemMetadata }
        : null,
  );
  return type && stack.loaded ? { [type]: stack.loaded * (stack.count ?? 1) } : {};
}
export function unitAmmunitionByType(unit: AmmunitionOwner): Record<string, number> {
  const result = ammunitionByType(unit),
    type = weaponAmmoType(unit);
  if (type && !unit.weaponDropped && unit.loaded) {
    addAmmoCounts(result, { [type]: unit.loaded });
  }
  addAmmoCounts(result, stackAmmunitionByType(unit.offHand));
  addAmmoCounts(result, stackAmmunitionByType(unit.equipmentCursor?.stack));
  for (const item of Object.values(unit.inventory ?? {})) {
    if (typeof item !== 'object' || item.kind !== 'ammunition') {
      addAmmoCounts(result, stackAmmunitionByType(item));
    }
  }
  return result;
}
