import type { WeaponDefinition } from '../../campaign-format/types.ts';
import type { EquipmentItem, WeaponFitting } from './compatibility-types.ts';
import type { InventoryPocketLayout } from './hud-types.ts';
import type { WeaponCarrier } from './weapon-types.ts';

export interface ItemStack extends Omit<EquipmentItem, 'weapon' | 'contentWeapon'> {
  item: string;
  count: number;
  weight: number;
  weapon?: number;
  contentWeapon?: WeaponDefinition;
  jammed?: boolean;
  ammunitionChoice?: string;
  grenadeType?: string;
  repairPoints?: number;
}
export interface HandRecord extends Omit<ItemStack, 'item' | 'weapon'> {
  item?: string;
  weapon: number;
  loaded: number;
  condition: number;
  jammed: boolean;
}
export interface InventoryCarrier extends WeaponCarrier {
  offHand?: EquipmentItem;
  inventory?: Record<string, EquipmentItem | number>;
  weaponInstanceId?: string;
  bladeInstanceId?: string;
  weaponFittings?: Record<string, WeaponFitting>;
  weaponFittingPattern?: string;
  bladeFittingPattern?: string;
}
export interface ItemDescriptor {
  item: string;
  label: string;
  name?: string;
  stackLimit: number;
  slotSize: number;
  weight: number;
  kind:
    | 'supply'
    | 'repair-kit'
    | 'ammunition'
    | 'grenade'
    | 'outfit'
    | 'weapon'
    | 'tool'
    | 'inventory';
  art?: string;
  description?: string;
  weapon?: number;
  loaded?: number;
  condition?: number;
  ammoType?: string;
  grenadeType?: string;
}
export interface EquipmentEndpoint {
  id: string;
  kind: 'cursor' | 'outfit' | 'hand' | 'pocket';
  item: string | null;
  count: number;
  side?: 'left' | 'right';
  blocked?: boolean;
  size?: 'large' | 'small';
  label?: string;
  entry?: InventoryPocketLayout['slots'][number]['entry'];
}
export interface EquipmentAttachmentHost {
  hostId: string;
  stack: ItemStack;
  supported: boolean;
  fitting: WeaponFitting | null;
}
