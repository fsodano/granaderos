// Held consumables use the same targeting command as weapons and field dressings.
// Costs and ranges are Granaderos tuning on the 100 AP scale.

export type HeldSupplyKey = 'torches' | 'boleadoras' | 'rations';

export type HeldSupply = Readonly<{
  key: HeldSupplyKey;
  name: string;
  action: string;
  cost: number;
  range: number;
}>;

export type HeldSupplyInHand = Readonly<HeldSupply & { count: number }>;

export type HeldSupplyCombatant = {
  activeSlot?: string | null;
  activeSupply?: string;
  torches?: number;
  boleadoras?: number;
  rations?: number;
};

export const HELD_SUPPLIES: Readonly<Record<HeldSupplyKey, HeldSupply>> = Object.freeze({
  torches: Object.freeze({
    key: 'torches',
    name: 'Antorcha',
    action: 'throwTorch',
    cost: 10,
    range: 8,
  }),
  boleadoras: Object.freeze({
    key: 'boleadoras',
    name: 'Boleadoras',
    action: 'boleadoras',
    cost: 12,
    range: 8,
  }),
  rations: Object.freeze({
    key: 'rations',
    name: 'Ración de tasajo',
    action: 'ration',
    cost: 10,
    range: 0,
  }),
});

const isHeldSupplyKey = (value: string | undefined): value is HeldSupplyKey =>
  value !== undefined && Object.hasOwn(HELD_SUPPLIES, value);

export function heldSupply(unit: HeldSupplyCombatant | null | undefined): HeldSupplyInHand | null {
  if (unit?.activeSlot !== 'supply' || !isHeldSupplyKey(unit.activeSupply)) {
    return null;
  }
  const count = unit[unit.activeSupply];
  return typeof count === 'number' && Number.isInteger(count) && count > 0
    ? { ...HELD_SUPPLIES[unit.activeSupply], count }
    : null;
}

export function clearEmptySupply<T extends HeldSupplyCombatant>(unit: T): T {
  if (unit.activeSlot === 'supply' && !heldSupply(unit)) {
    unit.activeSlot = 'unarmed';
    delete unit.activeSupply;
  }
  return unit;
}
