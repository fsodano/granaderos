import { WEAPONS } from './data.js';
import type { EquipmentItem, WeaponDefinition } from './public/compatibility-types.ts';

export interface HandCarrier {
  weapon?: number | string | WeaponDefinition;
  blade?: number | string;
  offHand?: EquipmentItem;
  weaponDropped?: boolean;
  activeSlot?: string;
  activeTool?: string;
  activeItem?: string;
  activeSupply?: string;
  leftHandItem?: string | null;
  inventory?: Record<string, EquipmentItem | number>;
  ammo?: number;
  rations?: number;
  medkits?: number;
  boleadoras?: number;
  torches?: number;
}
export interface HandLayout {
  right: string | null;
  left: string | null;
  twoHanded: boolean;
  stowed: string[];
  held: string[];
}
export function handsRequired(weaponId: HandCarrier['weapon']) {
  const id = typeof weaponId === 'object' ? weaponId.id : weaponId;
  const weapon = Object.entries(WEAPONS).find(([key]) => key === String(id))?.[1];
  return weapon?.type === 'firearm' && !(typeof id === 'number' && [1805, 1806, 1808].includes(id))
    ? 2
    : 1;
}
function supplyCount(unit: HandCarrier, key: string | null | undefined): number {
  switch (key) {
    case 'ammo':
      return unit.ammo ?? 0;
    case 'rations':
      return unit.rations ?? 0;
    case 'medkits':
      return unit.medkits ?? 0;
    case 'boleadoras':
      return unit.boleadoras ?? 0;
    case 'torches':
      return unit.torches ?? 0;
    default:
      return 0;
  }
}
function itemCount(unit: HandCarrier, item: string | null | undefined): number {
  if (!item) {
    return 0;
  }
  const record = item.startsWith('inventory:') ? unit.inventory?.[item.slice(10)] : undefined;
  return record !== undefined
    ? typeof record === 'number'
      ? record
      : (record.count ?? 0)
    : supplyCount(unit, item);
}
// References preserve one item owner while hands determine which records occupy pockets.
export function handLayout(unit: HandCarrier): HandLayout {
  const weapons = [
    ...(!unit.weaponDropped && unit.weapon ? ['primary'] : []),
    ...(unit.blade ? ['blade'] : []),
    ...(unit.offHand ? ['offhand'] : []),
  ];
  const id = (item: string) =>
    item === 'primary' ? unit.weapon : item === 'blade' ? unit.blade : unit.offHand?.weapon;
  const slot = unit.activeSlot ?? 'primary',
    tool = unit.activeTool
      ? unit.inventory?.[unit.activeTool.replace(/^inventory:/, '')]
      : undefined;
  const toolCount = typeof tool === 'number' ? tool : (tool?.count ?? 0);
  const right =
    slot === 'item' && itemCount(unit, unit.activeItem) > 0
      ? (unit.activeItem ?? null)
      : weapons.includes(slot)
        ? slot
        : slot === 'medical' && (unit.medkits ?? 0) > 0
          ? 'medkits'
          : slot === 'supply' && supplyCount(unit, unit.activeSupply) > 0
            ? (unit.activeSupply ?? null)
            : slot === 'tool' && toolCount > 0
              ? (unit.activeTool ?? null)
              : null;
  const required = right && weapons.includes(right) ? handsRequired(id(right)) : 1;
  const chosen = unit.leftHandItem;
  const chosenCount =
    chosen === 'primary'
      ? !unit.weaponDropped && unit.weapon
        ? 1
        : 0
      : chosen === 'blade'
        ? unit.blade
          ? 1
          : 0
        : chosen === 'offhand'
          ? unit.offHand
            ? 1
            : 0
          : itemCount(unit, chosen);
  const left =
    required === 2
      ? null
      : chosen !== undefined
        ? chosen && chosenCount > (chosen === right ? 1 : 0)
          ? chosen
          : null
        : slot === 'unarmed'
          ? null
          : (['offhand', 'blade', 'primary'].find(
              (item) => weapons.includes(item) && item !== right && handsRequired(id(item)) === 1,
            ) ?? null);
  const held = [right, left].filter((item): item is string => item !== null);
  return {
    right,
    left,
    twoHanded: Boolean(right && required === 2),
    stowed: weapons.filter((item) => !held.includes(item)),
    held,
  };
}
export function selectMainHand<Carrier extends HandCarrier>(
  unit: Carrier,
  selection: Pick<HandCarrier, 'activeSlot' | 'activeItem' | 'activeTool' | 'activeSupply'>,
): Carrier {
  const next = { ...unit, ...selection };
  if (selection.activeSlot !== 'item') {
    delete next.activeItem;
  }
  if (
    next.leftHandItem &&
    (handLayout(next).right === next.leftHandItem || handLayout(next).twoHanded)
  ) {
    next.leftHandItem = null;
  }
  if (selection.activeSlot === 'unarmed' && next.leftHandItem !== undefined) {
    next.leftHandItem = null;
  }
  return next;
}
