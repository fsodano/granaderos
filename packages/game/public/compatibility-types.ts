import type { OutfitRecord } from '../outfits.ts';
import type {
  CampaignContent,
  CampaignOrigin,
  WeaponDefinition as AuthoredWeaponDefinition,
} from '../../campaign-format/types.ts';
import type { CampaignSnapshot } from './campaign-types.ts';
import type { SectorSessionSnapshot } from '../domain/sector-sessions/sector-session.ts';
import type { SectorOperationContextSnapshot } from '../domain/sector-sessions/sector-operation-context.ts';

/** Serialized compatibility projections. Domain entities remain authoritative. */
export interface TacticalPoint {
  x: number;
  y: number;
  tacticalLevel?: number;
}
export interface TacticalRoutePoint extends TacticalPoint {
  kind?: string;
  linkId?: string;
  elevation?: number;
}
export type MovementMode = 'walk' | 'run' | 'crouch' | 'prone';
export type MovementIntent = 'forward' | 'preserveFacing';
export type BattleSide = 'player' | 'enemy' | 'civilian';
export type BattleStance = 'standing' | 'crouched' | 'prone';
export interface WeaponFitting {
  metadata?: { contentWeapon?: AuthoredWeaponDefinition; name?: string };
  weapon?: number;
  fittingPattern: string;
  condition?: number;
  item?: string;
}
export interface WeaponDefinition {
  id: string | number;
  template?: number;
  name?: string;
  category?: string;
  capacity?: number;
  range?: number;
}
export interface EquipmentItem {
  id?: string | number;
  item?: string;
  weapon?: string | number | WeaponDefinition;
  blade?: string | number;
  kind?: string;
  type?: string;
  count?: number;
  quantity?: number;
  label?: string;
  name?: string;
  repairPoints?: number;
  jammed?: boolean;
  weight?: number;
  itemType?: string;
  keyId?: string;
  toolKey?: string;
  outfit?: string;
  condition?: number;
  loaded?: number;
  ammo?: number;
  ammoType?: string;
  instanceId?: string | undefined;
  reloadProgress?: number;
  fittings?: Record<string, WeaponFitting>;
  fittingPattern?: string;
  contentWeapon?: AuthoredWeaponDefinition;
  template?: number;
}
export interface EquipmentCursor {
  stack: EquipmentItem & { count: number };
  sourceId: string;
}
export interface BattleBody extends TacticalRoutePoint {
  knownToPlayer?: boolean;
  corpse?: import('../domain/world/corpse.ts').CorpseSnapshot;
  contentId?: string;
  storyProfile?: { personality?: string; speech?: Record<string, string> };
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  braced?: boolean;
  weaponReady?: boolean;
  side?: BattleSide;
  stance?: BattleStance;
  facing?: number;
  mounted?: boolean;
  asleep?: boolean;
  unconscious?: boolean;
  knockedDown?: boolean;
  fled?: boolean;
  departure?: TacticalPoint & {
    exitId: string;
    edge: string;
    destination: string;
    elapsedSeconds: number;
    mountId: string | null;
  };
  bleeding?: number;
  bandaged?: number;
  shock?: number;
  morale?: number;
  age?: number;
  portraitId?: string | number;
  nickname?: string;
  spriteAppearance?: string;
  appearance?: string;
  gender?: string;
  skinTone?: string;
  portrait?: string;
  description?: string;
  movementMode?: MovementMode;
  lastMovePath?: TacticalRoutePoint[];
  weapon?: number | string | WeaponDefinition;
  blade?: number | string;
  activeSlot?: string;
  offHand?: EquipmentItem;
  inventory?: Record<string, EquipmentItem | number>;
  bladeInstanceId?: string;
  weaponInstanceId?: string;
  weaponFittings?: Record<string, WeaponFitting>;
  bladeFittings?: Record<string, WeaponFitting>;
  leftHandItem?: string | null;
  equipmentCursor?: EquipmentCursor;
  outfit?: OutfitRecord | null;
  headwear?: OutfitRecord | null;
  legwear?: OutfitRecord | null;
}
export interface BattleUnit extends BattleBody {
  patrolOrigin?: TacticalPoint;
  patrol?: boolean;
  patrolTurn?: number;
  lastInvestigatedTurn?: number;
  weaponMetadata?: { contentWeapon: AuthoredWeaponDefinition };
  bladeMetadata?: { contentWeapon: AuthoredWeaponDefinition };
  pocketOrder?: import('../domain/inventory/pocket-layout.ts').PocketOrderEntry[];
  mount?: { id: string; stamina: number; condition: number };
  maxAP?: number;
  leadership?: number;
  explosives?: number;
  ammunitionVersion?: 2;
  bladeCondition?: number;
  bladeFittingPattern?: string | null;
  weaponFittingPattern?: string | null;
  side: 'player' | 'enemy';
  ap: number;
  maxHp: number;
  hp: number;
  energy: number;
  morale: number;
  marksmanship: number;
  agility: number;
  strength: number;
  medical: number;
  mechanical: number;
  stealth: number;
  dexterity: number;
  wisdom: number;
  experienceLevel: number;
  stance: BattleStance;
  movementMode: MovementMode;
  weapon: string | number | WeaponDefinition;
  loaded: number;
  ammo?: number;
  priming?: number;
  flints?: number;
  condition: number;
  jammed: boolean;
  mounted: boolean;
  horse: boolean;
  bleeding: number;
  bandaged: number;
  shock: number;
  carriedAP: number;
  routed: boolean;
  medkits: number;
  momentum: number;
  lastDirection: string | null;
  weaponMode: string;
  activeSlot: string;
  fatigue: number;
  rations: number;
  unconscious: boolean;
  inventory: Record<string, EquipmentItem | number>;
  boleadoras: number;
  torches: number;
  strengthTraining: number;
  interceptTurn: number;
  parryTurn: number;
  counterTurn: number;
  braceTurn: number;
  braced: boolean;
  knockedDown: boolean;
  overwatch: boolean;
  reactionTurn: number;
  reactionSpent: number;
  militia?: boolean;
  surrendered?: boolean;
  entangled?: boolean;
  stats?: Record<string, number>;
  abilities?: string[];
  traits?: string[];
  nickname?: string;
  nationality?: string;
  rank?: string;
  xp?: number;
  canMount?: boolean;
  missionAlly?: boolean;
  stealthMode?: boolean;
  activeSupply?: string;
  activeTool?: string;
  activeItem?: string;
  militiaRank?: 0 | 1 | 2;
  militiaExperience?: number;
  skillPractice?: Record<string, number>;
  trainedStats?: Record<string, number>;
  lastKnownEnemy?: TacticalPoint & { turn: number };
  lastHeardNoise?: TacticalPoint & {
    turn: number;
    kind: string;
    uncertainty: number;
    investigated?: boolean;
  };
  weaponDropped?: boolean;
  weaponInstanceId?: string;
  reloadProgress?: number;
  reprimeProgress?: number;
  aimed?: boolean;
  ready?: boolean;
}
export interface CivilianHarmOrigin {
  attackerId: string | null;
  side: 'player' | 'enemy' | 'unknown';
  militia: boolean;
  intentional: boolean;
}
export interface CivilianHarmIncident extends CivilianHarmOrigin {
  sequence: number;
  kind: 'wounded' | 'death';
  hpBefore: number;
  hpAfter: number;
}
export interface BattleNpc extends BattleBody {
  civilianHarm?: { version: 1; incidents: CivilianHarmIncident[] };
  corpseRemovedAtSecond?: number;
  presenceRevision?: number;
  civilianSupplies?: {
    version: 1;
    rations: number;
    torches: number;
    medkits: number;
    boleadoras: number;
  };
  civilianWeapons?: {
    version: 1;
    primary: import('./item-types.ts').HandRecord | null;
    blade: import('./item-types.ts').HandRecord | null;
  };
  operativeId?: number;
  greeting?: string;
  detention?: {
    operativeId: number;
    capturedAt: number;
    sector: string;
    freed: boolean;
    captureSequence?: number;
  };
  detentionEscape?: {
    version: 1;
    battleId: string;
    leaderId: string;
    energySpent: 1;
    leader: TacticalPoint;
    width: number;
    height: number;
  };
  escort?: { leaderId: string; waiting: boolean };
  surrendered?: boolean;
  routed?: boolean;
  ai?: {
    cycle?: number;
    wait?: number;
    homeId?: string | null;
    destination?: TacticalPoint;
    activity?: string;
    target?: TacticalPoint;
    threat?: TacticalPoint & {
      turn: number;
      kind: 'fire' | 'explosion' | 'alarm';
      uncertainty: number;
    };
    safeAfter?: number;
  };
  questGifts?: EquipmentItem[];
  role?: string;
  dialogue?: string;
  dialogueId?: string;
  faction?: string;
  recruitable?: boolean;
  prisoner?: boolean;
  captured?: boolean;
  patrol?: TacticalPoint[];
  supplies?: Record<string, number>;
}
export interface BattleTile extends TacticalPoint {
  projectileResistance?: number;
  type: string;
  id?: string;
  kind?: string;
  blocked?: boolean;
  cover?: number;
  material?: string;
  buildingId?: string | null;
  roomId?: string | null;
  elevation?: number;
  slabThickness?: number;
  obstacleHeight?: number;
  open?: boolean;
  locked?: boolean;
  broken?: boolean;
  destroyed?: boolean;
  structureDamage?: number;
  jammed?: boolean;
  doorId?: string;
  style?: string;
  axis?: 'x' | 'y';
  edgeX?: number;
  edgeY?: number;
}
export interface BattleRoom {
  id: string;
  cells: TacticalPoint[];
  tacticalLevel?: number;
  ruined?: boolean;
}
export interface BattleBuilding extends TacticalPoint {
  id: string;
  name?: string;
  tag?: string;
  tower?: boolean;
  width: number;
  height: number;
  kind?: string;
  architecture?: string;
  roof?: string;
  material?: string;
  wallFinish?: string;
  roofFinish?: string;
  doorStyle?: string;
  windowStyle?: string;
  rooms?: BattleRoom[];
  walls?: BattleTile[];
  ruined?: boolean;
  ruin?: boolean;
  campaignStyleMode?: 'selected';
  campaignStyle?: {
    name: string;
    roof: 'tile' | 'thatch' | 'terrace';
    wall: string;
    trim: string;
    height: number;
    gallery?: boolean;
    tower?: boolean;
    upper?: boolean;
    arcade?: boolean;
    awning?: boolean;
  };
}
export interface BattleProp extends TacticalPoint {
  knownToPlayer?: boolean;
  contents?: import('./environment-types.ts').EnvironmentItem[];
  locked?: boolean;
  id: string;
  type: string;
  roomId?: string;
  buildingId?: string;
  footprint?: { width: number; height: number };
  rotation?: number;
  material?: string;
  obstacleHeight?: number;
  decorative?: boolean;
  blocksMovement?: boolean;
  open?: boolean;
  broken?: boolean;
  destroyed?: boolean;
  structureDamage?: number;
  purpose?: string;
  generatedRoomDressing?: boolean;
}
export interface BattleLight extends TacticalPoint {
  id?: string;
  type?: string;
  radius?: number;
  intensity?: number;
  extinguished?: boolean;
  turns?: number;
  remainingSeconds?: number;
}
export interface BattleArtillery extends TacticalPoint {
  id: string;
  type: string;
  side: 'player' | 'enemy';
  facing?: number;
  loaded: boolean;
  ammo: number;
  reloadProgress?: number;
  profile?: { name?: string; crew?: number };
}
export interface BattleLoot extends TacticalPoint, EquipmentItem {
  questDelivery?: boolean;
  knownToPlayer?: boolean;
  unitId?: string;
  stack?: import('./item-types.ts').ItemStack;
  id?: string;
  items?: EquipmentItem[];
  taken?: boolean;
  heldBy?: string;
  containerId?: string;
}
export interface BattleSmoke extends TacticalPoint {
  id?: string;
  radius?: number;
  turns?: number;
  remainingSeconds?: number;
}
export interface BattleExit {
  id: string;
  edge: string;
  destination: string;
  cells?: TacticalPoint[];
}
export interface CombatJournal {
  version: 1;
  entries: { turn: number; text: string }[];
}
export type PendingBattleSectorOperation = { interruptedAtSecond: number } & (
  | { kind: 'order'; order: TacticalAction }
  | { kind: 'endTurn'; remainingRestSeconds?: number; order?: MoveAction }
  | { kind: 'continue'; order?: MoveAction }
  | {
      kind: 'groupMovement';
      request: GroupMoveAction;
      continuation: GroupMovementContinuation;
      order?: MoveAction;
    }
);
export interface BattleSnapshot {
  bleedSeconds?: number;
  roundTimeCharged?: boolean;
  savedHour?: number;
  savedSecond?: number;
  residentPositions?: { characterId: string; position: { x: number; y: number; level: number } }[];
  worldTimeline?: import('../domain/world/world-timeline.ts').WorldTimelineSnapshot;
  worldItemAvailability?: Record<string, number>;
  residentRoutine?: import('../domain/world/resident-routine.ts').ResidentRoutineSnapshot;
  residentScavengingReceipts?: import('./world-state-types.ts').ResidentScavengingReceipt[];
  deathHistory?: import('./world-state-types.ts').SectorDeathRecord[];
  residentScavengingSecond?: number;
  residentConditionSecond?: number;
  militaryConditionSecond?: number;
  civilianTurns?: number;
  civilianSeconds?: number;
  finiteArtilleryArsenal?: {
    version: 1;
    sector: string;
    chest: string;
    pieces: { id: string; type: string; side: 'player' | 'enemy'; loaded: boolean; ammo: number }[];
  };
  fittingRulesVersion?: number;
  ammunitionVersion?: number;
  exitRulesVersion?: number;
  sourceMapId?: string;
  alliedTurn?: {
    unitIds: string[];
    unitIndex: number;
    actionsTaken: number;
    startEnemyAfter: boolean;
  };
  contactInitiative?: 'enemy';
  approachingNpcIds?: string[];
  publicJournal?: CombatJournal;
  version: number;
  width: number;
  height: number;
  units: BattleUnit[];
  npcs: BattleNpc[];
  tiles: BattleTile[];
  buildings: BattleBuilding[];
  props: BattleProp[];
  lights: BattleLight[];
  artillery: BattleArtillery[];
  groundItems: BattleLoot[];
  droppedWeapons: BattleLoot[];
  smoke: BattleSmoke[];
  log: string[];
  revealedRooms: string[];
  exits: BattleExit[];
  sectorId: string;
  sectorName: string;
  battleId: string | null;
  mode: 'exploration' | 'combat';
  phase: 'player' | 'enemy' | 'interrupt';
  status: 'active' | 'victory' | 'defeat' | 'retreat';
  turn: number;
  enemyTurns: number;
  startSeconds: number;
  elapsedSeconds: number;
  syncedSeconds: number;
  seed: number;
  biome: string;
  altitude: number;
  night: boolean;
  lastError: string | null;
  weather: { rain: number; humidity: number; wind?: number; temperature?: number; night?: boolean };
  sectorSession?: SectorSessionSnapshot;
  gameSessionId?: string;
  gameRevision?: number;
  sectorRevision?: number;
  campaignPackage?: CampaignContent;
  contentCampaign?: { package: CampaignContent };
  campaignOrigin?: CampaignOrigin;
  sectorOperationContext?: SectorOperationContextSnapshot;
  sceneId?: string;
  sectorCode?: string;
  wallEdges?: BattleTile[];
  upperSurfaces?: BattleTile[];
  climbLinks?: { id: string; kind: string; from: TacticalPoint; to: TacticalPoint }[];
  pendingSectorOperation?: PendingBattleSectorOperation;
  deployment?: { cells?: TacticalPoint[]; entries?: TacticalPoint[]; confirmed?: boolean };
  presentationVisibleIds?: string[];
  presentationStepMs?: number;
  presentationMovingUnitId?: string | null;
  equipmentContext?: 'campaign';
  worldTimeLimitSecond?: number;
  sectorCleared?: boolean;
  interrupt?: {
    side: 'player';
    unitIds: string[];
    enemyId: string;
    returnTo?: 'reaction';
    militiaActions?: Record<string, number>;
  };
  enemyTurn?: { unitId?: string };
  reactionStack?: { unitId?: string; side?: BattleSide }[];
}
export interface MoveAction extends TacticalPoint {
  type: 'move';
  unitId: string | number;
  movement?: MovementMode;
  movementIntent?: MovementIntent;
  conversationTargetId?: string;
}
export interface GroupMoveAction extends TacticalPoint {
  type?: 'groupMove';
  unitIds: (string | number)[];
  anchorId: string | number;
  movement?: MovementMode;
  movementIntent?: MovementIntent;
}
export const TacticalActionKind = Object.freeze({
  Ambient: 'ambient',
  ApproachLoot: 'approachLoot',
  DragEquipment: 'dragEquipment',
  Exit: 'exit',
  Explore: 'explore',
  InventoryMap: 'inventoryMap',
  Loot: 'loot',
  MeleePoint: 'meleePoint',
  PickupEquipment: 'pickupEquipment',
  PlaceEquipment: 'placeEquipment',
  Rest: 'rest',
  ReturnEquipmentCursor: 'returnEquipmentCursor',
  ThrowGrenade: 'throwGrenade',
  ThrowKnife: 'throwKnife',
  Transfer: 'transfer',
  UseItem: 'useItem',
  WeaponMode: 'weaponMode',
  Fire: 'fire',
  FirePoint: 'firePoint',
  Melee: 'melee',
  Heal: 'heal',
  Free: 'free',
  PrisonerEscort: 'prisonerEscort',
  Drop: 'drop',
  Charge: 'charge',
  Artillery: 'artillery',
  ArtilleryReload: 'artilleryReload',
  ArtilleryMove: 'artilleryMove',
  ArtilleryPivot: 'artilleryPivot',
  Reload: 'reload',
  Reprime: 'reprime',
  Stance: 'stance',
  Face: 'face',
  Aim: 'aim',
  Mount: 'mount',
  Dismount: 'dismount',
  Equip: 'equip',
  EquipBlade: 'equipBlade',
  SwitchWeapon: 'switchWeapon',
  Door: 'door',
  Breach: 'breach',
  Climb: 'climb',
  Bolas: 'bolas',
  Torch: 'torch',
  Ration: 'ration',
  Overwatch: 'overwatch',
  Stealth: 'stealth',
  Steal: 'steal',
  Deployment: 'deployment',
  ConfirmDeployment: 'confirmDeployment',
  PlaceUnit: 'placeUnit',
  Weapon: 'weapon',
  SwapHands: 'swapHands',
  EquipLoot: 'equipLoot',
  FitBayonet: 'fitBayonet',
  RemoveBayonet: 'removeBayonet',
  LootBatch: 'lootBatch',
  Movement: 'movement',
  Look: 'look',
  Brace: 'brace',
  Repair: 'repair',
  ThrowTorch: 'throwTorch',
  Boleadoras: 'boleadoras',
  GiveItem: 'giveItem',
  UnloadEquipment: 'unloadEquipment',
  Attachment: 'attachment',
  UnloadAmmunition: 'unloadAmmunition',
  SelectAmmunitionLoad: 'selectAmmunitionLoad',
  CraftDressings: 'craftDressings',
  ContainerLoot: 'containerLoot',
  PlaceDeployment: 'placeDeployment',
  ClearDeployment: 'clearDeployment',
  SpreadDeployment: 'spreadDeployment',
  MovePocket: 'movePocket',
  Environment: 'environment',
  PrisonerRelease: 'prisonerRelease',
  Surrender: 'surrender',
} as const);
export type TacticalActionType = (typeof TacticalActionKind)[keyof typeof TacticalActionKind];
export interface EquipmentAction {
  type: 'pickupEquipment' | 'placeEquipment' | 'dragEquipment' | 'returnEquipmentCursor';
  unitId?: string | number;
  sourceId?: string;
  destinationId?: string;
  count?: number;
  expectedSource?: string;
  expectedDestination?: string;
}
export type TacticalAction =
  | MoveAction
  | (GroupMoveAction & { type: 'groupMove' })
  | EquipmentAction
  | {
      type: TacticalActionType;
      open?: boolean;
      expectedHost?: string;
      expectedCursor?: string;
      family?: string;
      transferKind?: 'give' | 'relay' | 'throw' | 'drop' | 'gift';
      transferRoute?: string[];
      hostId?: string;
      operation?: string;
      kind?: string;
      id?: string;
      wallEdgeId?: string;
      axis?: 'x' | 'y';
      verb?: string;
      index?: number;
      doorId?: string;
      unitId?: string | number;
      targetId?: string | number;
      npcId?: string;
      artilleryId?: string;
      targetKind?: 'unit' | 'npc' | 'artillery';
      x?: number;
      y?: number;
      tacticalLevel?: number;
      item?: string;
      itemId?: string;
      slot?: string;
      sourceId?: string;
      destinationId?: string;
      count?: number;
      expectedSource?: string;
      expectedDestination?: string;
      aim?: number;
      bodyPart?: string;
      mode?: string;
      stance?: BattleStance;
      facing?: number;
      enabled?: boolean;
      seconds?: number;
      exitId?: string;
      escortOrder?: 'follow' | 'wait';
      supplyKey?: string;
      toolKey?: string;
      inventoryKey?: string | null;
      destination?: string;
      linkId?: string;
      hitLocation?: string;
      unitIds?: (string | number)[];
      dropIndex?: number;
      groundId?: string;
      items?: (
        | { targetId: string; item: string; count: number }
        | { groundId: string; count: number }
        | { dropIndex: number; count: number }
      )[];
      environment?: {
        kind: string;
        id?: string;
        verb?: string;
        x?: number;
        y?: number;
        tacticalLevel?: number;
      };
      movement?: MovementMode;
      movementIntent?: MovementIntent;
      weaponMode?: string;
    };
