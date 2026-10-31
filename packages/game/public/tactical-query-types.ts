import type {
  BattleSnapshot,
  BattleNpc,
  TacticalPoint,
  TacticalRoutePoint,
} from './compatibility-types.ts';

export interface ReachableCell extends TacticalPoint {
  cost: number;
  path: TacticalRoutePoint[];
}

export interface HeldWeaponProfile {
  id: string | number;
  name: string;
  damage: number;
  fireAP: number;
  aimAP: number;
  reloadAP: number;
  capacity: number;
  range: number;
  readyAP?: number;
  reach?: number;
  stockReach?: number;
  stockDamage?: number;
  stockAP?: number;
  weight?: number;
  loadPattern?: string;
  ammunitionFamily?: string;
}

export interface ActionCosts {
  fire: number;
  ready: number;
  turn: number;
  setup: number;
  discharge: number;
  overwatch: number;
  aim: number;
  stance: number;
  weapon: number;
  brace: number;
  ration: number;
  torch: number;
  bolas: number;
  free: number;
  loot: number;
  equipLoot: number;
  fitBayonet: number;
  removeBayonet: number;
  heal: number;
  breach: number;
  mount: number;
  reprime: number;
  repair: number;
  reload: number;
  melee: number;
  meleeStrike: number;
  meleeStance: number;
}

/** Route planning needs NPC occupancy; placeholder bodies have no actor behavior. */
export type ReachabilityState = Omit<BattleSnapshot, 'npcs'> & {
  npcs?: (TacticalPoint & { id: string } & Partial<BattleNpc>)[];
};

export interface HeldBladeProfile {
  id: number;
  name: string;
  damage: number;
  ap: number;
  reach: number;
  weight?: number;
  usable?: boolean;
}
export interface ArtilleryCosts {
  crew: number;
  fire: number;
  reload: number;
  move: number;
  pivot: number;
}
export interface ArtilleryCrewPlan {
  crew: string[];
  reason: string | null;
}
