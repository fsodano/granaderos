import { equipmentEndpoint, itemDescriptor, itemQuantity } from './tactical-inventory.js';
import { WEAPONS } from './data.js';
import { AMMUNITION_TYPES } from './ammunition-types.js';
import type { InventoryActor } from './public/inventory-types.ts';
import type { ItemDescriptor } from './public/item-types.ts';

export interface ItemInspection extends ItemDescriptor {
  count: number;
  totalWeight: number;
  capacity?: number;
  damage?: number;
  range?: number;
  help: string;
}

// A physical pocket contains one stack, not the aggregate carried quantity.
export function inspectEquipmentItem(
  unit: InventoryActor,
  reference: string,
  slotId = '',
): ItemInspection | null {
  const endpoint = slotId ? equipmentEndpoint(unit, slotId) : null;
  const item = endpoint ? endpoint.item : reference;
  if (
    !item ||
    (item.startsWith('inventory:') && !Object.hasOwn(unit.inventory ?? {}, item.slice(10))) ||
    itemQuantity(unit, item) < 1
  ) {
    return null;
  }
  const description = itemDescriptor(unit, item),
    count = endpoint ? endpoint.count : itemQuantity(unit, item);
  const weapon = Object.values(WEAPONS).find((value) => value.id === description.weapon);
  const ammunition = Object.entries(AMMUNITION_TYPES).find(
    ([id]) => id === description.ammoType,
  )?.[1];
  const result: ItemInspection = {
    ...description,
    count,
    totalWeight: description.weight * count,
    ...(weapon
      ? {
          ...(weapon.type === 'firearm' && 'capacity' in weapon
            ? { capacity: weapon.capacity }
            : {}),
          damage: weapon.damage,
          range: weapon.range,
        }
      : {}),
    help:
      (description.description ? `${description.description} ` : '') +
      (ammunition
        ? 'Colocá estos cartuchos sobre una pila compatible para combinarlos, o sobre un arma compatible para cargarla.'
        : description.slotSize > 1
          ? 'Necesita un bolsillo grande.'
          : 'Cabe en un bolsillo pequeño o grande.'),
  };
  if (weapon && weapon.type !== 'firearm') {
    delete result.loaded;
  }
  return result;
}