export interface GroupMovementMember {
  unitId: string;
  from: TacticalPoint;
  to?: TacticalPoint;
  desired?: TacticalPoint;
  destination: TacticalPoint | null;
  path: TacticalRoutePoint[];
  cost: number;
  reason: string;
  status?: string;
  moved?: boolean;
  energyBefore?: number;
  energyAfter?: number;
  elapsedSeconds?: number;
}
export interface GroupMovementContinuation {
  request: GroupMoveAction;
  members: GroupMovementMember[];
  index: number;
  route: TacticalRoutePoint[] | null;
  orders: MoveAction[];
  startSeconds: number;
}
export interface GroupMovementReport {
  members: GroupMovementMember[];
  status: string;
  reason: string;
  elapsedSeconds: number;
  actions: number;
  orders: MoveAction[];
}
export interface GroupMovementResult extends GroupMovementReport {
  state: BattleSnapshot;
}
export interface MovementStepResult<Continuation = TacticalRoutePoint[]> {
  state: BattleSnapshot;
  continuation: Continuation | null;
  status: 'stopped' | 'completed' | 'moving' | 'interrupted' | 'invalid' | 'partial' | 'contact';
  unitId?: string;
  report?: GroupMovementReport;
}
export interface BattlePresentationFrame {
  state: BattleSnapshot;
  type: string;
  action: string;
  unitId?: string;
  targetPoint?: TacticalPoint & { id?: string; kind?: 'unit' | 'npc' };
  visibleIds?: string[];
  performed?: boolean;
  shotComplete?: boolean;
  artilleryComplete?: boolean;
  contactComplete?: boolean;
  releaseComplete?: boolean;
  startedAt?: number;
  durationMs?: number;
  actionStartedAt?: number;
  actionDurationMs?: number;
  actionId?: number;
  sequenceId?: string;
  index?: number;
  careSelf?: boolean;
  healInterval?: boolean;
  mountFromPosture?: string;
  mountToPosture?: string;
  mountAction?: 'mount' | 'dismount';
  mountComplete?: boolean;
  mode?: string;
  meleeStyle?: string;
  crewIds?: string[];
  actionWork?: { from: number; to: number; hand?: 'primary' | 'offhand'; barrel?: number }[];
  shotVisual?: FirearmPresentation;
  artilleryVisual?: ArtilleryPresentation;
  knifeVisual?: KnifePresentation;
  grenadeVisual?: GrenadePresentation;
  grenadeEffect?: { id: number; startedAt: number; visual: GrenadePresentation } | null;
  cameraFocus?: TacticalPoint | null;
  shotHand?: 'primary' | 'offhand';
  shotId?: string | number;
  impacts?: BodyImpact[];
}
export interface PresentedBattleResult {
  state: BattleSnapshot;
  frames: BattlePresentationFrame[];
}

