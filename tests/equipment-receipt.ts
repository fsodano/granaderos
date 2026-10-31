import { validateItemStack } from '../packages/game/tactical-inventory.js';
import type { EquipmentItem } from '../packages/game/public/compatibility-types.ts';

function assertEquipmentReceipt(
  value: unknown,
): asserts value is EquipmentItem & { item: string; count: number } {
  validateItemStack(value);
}

export function equipmentReceipt(
  serialized: string,
): EquipmentItem & { item: string; count: number } {
  const value: unknown = JSON.parse(serialized);
  assertEquipmentReceipt(value);
  return value;
}
