import type { TacticalPoint, BattleTile, BattleNpc } from './compatibility-types.ts';

/** Browser inspection projections contain only fields admitted by player-known-state.ts. */
export type KnownScalar = string | number | boolean | null;
export interface KnownFitting {
  weapon?: string | number;
  fittingPattern?: string;
  condition?: number;
}
export interface KnownItem {
  item?: string;
  ammoType?: string;
  kind?: string;
  grenadeType?: string;
  outfit?: string;
  label?: string;
  name?: string;
  count?: number;
  weight?: number;
  weapon?: string | number;
  loaded?: number;
  reloadProgress?: number;
  condition?: number;
  jammed?: boolean;
  itemType?: string;
  toolKey?: string;
  fittingPattern?: string;
  fittings?: { bayonet?: KnownFitting };
}
export interface KnownAction extends Partial<TacticalPoint> {
  type?: string;
  unitId?: string | number;
  targetId?: string | number;
  targetKind?: string;
  item?: string;
  count?: number;
  slot?: string;
  toolKey?: string;
  supplyKey?: string;
  stance?: string;
  movement?: string;
  enabled?: boolean;
  linkId?: string;
  aim?: number;
  hitLocation?: string;
  groundId?: string;
  dropIndex?: number;
  inventoryKey?: string;
  kind?: string;
  id?: string;
  wallEdgeId?: string;
  axis?: 'x' | 'y';
  verb?: string;
  index?: number;
  destination?: string;
}
export interface KnownActor extends Partial<TacticalPoint> {
  id?: string;
  name?: string;
  nickname?: string;
  side?: string;
  hp?: number;
  maxHp?: number;
  stance?: string;
  movementMode?: string;
  facing?: number;
  mounted?: boolean;
  unconscious?: boolean;
  knockedDown?: boolean;
  entangled?: boolean;
  routed?: boolean;
  surrendered?: boolean;
  militia?: boolean;
  missionAlly?: boolean;
}
export interface KnownEquipment {
  weaponFittings: { bayonet?: KnownFitting };
  inventory: Record<string, KnownItem>;
  headwear: KnownItem | null;
  outfit: KnownItem | null;
  legwear: KnownItem | null;
  offHand?: KnownItem;
  weaponMetadata?: KnownItem;
  bladeMetadata?: KnownItem;
  equipmentCursor?: { sourceId: string; stack: KnownItem };
  pocketOrder?: { slotId: string; item: string; index: number; count?: number }[];
}
export interface KnownPersonalCondition {
  ammunitionVersion?: number;
  ap?: number;
  maxAP?: number;
  carriedAP?: number;
  energy?: number;
  fatigue?: number;
  bleeding?: number;
  bandaged?: number;
  shock?: number;
  morale?: number;
  weapon?: string | number;
  blade?: string | number;
  condition?: number;
  bladeCondition?: number;
  weaponDropped?: boolean;
  weaponReady?: boolean;
  weaponMode?: string;
  loaded?: number;
  reloadProgress?: number;
  ammo?: number;
  jammed?: boolean;
  medkits?: number;
  rations?: number;
  torches?: number;
  boleadoras?: number;
  activeSlot?: string;
  activeItem?: string;
  leftHandItem?: string | null;
  activeTool?: string;
  activeSupply?: string;
  stealthMode?: boolean;
  agility?: number;
  dexterity?: number;
  strength?: number;
  wisdom?: number;
  leadership?: number;
  marksmanship?: number;
  medical?: number;
  mechanical?: number;
  explosives?: number;
  stealth?: number;
  experienceLevel?: number;
  militiaRank?: number;
  militiaExperience?: number;
  weaponFittingPattern?: string | null;
  bladeFittingPattern?: string | null;
}
export interface KnownPlayerActor extends KnownActor, KnownPersonalCondition, KnownEquipment {
  maximumEnergy: number;
  mount?: { id?: string; stamina?: number; condition?: number };
}
export interface KnownStructure extends Partial<TacticalPoint> {
  id?: string;
  type?: string;
  kind?: string;
  elevation?: number;
  blocked?: boolean;
  cover?: number;
  open?: boolean;
  buildingId?: string | null;
  roomId?: string | null;
  structureDamage?: number;
  destroyed?: boolean;
  axis?: 'x' | 'y';
  blocksSight?: boolean;
  doorId?: string;
  material?: string;
  slabThickness?: number;
}
export interface KnownPreview extends Partial<TacticalPoint> {
  targetId?: string;
  targetKind?: string;
  name?: string;
  pa?: number;
  remaining?: number;
  chance?: number | null;
  chanceLabel?: string;
  coverNote?: string | null;
  hitLocation?: string;
  attackType?: string;
  attackLabel?: string;
  actionLabel?: string;
  valid?: boolean;
  reason?: string | null;
  blastRadius?: number;
  friendlyRisk?: boolean;
  blocked?: boolean;
  landingLabel?: string;
  landing?: Partial<TacticalPoint>;
  action?: KnownAction;
  composureRelief?: number;
  treatment?: {
    critical?: boolean;
    targetHP?: number;
    hpGain?: number;
    hpAfter?: number;
    work?: number;
    remainingWork?: number;
    capacity?: number;
    dressingsUsed?: number;
    bleedingAfter?: number;
    bandagedAfter?: number;
    complete?: boolean;
    partial?: boolean;
  };
}
export interface KnownUnitOrders {
  unitId: string;
  canAct: boolean;
  costs: Partial<
    Record<
      | 'heal'
      | 'weapon'
      | 'stance'
      | 'mount'
      | 'free'
      | 'loot'
      | 'drop'
      | 'equipLoot'
      | 'throwGrenade'
      | 'fire'
      | 'aim'
      | 'reload'
      | 'reprime'
      | 'melee'
      | 'brace'
      | 'repair',
      number
    >
  >;
  grenade?: KnownItem & {
    item: string;
    pa: number;
    range: { maximum?: number };
    blastRadius: number;
  };
  equipment: {
    slot?: string;
    label?: string;
    pa?: number;
    active?: boolean;
    disabled?: boolean;
    action: KnownAction;
  }[];
  hands: {
    side?: string;
    item?: string | null;
    blocked?: boolean;
    label?: string;
    weapon?: number;
    loaded?: number;
    condition?: number;
    pa?: number;
    reason?: string | null;
    disabled?: boolean;
    kind?: string;
    grenadeType?: string;
    count?: number;
    action?: KnownAction;
  }[];
  fittings: {
    item?: string;
    label?: string;
    condition?: number;
    weight?: number;
    valid?: boolean;
    reason?: string | null;
    pa?: number;
    destination?: string;
    action: KnownAction;
  }[];
  aim: { level?: number; pa?: number; disabled?: boolean }[];
  orders: { id?: string; label?: string; kind?: string; pa?: number; disabled?: boolean }[];
  targets: KnownPreview[];
  medicalTargets: KnownPreview[];
  stealTargets: KnownPreview[];
  loot: (KnownItem & { source: string; action: KnownAction })[];
}
export interface KnownBattle {
  sectorId?: string;
  sectorName?: string;
  sceneId?: string;
  missionId?: string;
  width?: number;
  height?: number;
  turn?: number;
  phase: string;
  mode: string;
  status?: string;
  sectorCleared?: boolean;
  night?: boolean;
  elapsedSeconds?: number;
  weather?: { rain?: number; humidity?: number };
  units: (KnownActor | KnownPlayerActor)[];
  npcs: (TacticalPoint & {
    id: string;
    name?: string;
    hp?: number;
    maxHp?: number;
    bleeding?: number;
    bandaged?: number;
    unconscious?: boolean;
    knockedDown?: boolean;
    stance?: BattleNpc['stance'];
    mission?: string;
  })[];
  tiles: (KnownStructure & Pick<BattleTile, 'x' | 'y' | 'type'>)[];
  wallEdges?: (Omit<KnownStructure, 'axis'> & Pick<BattleTile, 'x' | 'y' | 'type' | 'axis'>)[];
  upperSurfaces?: (KnownStructure & Pick<BattleTile, 'x' | 'y' | 'type'>)[];
  climbLinks?: {
    id: string;
    kind: string;
    from: TacticalPoint;
    to: TacticalPoint;
  }[];
  props?: (TacticalPoint & {
    id: string;
    type: string;
    blocksMovement?: boolean;
    structureDamage?: number;
    destroyed?: boolean;
    footprint?: { width: number; height: number };
  })[];
  environment?: (KnownStructure & {
    wallEdgeId?: string;
    label?: string;
    locked?: boolean;
    broken?: boolean;
    trap?: { type?: string; armed?: boolean };
    contents?: (KnownItem & { index: number })[];
  })[];
  contacts: (Partial<TacticalPoint> & {
    observerId: string;
    kind: string;
    turn?: number;
    anonymous: boolean;
    radius?: number;
    label?: string;
  })[];
  orders: KnownUnitOrders[];
  journal: { id?: string; kind?: string; text?: string; turn?: number; elapsedSeconds?: number }[];
  artillery: (Partial<TacticalPoint> & {
    id?: string;
    side?: string;
    type?: string;
    loaded?: boolean;
    ammo?: number;
    facing?: number;
    reloadProgress?: number;
  })[];
  groundItems: (KnownItem & Partial<TacticalPoint> & { id?: string; type?: string })[];
  droppedWeapons?: (KnownItem & Partial<TacticalPoint> & { dropIndex: number })[];
  lights?: (Partial<TacticalPoint> & {
    type?: string;
    radius?: number;
    intensity?: number;
    remainingSeconds?: number;
  })[];
  smoke?: (Partial<TacticalPoint> & { radius?: number })[];
  exits?: { id?: string; edge?: string; destination?: string }[];
  departedPlayers?: {
    id?: string;
    name?: string;
    nickname?: string;
    hp?: number;
    maxHp?: number;
    edge?: string;
    destination?: string;
    elapsedSeconds?: number;
    mountId?: string | null;
  }[];
  interrupt?: { side: 'player'; unitIds: string[]; enemyId?: string } | null;
  deployment?: KnownDeployment;
}
export interface PlayerKnownState {
  screen: string;
  campaign: KnownCampaign | null;
  battle: KnownBattle | null;
}
export interface KnownCampaign {
  hour?: number;
  secondOfHour?: number;
  phase?: number;
  location?: string;
  activeSquadId?: string;
  blockade?: boolean;
  completed?: boolean;
  defeated?: boolean;
  logisticsNotice: import('./campaign-types.ts').CampaignLogisticsNotice | null;
  assignmentNotice:
    | (Omit<import('./campaign-types.ts').CampaignAttentionNotice, 'events'> & {
        events: Omit<import('./campaign-types.ts').CampaignAttentionEvent, 'binding'>[];
      })
    | null;
  contractNotice: import('./campaign-types.ts').CampaignContractNotice | null;
  travelNotice: {
    hour: number;
    events: { squadId?: string; name?: string; sector?: string; text?: string }[];
  } | null;
  sectors: {
    id?: string;
    name?: string;
    grid?: string;
    biome?: string;
    theater?: string;
    owner?: string;
    loyalty?: number;
    fort?: number;
    damageUntil?: number;
    militia: number[];
    equipment: KnownSectorEquipment[];
    repairReserves: (Partial<TacticalPoint> & {
      key: string;
      siteId: string;
      siteName: string;
      label: string;
      repairPoints: number;
      operativeId?: number;
      operativeName?: string;
    })[];
  }[];
  squads: {
    id?: string;
    name?: string;
    location?: string;
    members: number[];
    journey: KnownJourney | null;
  }[];
  operatives: KnownOperative[];
  horses: {
    id?: string;
    name?: string;
    location?: string;
    assignedTo?: number | null;
    stamina?: number;
    condition?: number;
    feed?: number;
    hired?: boolean;
    hireUntil?: number | null;
    returned?: boolean;
    pregnantUntil?: number | null;
    custody?: { kind?: string; sector?: string; operativeId?: number };
  }[];
  enemyReports: {
    id: string;
    sector: string;
    observedAt: number;
    source: string;
    status: string;
    strength: number | null;
    location: string;
    ageHours: number;
    stale: boolean;
  }[];
  pendingEncounter: { groupId?: string; sector?: string; arrivedAt?: number } | null;
  pendingBattle: {
    sector?: string;
    sceneId?: string | null;
    name?: string;
    exploration?: boolean;
    resumeAvailable: boolean;
  } | null;
  resources: Record<string, number>;
  reputation: Partial<
    Record<'directory' | 'gauchos' | 'pardos' | 'foreign' | 'indigenous' | 'royalists', number>
  >;
  flags: Partial<
    Record<
      | 'academy'
      | 'sanLorenzo'
      | 'northPact'
      | 'partisanSupply'
      | 'foundry'
      | 'parliament'
      | 'emancipation'
      | 'commission'
      | 'mentoring',
      boolean
    >
  >;
}
export interface KnownDeployment {
  sectorName: string;
  width: number;
  height: number;
  units: {
    id: string;
    edge: 'N' | 'E' | 'S' | 'W';
    squadId: string;
    squadName: string;
    name: string;
    nickname: string;
    position: TacticalPoint | null;
  }[];
  cells: (TacticalPoint & { type: string; blocked?: boolean })[];
  entryCells: Record<'N' | 'E' | 'S' | 'W', TacticalPoint[]>;
  ready: boolean;
  remaining: number;
}
export interface KnownJourney {
  status: string;
  intent: string;
  purpose: string;
  mode: string;
  from: string;
  to: string;
  destination: string;
  returning: boolean;
  elapsed: number;
  elapsedSeconds: number;
  travelledSeconds: number;
  legHours: number;
  legRemaining: number;
  remaining: number;
  path: string[];
  plannedPath: string[];
  reason: string | null;
  arrivalDecision: import('../domain/journeys/arrival-decision.ts').ArrivalDecisionSnapshot | null;
}
export interface KnownSectorEquipment extends Partial<TacticalPoint> {
  key: string;
  label: string;
  count: number;
  kind: string;
  condition?: number | undefined;
  loaded?: number | undefined;
  jammed?: boolean | undefined;
  siteId: string;
  siteName: string;
  operativeId?: number;
  operativeName?: string;
}
export interface KnownOperative extends KnownPersonalCondition, KnownEquipment {
  id?: number;
  name?: string;
  nickname?: string;
  inTransit: boolean;
  maximumEnergy: number;
  hp?: number;
  maxHp?: number;
  alive?: boolean;
  location?: string;
  assignment?: string;
  asleep?: boolean;
  sleepCollapsed?: boolean;
  captured?: boolean;
  capturedSector?: string | null;
  carriedAmmo?: number;
  carriedLoaded?: number;
  carriedReloadProgress?: number;
  toolkitPoints?: number;
  repairTargetId?: number;
  repairWeaponId?: string | number;
  repairScope?: string;
  contract: {
    kind?: string;
    term?: string;
    started?: number;
    expiresAt?: number | null;
    paid?: number;
  };
}
