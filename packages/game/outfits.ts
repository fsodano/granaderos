import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
export const OUTFIT_CHANGE_AP = 8;
export const PONCHO_PRICE = 20;
export const PONCHO_STOCK_CAP = 6;
export const PONCHO_DAILY_RESTOCK = 1;
export const BODY_SLOTS = Object.freeze(['headwear', 'outfit', 'legwear'] as const);
export type BodySlot = (typeof BODY_SLOTS)[number];
export interface OutfitDefinition {
  name: string;
  weight: number;
  slot: BodySlot;
}
export interface OutfitRecord {
  kind: 'outfit';
  outfit: string;
  count: number;
  weight: number;
  condition: number;
  instanceId?: string;
}
export interface OutfitCarrier {
  headwear?: OutfitRecord | null;
  outfit?: OutfitRecord | null;
  legwear?: OutfitRecord | null;
  poncho?: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bodySlot = (value: unknown): value is BodySlot =>
  value === 'headwear' || value === 'outfit' || value === 'legwear';
function outfitDefinitions(value: unknown): Readonly<Record<string, Readonly<OutfitDefinition>>> {
  if (!object(value)) {
    throw Error('Invalid outfit catalogue');
  }
  const definitions: Record<string, Readonly<OutfitDefinition>> = {};
  for (const [id, definition] of Object.entries(value)) {
    if (
      !object(definition) ||
      typeof definition['name'] !== 'string' ||
      typeof definition['weight'] !== 'number' ||
      !Number.isFinite(definition['weight']) ||
      !bodySlot(definition['slot'])
    ) {
      throw Error(`Invalid outfit definition: ${id}`);
    }
    definitions[id] = Object.freeze({
      name: definition['name'],
      weight: definition['weight'],
      slot: definition['slot'],
    });
  }
  return Object.freeze(definitions);
}
export const OUTFITS = outfitDefinitions(DEFAULT_CATALOGUE.outfitDefinitions);
export const outfitSlot = (value: OutfitRecord | null | undefined) =>
  value ? (OUTFITS[value.outfit]?.slot ?? null) : null;
export function makeOutfit(kind = 'poncho', condition = 100): OutfitRecord {
  const spec = Object.hasOwn(OUTFITS, kind) && OUTFITS[kind];
  if (!spec) {
    throw Error('La vestimenta no existe.');
  }
  return { kind: 'outfit', outfit: kind, count: 1, weight: spec.weight, condition };
}
export function validateOutfit(
  value: unknown,
  { worn = false, slot = null }: { worn?: boolean; slot?: string | null } = {},
): asserts value is OutfitRecord | null | undefined {
  if (value == null) {
    return;
  }
  const spec =
    object(value) && typeof value['outfit'] === 'string' && Object.hasOwn(OUTFITS, value['outfit'])
      ? OUTFITS[value['outfit']]
      : null;
  if (
    !object(value) ||
    !spec ||
    (slot && spec.slot !== slot) ||
    value['kind'] !== 'outfit' ||
    typeof value['count'] !== 'number' ||
    !Number.isSafeInteger(value['count']) ||
    value['count'] < 0 ||
    value['count'] > 1000000 ||
    (worn && value['count'] !== 1) ||
    value['weight'] !== spec.weight ||
    typeof value['condition'] !== 'number' ||
    !Number.isFinite(value['condition']) ||
    value['condition'] < 0 ||
    value['condition'] > 100 ||
    [
      'weapon',
      'loaded',
      'reloadProgress',
      'jammed',
      'fittings',
      'fittingPattern',
      'toolKey',
      'itemType',
    ].some((key) => value[key] !== undefined)
  ) {
    throw Error('La vestimenta no es válida.');
  }
  const identity = value['instanceId'];
  if (
    identity !== undefined &&
    (typeof identity !== 'string' ||
      !identity.length ||
      identity.length > 100 ||
      /[<>]/.test(identity) ||
      identity.split('').some((character) => character.charCodeAt(0) < 32) ||
      value['count'] > 1 ||
      ['__proto__', 'prototype', 'constructor'].includes(identity))
  ) {
    throw Error('La identidad de la vestimenta no es válida.');
  }
}
export function wornOutfit(unit: OutfitCarrier, slot = 'outfit'): OutfitRecord | null {
  if (!bodySlot(slot)) {
    throw Error('La ranura de vestimenta no existe.');
  }
  const outfit =
    slot === 'outfit' && unit.outfit === undefined
      ? unit.poncho
        ? makeOutfit()
        : null
      : (unit[slot] ?? null);
  validateOutfit(outfit, { worn: true, slot });
  return outfit;
}
export const wornBodyItems = (unit: OutfitCarrier) =>
  BODY_SLOTS.filter((slot) => wornOutfit(unit, slot));
export function normalizeOutfit<Carrier extends OutfitCarrier>(unit: Carrier): Carrier {
  for (const slot of BODY_SLOTS) {
    unit[slot] = structuredClone(wornOutfit(unit, slot));
  }
  delete unit.poncho;
  return unit;
}
export const hasPoncho = (unit: OutfitCarrier) => {
  const outfit = wornOutfit(unit);
  return outfit?.outfit === 'poncho' && outfit.condition > 0;
};
// A wound wears only the recipient's existing regional garment.
export function regionalGarmentWear(
  recipient: OutfitCarrier | null | undefined,
  hitLocation: string,
  actualHPLoss: number,
): { slot: BodySlot; garment: OutfitRecord; wear: number } | null {
  if (!recipient || !Number.isFinite(actualHPLoss) || actualHPLoss <= 0) {
    return null;
  }
  const slot =
    hitLocation === 'head'
      ? 'headwear'
      : hitLocation === 'torso'
        ? 'outfit'
        : hitLocation === 'legs'
          ? 'legwear'
          : null;
  if (!slot || !recipient[slot]) {
    return null;
  }
  const record = recipient[slot];
  try {
    validateOutfit(record, { worn: true, slot });
    if (record.condition === 0) {
      return null;
    }
    const wear = Math.min(record.condition, Math.ceil(actualHPLoss / 5));
    return {
      slot,
      garment: { ...structuredClone(record), condition: record.condition - wear },
      wear,
    };
  } catch {
    return null;
  }
}
export function issueInitialOutfit(
  campaign: { operativeState: Record<string, OutfitCarrier> },
  id: string | number,
) {
  const record = campaign.operativeState[id];
  if (!record) {
    throw Error('No existe el equipo del combatiente.');
  }
  if (record.outfit !== undefined) {
    return;
  }
  record.headwear ??= makeOutfit('hat');
  record.legwear ??= makeOutfit('trousers');
  record.outfit = makeOutfit();
}
