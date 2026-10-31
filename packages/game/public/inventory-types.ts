import type { CampaignInventoryActor } from './sector-inventory-types.ts';
import type { CampaignOperative } from './campaign-types.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  EquipmentAction,
  ProjectilePresentationPoint,
  TacticalPoint,
  TacticalRoutePoint,
} from './compatibility-types.ts';
import type { TacticalOrder } from './hud-types.ts';

export type InventoryActor = BattleUnit | CampaignOperative | CampaignInventoryActor;
export interface CampaignInventoryContext {
  mode: 'exploration';
  phase: 'player';
  status: 'active';
  units: (CampaignOperative | CampaignInventoryActor)[];
  equipmentContext: 'campaign';
}
export type InventoryContext = BattleSnapshot | CampaignInventoryContext;
export type InventoryOrderResult = BattleSnapshot | InventoryActor | null | boolean | void;
export type InventoryOrderHandler = (action: TacticalOrder) => InventoryOrderResult;
export interface EquipmentPreview {
  valid: boolean;
  reason: string | null;
  pa: number;
  operation?: 'reload';
  rounds?: number;
  partial?: boolean;
  remainingPA?: number;
  actionLabel?: string;
  seconds?: number;
}
export interface SelectedEquipmentPreview extends EquipmentPreview {
  action: EquipmentAction | null;
}
export interface BeneficiaryDeliveryPreview {
  questId: string;
  beneficiaryId: string;
  selectedBeneficiaryId: string | null;
  firstDeliveryLocks: true;
  beneficiaries: {
    id: string;
    npcId: string;
    sector: string;
    reward: { treasury: number; loyalty: boolean };
  }[];
}
export type InventoryTransferKind = 'drop' | 'give' | 'relay' | 'throw' | 'gift';
export interface InventoryMapAction extends TacticalPoint {
  type: 'inventoryMap';
  unitId?: string | number;
  sourceId: string;
  expectedSource: string;
  count: number;
  intent: 'auto' | 'ground';
  targetId?: string;
  transferKind?: InventoryTransferKind;
  transferRoute?: string[];
  expectedRoute?: string;
}
export interface ItemFlightPreview {
  valid: boolean;
  blocked: boolean;
  reason: string | null;
  landing: TacticalPoint | null;
  path: ProjectilePresentationPoint[];
}
export interface InventoryMapPreview {
  valid: boolean;
  reason: string | null;
  kind: InventoryTransferKind | null;
  pa: number;
  totalPA: number;
  chance: number;
  route: { id: string; name: string; pa: number }[];
  landing: TacticalPoint | null;
  flight: ItemFlightPreview | null;
  path: TacticalRoutePoint[] | ProjectilePresentationPoint[];
  action: InventoryMapAction | null;
  name?: string;
  actionLabel?: string;
  type?: 'inventoryMap';
  actionPa?: number;
  movePa?: number;
  destination?: TacticalPoint;
  beneficiaryDelivery?: BeneficiaryDeliveryPreview;
}
export interface SelectedItemMapPreview extends Omit<InventoryMapPreview, 'action'> {
  name: string;
  actionLabel: string;
  coverNote: string | null;
  remaining: number;
  action: InventoryMapAction;
}
