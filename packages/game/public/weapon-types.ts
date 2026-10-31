import type {
  CompiledWeaponDefinition,
  ProjectileProfile,
  WeaponDefinition,
} from '../../campaign-format/types.ts';

/** Compatibility family data retained when a campaign overrides a weapon. */
export type WeaponProfile = ProjectileProfile & {
  id: string | number;
  name?: string;
  type?: string;
  category?: string;
  caliber?: string;
  damage?: number;
  capacity?: number;
  readyAP?: number;
  fireAP?: number;
  aimAP?: number;
  reloadAP?: number;
  attackAP?: number;
  ap?: number;
  reach?: number;
  range?: number;
  weight?: number;
  crew?: number;
  radius?: number;
  rifled?: boolean;
  spread?: boolean;
  stockAP?: number;
  stockDamage?: number;
  stockReach?: number;
};

export type WeaponCarrier = {
  id?: string | number;
  weapon?: string | number | WeaponProfile;
  item?: string | number;
  blade?: string | number;
  contentWeapon?: WeaponDefinition;
  weaponMetadata?: { contentWeapon: WeaponDefinition };
  bladeMetadata?: { contentWeapon: WeaponDefinition };
  ammunitionChoice?: string;
  loaded?: number;
  reloadProgress?: number;
  weaponDropped?: boolean;
  bladeCondition?: number;
  bladeJammed?: boolean;
  jammed?: boolean;
  condition?: number;
  weight?: number;
  count?: number;
};
export type WeaponReference = WeaponCarrier | string | number | null | undefined;
export type WeaponSlot = 'primary' | 'blade';
export type WeaponSpecification = WeaponProfile & {
  name: string;
  damage: number;
  fireAP: number;
  range: number;
  capacity: number;
  art: string;
  price: number | undefined;
  contentId?: string;
  loadPattern?: 'single' | 'cone';
};
export type WeaponMetadata = { contentWeapon: CompiledWeaponDefinition };
