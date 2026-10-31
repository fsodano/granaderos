import type { OutfitRecord } from '../outfits.ts';
import type { HeldWeaponProfile } from './tactical-query-types.ts';
import type { ErrandDefinition } from '../../campaign-format/types.ts';
import type {
  BattleBody,
  BattleExit,
  BattleUnit,
  EquipmentItem,
  GroupMoveAction,
  MovementIntent,
  MovementMode,
  MoveAction,
  TacticalAction,
  TacticalPoint,
  TacticalRoutePoint,
  WeaponFitting,
} from './compatibility-types.ts';

/** Read-only projections of the legacy tactical HUD adapter. */
export interface TacticalPointer
  extends TacticalPoint, Omit<Partial<BattleBody>, 'x' | 'y' | 'tacticalLevel'> {
  id?: string;
  kind?: string;
  aimLocation?: string | undefined;
  anonymous?: boolean;
  pickup?: boolean;
  loot?: boolean;
  wallEdgeId?: string;
  edgeId?: string;
  unitId?: string;
  targetKind?: 'unit' | 'npc' | 'artillery';
  type?: string;
  surrendered?: boolean;
  routed?: boolean;
}
export interface ActionPreview {
  valid: boolean;
  reason?: string | null | undefined;
  pa?: number | undefined;
  remaining?: number | undefined;
  energy?: number | undefined;
  movement?: boolean;
  path?: TacticalRoutePoint[] | undefined;
  attackType?: string | undefined;
  hitLocation?: string | undefined;
  blocked?: boolean;
  rounds?: number;
  reloadProgress?: number;
  treatment?: import('./tactical-preview-types.ts').FirstAidPreview | null | undefined;
  composureRelief?: number | undefined;
  actionLabel?: string | undefined;
  attackLabel?: string | undefined;
  cursor?: string;
  landingLabel?: string | undefined;
  landing?: TacticalPoint | null | undefined;
  blastRadius?: number;
  partial?: boolean;
  remainingReloadPA?: number;
  label?: string;
  chance?: number | null | undefined;
  chanceLabel?: string | undefined;
  toolWear?: number;
  name?: string | undefined;
  pending?: boolean;
  coverNote?: string | null | undefined;
  friendlyRisk?: boolean;
  shotLoad?: boolean;
  pelletCount?: number;
  expectedForce?: number;
  damageFactor?: number;
  range?: number;
  action?: TacticalAction | null;
}
export interface TargetingContext {
  mode?: string | undefined;
  aim?: number | undefined;
  hitLocation?: string | undefined;
  target?: TacticalPointer | BattleBody | null | undefined;
  movementIntent?: MovementIntent;
  itemIntent?: 'use' | 'steal' | 'moveOnly';
  busy?: boolean;
  routesPending?: boolean;
  routesFailed?: boolean;
  reachable?: (TacticalPoint & { cost: number; path: TacticalRoutePoint[] })[];
  artilleryId?: string;
  cannonId?: string;
  targetId?: string;
  item?: string;
  count?: number;
  targetKey?: string;
  verb?: string;
  index?: number;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  movement?: MovementMode;
  linkId?: string;
  enabled?: boolean;
  stance?: BattleUnit['stance'];
  inventoryKey?: string;
  slot?: string;
}
export interface FirearmLoadingProgress {
  progress: number;
  percent: string;
  label: string;
  description: string;
}
export interface BayonetSource {
  item: string;
  label: string;
  condition: number;
  pattern?: string | null | undefined;
  weight: number;
  preview: ActionPreview;
  action: TacticalAction;
}
export interface AttachedBayonet extends WeaponFitting {
  label: string;
  hostCondition: number;
  weight: number;
  removals: {
    destination: string;
    label: string;
    preview: ActionPreview;
    action: TacticalAction;
  }[];
}
export interface FittingInventoryModel {
  sources: BayonetSource[];
  attached: AttachedBayonet | null;
}
export interface InventoryItem extends EquipmentItem {
  item: string;
  label: string;
  count: number;
  weight?: number;
  stackLimit?: number;
  slotSize?: number;
  art?: string;
  jammed?: boolean;
  stacks?: number;
  slots?: number;
}
export type PocketInventoryItem = InventoryItem & {
  weight: number;
  stackLimit: number;
  slotSize: number;
};
export interface InventoryPocketLayout {
  used: number | null;
  capacity: number;
  free: number;
  overloaded: boolean;
  items: PocketInventoryItem[];
  overflow: PocketInventoryItem[];
  slots: {
    id: string;
    size: 'large' | 'small';
    label: string;
    entry: (PocketInventoryItem & { index: number }) | null;
  }[];
}
export interface HandSlot {
  side: 'right' | 'left';
  item: string | null;
  blocked: boolean;
  label: string;
  weapon: number | undefined;
  art: string | undefined;
  loaded: number | undefined;
  condition: number | undefined;
  loading?: FirearmLoadingProgress;
  action: TacticalOrder | null | undefined;
  pa: number | undefined;
  reason: string | null | undefined;
  disabled: boolean | undefined;
}
export interface ToolItem extends EquipmentItem {
  item: string;
  key: string;
  count: number;
  active: boolean;
  toolKey: string;
  label: string;
  name: string;
  weight: number;
  verb: string;
  pa: number;
  wear: number;
  condition: number;
  inventoryKey: string;
}
export interface HeldSupplyItem {
  key: string;
  name: string;
  action: string;
  cost: number;
  range: number;
  count: number;
  label: string;
  active: boolean;
}
export interface WornOutfit extends OutfitRecord {
  outfit: string;
  count: number;
  label: string;
  condition: number;
}
export interface InventoryModel {
  stats: { id: string; label: string; value: number }[];
  hands: HandSlot[];
  slots: {
    primary: HeldWeaponProfile;
    blade: import('./tactical-query-types.ts').HeldBladeProfile | null;
    medical: { name: string; count: number };
  };
  activeSlot: string;
  weight: number;
  capacity: number;
  outfit: WornOutfit | null;
  poncho: boolean;
  supplies: { id: string; label: string; count: number }[];
  heldSupplies: HeldSupplyItem[];
  backpack: (Omit<EquipmentItem, 'name'> & {
    key: string;
    count: number;
    art: string | null;
    equippable: boolean;
    name: string | null;
  })[];
  items: InventoryItem[];
  pockets: InventoryPocketLayout;
  tools: ToolItem[];
  fittings: FittingInventoryModel;
  unitAlive: boolean;
  unitReady: boolean;
  apBudget: { base: number; carryover: number; total: number };
  currentAPLimit: number;
  equipCost: number;
}
export interface OccupiedRosterCell {
  empty?: false;
  unit: BattleUnit;
  portrait: string | null;
  label: string;
  hpPct: number;
  ap: number;
  energy: number;
  bleeding: number;
  bandaged: number;
  untreated: number;
  dead: boolean;
  moralePct: number;
  visibleEnemyCount: number;
  apPct: number;
  active: boolean;
  fallen: boolean;
  disabled: boolean;
  interruptReady: boolean;
  index: number;
}
export type RosterCell = OccupiedRosterCell | { empty: true };
export interface OrderDescriptor {
  id: string;
  label: string;
  kind: string;
  disabled: boolean;
  pa?: number;
  reserve?: boolean;
  active?: boolean;
  seconds?: number;
  detail?: string;
  action?: TacticalAction | null;
}
export interface EquipmentSlot {
  slot: string;
  label: string;
  pa: number;
  action: { type: 'weapon'; slot: string; toolKey?: string; supplyKey?: string; item?: string };
  active: boolean;
  disabled: boolean;
  reason: string | null;
}
export interface EnvironmentTarget {
  key: string;
  id: string;
  label: string;
  kind: string;
  open?: boolean | undefined;
  locked?: boolean | undefined;
  broken?: boolean | undefined;
  trapKnown?: boolean;
  trapArmed?: boolean | undefined;
  arsenalHint?: string;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  axis?: 'x' | 'y';
  wallEdgeId?: string;
  material?: string;
}
export interface EnvironmentContent extends EquipmentItem {
  index: number;
  label: string;
  count: number;
}
export interface NearbyEnvironmentModel {
  targets: EnvironmentTarget[];
  target: EnvironmentTarget | null;
  preview: ActionPreview | null;
  contents: EnvironmentContent[];
  verbs: { id: string; label: string }[];
  loot: ActionPreview | null;
}
export type LootOrder = {
  type: 'loot';
  targetId?: string;
  item?: string;
  groundId?: string;
  dropIndex?: number;
  count?: number;
};
export interface LootOption extends EquipmentItem {
  jammed?: boolean;
  id: string;
  label: string;
  count: number;
  source: string;
  action: LootOrder;
}
export interface ExitPreview {
  prisoners: { id: string; name: string; ready: boolean }[];
  available: boolean;
  reason: string | null;
  edge: string | null;
  destination: string | null;
  eligibleIds: string[];
  blocked: { id: string; reason: string }[];
  costById: Record<string, number>;
}
export interface ExitModel {
  units: BattleUnit[];
  exits: (BattleExit & { label: string })[];
  selectedExit: (BattleExit & { label: string }) | undefined;
  unitIds: string[];
  preview: ExitPreview;
  action: TacticalAction;
  departures: BattleUnit[];
}
export interface MovementGroupModel {
  members: Pick<BattleUnit, 'id' | 'name'>[];
  anchorId: string | undefined;
  request: GroupMoveAction | null;
  preview: GroupMovePreview | null;
}
export interface GroupMovePreview {
  members: {
    unitId: string;
    from: TacticalPoint;
    destination: TacticalPoint | null;
    desired?: TacticalPoint;
    path: TacticalRoutePoint[];
    cost: number;
    reason: string;
  }[];
  request: GroupMoveAction | null;
  ok: boolean;
  reason: string;
}

