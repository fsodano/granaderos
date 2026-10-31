import type { ReloadPlan } from '../domain/combat/reload-work.ts';
import type { ReprimeWork } from '../domain/combat/reprime-work.ts';
import type { TacticalPoint, TacticalRoutePoint } from './compatibility-types.ts';

export type HeldReloadPlan = ReloadPlan & {
  reason?: string;
  hands?: (ReloadPlan & { hand: 'primary' | 'offhand'; weapon: string | number; name: string })[];
  offhandPending?: boolean;
};
export type HeldReprimePlan = ReturnType<ReprimeWork['plan']> & { reason: string };
export interface FirstAidPreview {
  critical: boolean;
  targetHP: number;
  hpGain: number;
  hpAfter: number;
  work: number;
  remainingWork: number;
  capacity: number;
  skill: number;
  dressingsUsed: number;
  bleedingAfter: number;
  bandagedAfter: number;
  complete: boolean;
  partial: boolean;
  paCost: number;
  minimumAP: number;
  valid: boolean;
  reason: string | null;
}
export interface MedicalUsePreview {
  allowed: boolean;
  reason: string | null;
  cost: number;
  treatment: FirstAidPreview | null;
  composureRelief?: number;
}
export interface ItemUsePreview {
  type: 'heal' | 'melee';
  actionPa: number;
  movePa: number;
  pa: number;
  stancePa?: number;
  strikePa?: number;
  destination: TacticalPoint | null;
  path: TacticalRoutePoint[];
  valid: boolean;
  reason: string | null;
  treatment?: FirstAidPreview | null;
  composureRelief?: number;
}
export interface FirearmBodyImpact {
  victimId: string;
  victimKind: 'unit' | 'npc';
  hitLocation: string;
  continued: boolean;
  reachChance: number;
  damageFactor: number;
}
export interface FirearmPathPreview {
  blocked: boolean;
  damageFactor: number;
  ricochets?: { distance: number }[];
}
export interface FirearmFlightPreview extends FirearmPathPreview {
  victimId?: string | null;
  victimKind?: 'unit' | 'npc';
  bodyImpacts?: FirearmBodyImpact[];
}
interface FirearmShotBase {
  hand: 'primary' | 'offhand';
  weapon: string | number;
  name: string;
  chance: number;
  damageFactor: number;
  damage: number;
  conditional?: boolean;
  reachChance?: number;
  physicalHitLocation?: string;
  interveningFriendly?: boolean;
}
export type FirearmShotPreview = FirearmShotBase &
  (
    | { shotLoad: true; pelletCount: number; expectedForce: number; expectedDamage: number }
    | { shotLoad?: false }
  );
export interface FirearmVolleyPreview {
  paired: boolean;
  shots: FirearmShotPreview[];
  reason?: string;
}

export type ArtilleryReloadPreview = ReloadPlan & {
  crew: string[];
  rate: number;
  reason: string | null;
  valid: boolean;
};
export interface MaintenancePreview {
  pa: number;
  valid: boolean;
  reason: string | null;
  gain: number;
  materialCost: number;
  materialsAvailable: number;
  action: { type: 'repair'; unitId: string } | null;
}
export interface LookPreview {
  valid: boolean;
  reason: string | null;
  pa: number;
  facing: number;
  prepare: boolean;
  actionLabel: string;
}
export interface BayonetPreview {
  pa: number;
  source: string;
  destination: string;
  host: string | number | undefined;
  fitting: import('./compatibility-types.ts').WeaponFitting | null;
  reason: string | null;
  valid: boolean;
}

export interface EnvironmentActionPreview {
  verb: string;
  label: string;
  pa: number;
  chance: number | null;
  requiresRoll: boolean;
  toolWear?: number;
  reason: string | null;
  valid: boolean;
  action: {
    type: 'environment';
    unitId?: string;
    kind?: string;
    id?: string;
    wallEdgeId?: string;
    x?: number;
    y?: number;
    axis?: 'x' | 'y';
    tacticalLevel?: number;
    verb: string;
  };
}
export interface EnvironmentUsePreview extends EnvironmentActionPreview {
  type: 'environment';
  actionPa: number;
  movePa: number;
  destination: TacticalPoint | null;
  path: TacticalRoutePoint[];
}
export interface ContainerLootPreview {
  pa: number;
  valid: boolean;
  reason: string | null;
  action: {
    type: 'containerLoot';
    unitId?: string;
    kind: 'container';
    id?: string;
    index: number;
    count: number;
    expectedSource?: string;
  };
}
export interface TransferPreview {
  pa: number;
  kind: 'give' | 'throw' | 'relay';
  chance: number;
  route: { id: string; name: string; pa: number }[];
  totalPA: number;
  reason: string | null;
  valid: boolean;
}
export interface DropPreview {
  pa: number;
  kind: 'drop';
  chance: number;
  reason: string | null;
  valid: boolean;
}

export interface EquipmentHostAction {
  type: 'unloadEquipment' | 'attachment';
  unitId?: string | number;
  hostId: string;
  operation?: 'attach' | 'detach';
  expectedHost: string;
  expectedCursor?: string;
}

export type ContextualAttack =
  | { type: 'fire'; pa: number; profile: import('./tactical-query-types.ts').HeldWeaponProfile }
  | { type: 'melee'; pa: number; profile: import('./tactical-query-types.ts').HeldBladeProfile }
  | {
      type: 'throwGrenade';
      pa: number;
      profile: { radius: number; damage: number; energyDamage: number };
    };
export interface ApproachPreview {
  actionPa: number;
  movePa: number;
  pa: number;
  destination: import('./compatibility-types.ts').TacticalPoint | null;
  path: import('./compatibility-types.ts').TacticalRoutePoint[];
  valid: boolean;
  reason: string | null;
}
export interface NpcGiftPreview extends ApproachPreview {
  type: 'giveItem';
  label: string;
  beneficiaryDelivery?: import('./inventory-types.ts').BeneficiaryDeliveryPreview;
}
export interface MeleePreview extends ApproachPreview {
  type: 'melee';
  stancePa: number;
  strikePa: number;
}
export interface MeleePointPreview extends ApproachPreview {
  type: 'meleePoint';
  stancePa: number;
  strikePa: number;
}
export interface LootApproachPreview extends ApproachPreview {
  type: 'loot';
}
export interface LootSearchPreview extends ApproachPreview {
  type: 'approachLoot';
  available: boolean;
}

export interface FirearmShotOption {
  hitLocation: string;
  aim: number;
  chance: number;
  damageFactor: number;
  physicalHitLocation?: string;
  conditional?: boolean;
  reachChance?: number;
  interveningFriendly?: boolean;
  shotLoad?: boolean;
  pelletCount?: number;
  expectedForce?: number;
  expectedDamage?: number;
  shots?: FirearmShotPreview[];
}

export interface FirearmBystander {
  id: string;
  name: string;
  kind: 'unit' | 'npc';
}
export interface FirearmBystanderRisk {
  direct: FirearmBystander[];
  scatter: FirearmBystander[];
}
