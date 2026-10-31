import type { CompiledWeaponDefinition, WeaponDefinition } from '../../campaign-format/types.ts';
import type { CampaignSnapshot, StoredEquipmentInstance } from './campaign-types.ts';
import type { WeaponCarrier, WeaponProfile } from './weapon-types.ts';
export type EquipmentCatalogItem = WeaponProfile & {
  item: string | number;
  stockKey?: string;
  category: 'firearm' | 'blade' | 'artillery';
  name: string;
  price: number;
  art?: string;
  fittingPattern?: string;
  contentWeapon?: CompiledWeaponDefinition;
};
export type EquipmentKeyInput = WeaponCarrier & {
  stockKey?: string;
  fittingPattern?: string;
  itemMetadata?: { contentWeapon?: WeaponDefinition };
};
export type ArmoryOption = {
  key: string;
  item: string;
  instanceId: string;
  name: string;
  condition: number;
  fittings: StoredEquipmentInstance['fittings'];
  jammed: boolean;
};
export type SupplyPredicate = (state: CampaignSnapshot, sector: string) => boolean;
export type EquipmentPriceBreakdown = {
  items: { name: string; condition: number; price: number }[];
  total: number;
};
export type EquipmentResaleBreakdown = EquipmentPriceBreakdown & { reason: string | null };
export type MerchantStatus = {
  sector: string;
  available: boolean;
  reason: string | null;
  stock: number;
  restockIn: number;
  cash: number;
};
export type MerchantExchangeOffer = {
  key: string;
  label: string;
  price: number;
  available: number;
  receipt: string;
  reason: string | null;
  sell: boolean;
} & (
  | {
      kind: 'weapon';
      instance: StoredEquipmentInstance;
      catalog?: never;
      gun?: never;
      action?: never;
    }
  | { kind: 'new'; catalog: EquipmentCatalogItem; instance?: never; gun?: never; action?: never }
  | {
      kind: 'artillery';
      instance?: never;
      catalog?: never;
      gun: import('./artillery-query-types.ts').ArtilleryTradeGun;
      action: import('./artillery-query-types.ts').ArtilleryTradeAction;
    }
);
export type MerchantExchangePreview = {
  valid: boolean;
  reason: string | null;
  sales: number;
  purchases: number;
  net: number;
  lines: Array<MerchantExchangeOffer & { quantity: number }>;
};