export interface DialogueView {
  node: string;
  text: string;
  choices: {
    id: string;
    label: string;
    effectLabel?: string;
    available?: boolean;
    reason?: string | null;
  }[];
}
export interface EncounterHireQuote {
  term: string;
  name: string;
  price: number;
  total: number;
  guarantee: number;
  hours: number | null;
  available: boolean;
  reason: string | null;
}
export interface QuestView extends Omit<ErrandDefinition, 'reward'> {
  reward?: number | NonNullable<ErrandDefinition['reward']>;
  status: string;
  conditionMet: boolean;
  resolutionReady?: boolean;
  beneficiaryId?: string;
  beneficiary?: import('../../campaign-format/types.ts').ErrandBeneficiary;
  withdrawalChoice?: { questId: string; beneficiaryId?: string; deliveredCount: number };
}
export interface MissionView {
  id: string;
  name: string;
  stage: string;
  completed: boolean;
  objectives: (
    | string
    | { id?: string; text?: string; label?: string; name?: string; done: boolean }
  )[];
}
export interface TacticalSpeech extends TacticalPoint {
  id: string;
  name: string;
  text: string;
}

/** UI orders select their actor at the battlefield boundary. */
export type TacticalOrder = (Omit<MoveAction, 'unitId'> | Exclude<TacticalAction, MoveAction>) & {
  unitId?: string | number;
};

export interface KnifeThrowReceipt {
  source: TacticalPoint & { height: number };
  impact: TacticalPoint & { height: number };
  landing: TacticalPoint;
  weapon: number;
  visible: boolean;
}
export interface CareComposureReceipt {
  unitId: string;
  targetId: string;
  targetKind: 'unit' | 'npc';
  relief: number;
}
