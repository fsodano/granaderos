import type {
  CampaignEquipmentSlot,
  CampaignInventoryOrder,
  CampaignOperative,
} from './campaign-types.ts';
import type { InventoryPocketLayout } from './hud-types.ts';
export type CampaignInventoryActor = Omit<CampaignOperative, 'id'> & {
  id: string;
  side: 'player';
  loaded: number;
  ap: number;
  energy: number;
  unconscious: false;
  movementMode: 'walk';
  stance: 'standing';
};
export type SectorInventorySite = { id: string; name: string; count: number; repairPoints: number };
export type DiscoveredEquipment = {
  key: string;
  label: string;
  count: number;
  kind: string;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  operativeId?: number;
  operativeName?: string;
  condition?: number | undefined;
  loaded?: number | undefined;
  jammed?: boolean | undefined;
};
export type SectorInventoryEntry = DiscoveredEquipment & {
  expected: string;
  reachable: boolean;
  reason: string | null;
  fittingPattern?: string | undefined;
};
export type RepairReserve = {
  key: string;
  label: string;
  repairPoints: number;
  capacity: number;
  expected: string;
  reachable: boolean;
  reason: string | null;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  operativeId?: number;
  operativeName?: string;
};
export type PrepareCarriedHand = {
  label: string;
  valid: boolean;
  reason: string | null;
  action: Omit<Extract<CampaignInventoryOrder, { direction: 'equip' }>, 'direction'>;
};
export type CarriedEquipment = {
  item: string;
  label: string;
  count: number;
  loaded?: number | undefined;
  condition?: number | undefined;
  jammed?: boolean | undefined;
  reloadProgress?: number | undefined;
  expected?: string;
  inventoryKey?: string | null;
  equip?: { slot: CampaignEquipmentSlot; label?: string; valid: boolean; reason: string | null }[];
  offhand?: PrepareCarriedHand;
  mainhand?: PrepareCarriedHand;
  store?: { expected: string; valid: boolean; reason: string | null };
};
export type SectorInventoryModel = {
  personal: CampaignInventoryActor | null;
  outfitStock: number;
  outfitPrice: number;
  outfitIssueReason: string | null;
  sectorId: string;
  operativeId: number | null;
  candidates: { id: number; name: string }[];
  reason: string | null;
  carriedReason: string | null;
  entries: SectorInventoryEntry[];
  repairReserves: RepairReserve[];
  carried: CarriedEquipment[];
  usage: InventoryPocketLayout | null;
};

export type ServiceReturnSource = {
  sourceKey: string;
  key: string;
  siteId: string;
  sectorId: string;
  operativeId: number;
  operativeName?: string;
  placement: { x: number; y: number; tacticalLevel?: number } | null;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  expected: string;
} & (
  | { kind: 'serviceReturn'; stack: import('./item-types.ts').ItemStack; repairPoints?: never }
  | { kind: 'repairPoints'; repairPoints: number; stack?: never }
);