export type CampaignContext =
  | Partial<CampaignContent>
  | CampaignSnapshot
  | BattleSnapshot
  | {
      contentCampaign?: { package: CampaignContent };
      campaignPackage?: CampaignContent;
      campaignOrigin?: CampaignOrigin;
    }
  | null;

export interface ProjectilePresentationPoint extends TacticalPoint {
  height: number;
  fraction?: number;
}
export interface FirearmPresentation {
  visible: boolean;
  source: ProjectilePresentationPoint;
  impact: ProjectilePresentationPoint;
  points?: ProjectilePresentationPoint[];
  outcome: 'hit' | 'cover' | 'miss' | 'pellets' | null;
  material?: string;
  spread?: boolean;
  discharge?: boolean;
  shotHand?: 'primary' | 'offhand';
  shotId?: string | number;
  bodyTargetKey?: string;
  sourceBodyKey?: string;
}
export interface ArtilleryPresentation {
  visible: boolean;
  source: ProjectilePresentationPoint;
  impact?: ProjectilePresentationPoint;
  points?: ProjectilePresentationPoint[];
  impacts?: (ProjectilePresentationPoint & {
    outcome?: 'hit' | 'cover' | 'miss' | null;
    material?: string;
  })[];
  canister?: boolean;
  discharge?: boolean;
  cannonId?: string;
}
export interface KnifePresentation {
  visible: boolean;
  source: ProjectilePresentationPoint;
  impact: ProjectilePresentationPoint;
  weapon?: number;
}
export interface GrenadePresentation {
  visible: boolean;
  source: ProjectilePresentationPoint;
  impact: ProjectilePresentationPoint;
  landing: TacticalPoint;
  points: ProjectilePresentationPoint[];
  radius: number;
  detonated: boolean;
}
export interface BodyImpact extends TacticalPoint {
  victimKind?: 'unit' | 'npc';
  id?: string;
  unitId?: string;
  kind?: 'unit' | 'npc';
  fatal?: boolean;
  damage?: number;
  energyLoss?: number;
  hpBefore?: number;
  hpAfter?: number;
  killed?: boolean;
  knockedDown?: boolean;
  unconscious?: boolean;
}
export interface BattlePlaybackFrame extends BattlePresentationFrame {
  index: number;
  sequenceId: string;
  actionId: number;
  startedAt: number;
  durationMs: number;
  actionStartedAt: number;
  actionDurationMs: number;
}

export interface NpcGiftReceipt extends TacticalPoint {
  status: 'accepted' | 'refused' | 'interrupted';
  unitId: string;
  npcId: string;
  text: string;
  name: string;
  sourceId: string | undefined;
  expectedSource: string | undefined;
  count: number;
}
