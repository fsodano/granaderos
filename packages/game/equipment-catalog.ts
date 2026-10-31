import { WEAPONS } from './data.js';
import { artilleryProfile } from './artillery-definitions.ts';
import {
  compileWeaponDefinition,
  contentWeaponOf,
  weaponSpecification,
} from './weapon-definition.ts';
import { fittingLabel } from './weapon-fittings.js';
import type { CampaignSnapshot } from './public/campaign-types.ts';
import type { EquipmentCatalogItem, EquipmentKeyInput } from './public/equipment-types.ts';

export function usesAuthoredEquipment(state?: CampaignSnapshot | null): boolean {
  return (
    state?.contentCampaign !== undefined &&
    ['character-weapons-v2', 'character-presence-v1'].includes(state.contentCampaign.adapter)
  );
}
function weaponPrice(id: number): number {
  const price = weaponSpecification(id)?.price;
  if (price === undefined) {
    throw Error('La familia del arma no tiene precio de catálogo.');
  }
  return price;
}
export const EQUIPMENT_CATALOG: readonly EquipmentCatalogItem[] = [
  ...Object.values(WEAPONS)
    .filter((weapon) => weapon.id >= 1800 && weapon.id <= 1813)
    .map((weapon): EquipmentCatalogItem => ({
      ...weapon,
      item: weapon.id,
      stockKey: String(weapon.id),
      category: weapon.id < 1809 ? 'firearm' : 'blade',
      price: weaponPrice(weapon.id),
    })),
  {
    ...WEAPONS[1811],
    item: 1811,
    stockKey: '1811:india_socket',
    fittingPattern: 'india_socket',
    name: fittingLabel('india_socket'),
    category: 'blade',
    price: 50,
  },
  {
    item: 'bronze4',
    id: 1820,
    name: 'Cañón de bronce de 4 libras',
    category: 'artillery',
    price: 700,
    crew: 2,
  },
  {
    item: 'field8',
    id: 1821,
    name: 'Cañón de campaña de 8 libras',
    category: 'artillery',
    price: 1100,
    crew: 3,
  },
  {
    item: 'swivel',
    id: 1822,
    name: 'Pedrero de regala',
    category: 'artillery',
    price: 400,
    crew: 1,
  },
];
// Stored and carried objects retain the same authored stock identity.
export function equipmentKey(value: EquipmentKeyInput | string | number): string {
  const record = typeof value === 'object' ? value : null;
  const definition = contentWeaponOf(value) ?? record?.itemMetadata?.contentWeapon;
  if (definition) {
    return definition.id;
  }
  if (record?.stockKey !== undefined) {
    return record.stockKey;
  }
  const raw = typeof value === 'object' ? (value.weapon ?? value.item ?? value.id) : value;
  const item = typeof raw === 'object' ? raw.id : raw;
  return record?.fittingPattern ? `${item}:${record.fittingPattern}` : String(item);
}
export function equipmentCatalog(state?: CampaignSnapshot | null): EquipmentCatalogItem[] {
  const catalog = EQUIPMENT_CATALOG.map((weapon): EquipmentCatalogItem =>
    weapon.category === 'artillery'
      ? {
          ...weapon,
          ...(state?.contentCampaign?.package.artilleryProfiles
            ? artilleryProfile(state, String(weapon.item))
            : {}),
          art: artilleryProfile(state, String(weapon.item)).art,
        }
      : weapon,
  );
  if (!usesAuthoredEquipment(state) || !state?.contentCampaign) {
    return catalog;
  }
  const authored = state.contentCampaign.package.weapons;
  return [
    ...authored.map((weapon): EquipmentCatalogItem => {
      const contentWeapon = compileWeaponDefinition(weapon);
      return {
        ...contentWeapon,
        id: weapon.template,
        item: weapon.id,
        stockKey: weapon.id,
        category: Number(weapon.template) < 1809 ? 'firearm' : 'blade',
        contentWeapon,
      };
    }),
    ...catalog.filter(
      (weapon) =>
        weapon.category !== 'firearm' &&
        (weapon.fittingPattern ||
          !authored.some((definition) => definition.template === weapon.id)),
    ),
  ];
}
export function equipmentCatalogItem(
  key: string | number,
  state?: CampaignSnapshot | null,
): EquipmentCatalogItem | undefined {
  return (state ? equipmentCatalog(state) : EQUIPMENT_CATALOG).find(
    (weapon) => String(weapon.stockKey ?? weapon.item) === String(key),
  );
}
export function equipmentLabel(record: EquipmentKeyInput): string {
  return (
    (contentWeaponOf(record) ?? record.itemMetadata?.contentWeapon)?.name ??
    equipmentCatalogItem(equipmentKey(record))?.name ??
    'Equipo desconocido'
  );
}
export function armoryInventory(
  state: CampaignSnapshot,
): Array<EquipmentCatalogItem & { stockKey: string; quantity: number }> {
  return equipmentCatalog(state).map((item) => ({
    ...item,
    stockKey: equipmentKey(item),
    quantity:
      item.category === 'artillery'
        ? (state.armory[item.item] ?? 0)
        : state.armoryItems.filter((record) => equipmentKey(record) === equipmentKey(item)).length,
  }));
}
export function isImportedEquipment(item: EquipmentKeyInput | null | undefined): boolean {
  return [1800, 1802].includes(
    Number(
      item?.contentWeapon?.template ?? item?.itemMetadata?.contentWeapon?.template ?? item?.item,
    ),
  );
}
