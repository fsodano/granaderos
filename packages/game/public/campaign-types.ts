import type { CampaignContent, CampaignOrigin, QuestStatus } from '../../campaign-format/types.ts';
import type { ArrivalDecisionSnapshot } from '../domain/journeys/arrival-decision.ts';
import type { JourneyModeValue, JourneyPurposeValue } from '../domain/journeys/journey.ts';
import type {
  BattleSnapshot,
  BattleNpc,
  BattleExit,
  BattleUnit,
  EquipmentItem,
  WeaponFitting,
} from './compatibility-types.ts';

/** Campaign adapter projections use the persisted names until their save migration. */
export type ServiceEquipmentReturnMarker = {
  id: string;
  siteId: string;
  sectorId: string;
  entryEdge: 'N' | 'S' | 'E' | 'W';
  entryAnchor: { x: number; y: number };
  point?: { x: number; y: number; tacticalLevel?: number };
};
export type ServiceEquipmentReturnEntry = ServiceEquipmentReturnMarker & {
  operativeId: number;
  items: { selection: string; stack: EquipmentItem }[];
  repairPoints: number;
};
export interface CampaignOperative extends Omit<Partial<BattleUnit>, 'id' | 'side' | 'horse'> {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  alive?: boolean;
  fatigue?: number;
  xp?: number;
  agility: number;
  dexterity: number;
  strength: number;
  leadership: number;
  wisdom: number;
  marksmanship: number;
  mechanical: number;
  explosives: number;
  medical: number;
  level?: number;
  role?: string;
  biography?: string;
  weeklyPay?: number;
  foreign?: boolean;
  tier?: 'elite' | 'regular';
  monthlyPay?: number;
  assignment?: string;
  assignmentTarget?: number | string;
  trainingStat?: string;
  trainingSkill?: TrainableSkill;
  instructorId?: number;
  repairTargetId?: number;
  repairScope?: 'equipment' | 'primary';
  repairWeaponId?: string | number;
  trainerId?: number;
  asleep?: boolean;
  sleepCollapsed?: boolean;
  captured?: boolean;
  capturedSector?: string | null;
  location?: string;
  sector?: string;
  horse?: string | boolean;
  ridingSkill?: number;
  trainingCredit?: number;
  carriedLoaded?: number;
  carriedReloadProgress?: number;
  startingCartridgesIssued?: boolean;
  recoveryHours?: number;
  toolkitPoints?: number;
  contractUntil?: number;
  contractExpiresAt?: number;
  lastMoralePayAt?: number | null;
  contentCharacterId?: string;
  characterId?: string;
  recruitable?: boolean;
  classId?: string;
  weaponMetadata?: { contentWeapon: import('../../campaign-format/types.ts').WeaponDefinition };
  bladeMetadata?: { contentWeapon: import('../../campaign-format/types.ts').WeaponDefinition };
  profileRegistry?: string;
  personality?: string;
  origin?: string;
  crisisResponse?: string;
  legacySkillBonus?: Partial<Record<OfficerAttribute, number>>;
  companionId?: number;
  companionBonus?: number;
  recruitmentSource?: 'contract' | 'encounter';
  serviceRefusals?: import('../../campaign-format/types.ts').ServiceRelationship[];
  preferredCompanions?: import('../../campaign-format/types.ts').ServiceRelationship[];
  service?: 'contract' | 'permanent';
  progression?: 'experience' | 'fixed';
  genericCharacter?: boolean;
  serviceGuarantee?: number;
  contentId?: string;
  bladeCondition?: number;
  weaponDropped?: boolean;
  portraitId?: string;
  poncho?: boolean;
  class?: string;
  specialty?: string;
  grenades?: Record<string, number>;
  ammunition?: Record<string, number>;
  supplies?: Record<string, number>;
  equipment?: EquipmentItem[];
}
export type TrainableSkill =
  | 'maxHp'
  | 'strength'
  | 'dexterity'
  | 'agility'
  | 'leadership'
  | 'marksmanship'
  | 'medical'
  | 'mechanical'
  | 'explosives'
  | 'stealth'
  | 'ridingSkill';
export interface CampaignOperativeState extends Partial<CampaignOperative> {
  serviceEquipmentReturn?: ServiceEquipmentReturnMarker;
  deathMinute?: number;
  residentPosition?: { x: number; y: number; tacticalLevel?: number };
  hp: number;
  maxHp: number;
  alive: boolean;
  fatigue: number;
  xp: number;
  assignment: string;
  loaded: number;
  condition: number;
  energy: number;
  morale: number;
  bleeding: number;
  medkits: number;
}
export interface CampaignSector {
  owner: string;
  loyalty: number;
  militia: number[];
  damageUntil: number;
  fort: number;
  militiaExperience?: number[];
  contested?: boolean;
  supplied?: boolean;
}
export interface CampaignJourney {
  version: 1;
  id?: string;
  path: string[];
  returnPath?: string[];
  mode: JourneyModeValue;
  startedAt: number;
  startedSecond?: number;
  legHours: number;
  elapsed: number;
  elapsedSecond?: number;
  status: 'moving' | 'paused' | 'ready' | 'completed';
  returning: boolean;
  reason: string | null;
  intent?: 'travel' | 'attack';
  purpose?: JourneyPurposeValue;
  travelledSeconds?: number;
  pendingSeconds?: number;
  legPaid?: boolean;
  arrivalSequence?: number;
  arrivalDecision?: ArrivalDecisionSnapshot;
}
export type CampaignArrivalDecision = ArrivalDecisionSnapshot & {
  squadId: string;
  name: string;
  origin: string;
  members: number[];
};
export interface CampaignTravelStatus {
  status: CampaignJourney['status'];
  intent: 'travel' | 'attack';
  purpose: JourneyPurposeValue;
  mode: JourneyModeValue;
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
  arrivalDecision: ArrivalDecisionSnapshot | null;
}
export interface StrategicRoutePreview {
  valid: boolean;
  reason: string | null;
  path: string[];
  hours: number;
  action: Extract<CampaignAction, { type: 'redirectJourney' | 'travel' | 'attack' }> | null;
}
export interface CampaignSquad {
  id: string;
  name: string;
  members: number[];
  location: string;
  journey?: CampaignJourney;
  journeyRevision?: number;
}
export interface TownIncomeReceipt {
  sourceId: string;
  npcId: string;
  sectorId: string;
  approach: 'friendly' | 'direct';
  hour: number;
  secondOfHour: number;
}
export interface CampaignConversation {
  met?: boolean;
  secondOfHour?: number;
  sector?: string;
  lastApproach?: string;
  incomeActivation?: TownIncomeReceipt;
  npcId?: string;
  text?: string;
  reply?: string;
  approach?: string;
  accepted?: boolean;
  reason?: string;
  hour?: number;
  giftCount?: number;
  outcome?: string;
  dialogueNode?: string;
  dialogueEffect?: {
    applied: boolean;
    amount?: number;
    movement?: { name: string; destination: string };
    quest?: { title: string; status: string };
  };
}
export interface CampaignCorrespondence {
  id: string;
  sender: string;
  text: string;
  received: boolean;
  subject?: string;
  hour: number;
}
export interface CampaignLogEntry {
  hour: number;
  text: string;
  secondOfHour?: number;
}
export interface CampaignServiceContract {
  kind?: 'patriot' | 'legacy' | 'paid';
  paid?: number;
  operativeId?: number;
  start?: number;
  until?: number;
  expiresAt?: number | null;
  expiresSecond?: number;
  started?: number;
  startedSecond?: number;
  guaranteeId?: string;
  term?: string;
  rate?: number;
  pay?: number;
}
export type CampaignErrandRecord = {
  offeredAt: number;
  beneficiaryId?: string;
  escortOrder?: { leaderId: string; waiting: boolean };
} & (
  | { status: 'offered'; completedAt: null }
  | {
      status: 'completed';
      completedAt: number;
      questResolution?: 'cash' | 'civic';
      arrival?: {
        x: number;
        y: number;
        leaderX: number;
        leaderY: number;
        width: number;
        height: number;
      };
    }
  | {
      status: 'failed';
      completedAt: null;
      failedAt: number;
      failureReason?: 'contacts-dead' | 'contact-dead';
    }
  | {
      status: 'withdrawn';
      completedAt: null;
      withdrawnAt: number;
      withdrawnSecond: number;
      withdrawal: {
        npcId: string;
        unitId: number;
        deliveredCount: number;
        actualSupportLoss: number;
      };
    }
);
export interface CampaignQuest {
  id?: string;
  status?: string;
  stage?: string | number;
  active?: boolean;
  completed?: boolean;
  failed?: boolean;
  deadline?: number;
  acceptedAt?: number;
}
export interface CampaignPendingBattle {
  enemies?: BattleUnit[];
  hour?: number;
  secondOfHour?: number;
  syncedSeconds?: number;
  exits?: BattleExit[];
  assaultSquads?: { id: string; name?: string; origin: string; members: number[] }[];
  id: string;
  sector: string;
  sceneId?: string | null;
  squad: CampaignOperative[];
  missionAllies?: CampaignOperative[];
  garrison?: BattleUnit[];
  defenseGroupId?: string;
  occupationGroupIds?: string[];
  npcs?: BattleNpc[];
  seed?: number;
  title?: string;
  missionId?: string;
  kind?: string;
  peaceful?: boolean;
  exploration?: boolean;
  resumeSnapshot?: BattleSnapshot;
  name?: string;
  preparation?: { entry?: string; formation?: string };
}
export interface CampaignEncounter {
  groupId?: string;
  id: string;
  type?: string;
  sector?: string;
  title?: string;
  description?: string;
  squadId?: string;
}
export interface CampaignAttentionEvent {
  subject: string;
  assignment: string;
  operativeId: number | null;
  sector: string;
  state: 'complete' | 'blocked' | 'working' | 'waiting';
  code: string | null;
  targetId: number | null;
  skill: string | null;
  binding: string;
}
export interface CampaignAttentionNotice {
  hour: number;
  requestedHours: number;
  advancedHours: number;
  events: CampaignAttentionEvent[];
}
export interface CampaignAttention {
  version: number;
  reported: Record<string, { binding: string; code: string | null }>;
  notice: CampaignAttentionNotice | null;
}
export interface CampaignHiringArrival {
  operativeId: number;
  destination: string;
  bookedAt: number;
  departedAt: number;
  dueAt: number;
  bookedSecond?: number;
  departedSecond?: number;
  dueSecond?: number;
  travelHours: number;
  term: string;
  priceScale?: number;
  paid: number;
  permanent: boolean;
  serviceHours: number | null;
  guaranteeId?: string;
}
export interface CampaignArtillery {
  id: string;
  type: string;
  side: 'player' | 'enemy';
  loaded: boolean;
  ammo: number;
  reloadProgress?: number;
  facing?: number;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  stationed?: boolean;
  fromDepot?: string;
}
export interface CampaignArtilleryTransfer {
  id: string;
  from: string;
  to: string;
  mode: 'carts' | 'flotilla';
  path: string[];
  departedAt: number;
  dueAt: number;
  gun: CampaignArtillery;
}
export interface CampaignShipment {
  item: string | number;
  quantity: number;
  due: number;
}
export interface StoredEquipmentInstance {
  id: string;
  item: number;
  condition: number;
  jammed: boolean;
  loaded?: number;
  instanceId?: string;
  fittingPattern?: string;
  fittings?: Record<string, WeaponFitting>;
  reloadProgress?: number;
  ammunitionChoice?: string;
  itemMetadata?: { contentWeapon?: import('../../campaign-format/types.ts').WeaponDefinition };
}
export interface CampaignMerchant {
  cash: number;
  stock: Record<string, number>;
  usedItems: StoredEquipmentInstance[];
  supplies: { medkits: number; ponchos?: number };
  restockHours: number;
  grenades?: { arsenal: number };
}
export interface CampaignHorse {
  id: string;
  name: string;
  sex: 'mare' | 'stallion';
  location: string;
  bornAt: number;
  stamina: number;
  condition: number;
  feed: number;
  assignedTo: number | null;
  hired: boolean;
  hireUntil: number | null;
  pregnantUntil: number | null;
  returned?: boolean;
  custody?: { kind: 'captured' | 'field'; sector: string; operativeId: number } | null;
}
export type CampaignHorseOrder =
  | { type: 'acquire' | 'hire'; name?: string; sex?: 'mare' | 'stallion' }
  | { type: 'assign'; horseId: string; operativeId: number }
  | { type: 'unassign'; horseId: string }
  | { type: 'feed'; horseId: string; days: number }
  | { type: 'breed'; horseId: string; sireId: string };
export interface CampaignMilitiaCourse {
  sector: string;
  rank: number;
  trainerId: number;
  count: number;
  remaining: number;
  duration: number;
  started: number;
  trainees?: CampaignOperative[];
}
export interface CampaignEnemyGroup {
  id: string;
  theater: string;
  command: string;
  origin: string;
  target: string;
  route: string[];
  routeIndex: number;
  launchedAt: number;
  nextArrivalAt: number;
  arrivalAt: number;
  seed: number;
  initialStrength: number;
  units: BattleUnit[];
  status: 'marching' | 'waiting' | 'engaged' | 'stationed' | 'defeated' | 'withdrawn';
  resolvedAt: number | null;
}
export interface CampaignHorseState {
  version: number;
  hour: number;
  nextId: number;
  horses: CampaignHorse[];
  log: string[];
  lastError: string | null;
  cost?: number;
}
export type CampaignQuestEvent = {
  quest: string;
  from: QuestStatus;
  to: QuestStatus;
  hour: number;
  secondOfHour?: number;
} & (
  | { deadline: number }
  | { death: string }
  | { campaignEvent: string }
  | { npc: string; node: string; choice: string }
);
export interface CampaignEventReceipt {
  event: string;
  hour: number;
  outcome: 'applied' | 'skipped';
  amount: number;
}
export interface CampaignSnapshot {
  civilianState?: import('./world-state-types.ts').CivilianStateSnapshot;
  version: number;
  seed: number;
  hour: number;
  secondOfHour?: number;
  phase: number;
  location: string;
  gameSessionId?: string;
  gameRevision: number;
  campaignId?: string;
  contentCampaign?: {
    version: 2;
    adapter: 'character-presence-v1';
    identity: { version: number; packageId: string; formatVersion: number; hash: string };
    package: CampaignContent;
  };
  campaignPackage?: CampaignContent;
  campaignOrigin?: CampaignOrigin;
  contentQuestEvents?: CampaignQuestEvent[];
  campaignProgress?: {
    version: 1;
    completed: { chapter: string; hour: number; secondOfHour: number }[];
    outcome: { type: 'victory' | 'defeat'; hour: number; secondOfHour: number } | null;
  };
  campaignEventState?: { version: 1; receipts: CampaignEventReceipt[] };
  activeSquadId: string;
  squads: CampaignSquad[];
  squad: number[];
  recruited: number[];
  operativeState: Record<number, CampaignOperativeState>;
  officer: {
    name: string;
    answers: Record<string, string>;
    profile?: CampaignOfficerProfile;
  } | null;
  resources: { treasury: number };
  reputation: Record<string, number>;
  sectors: Record<string, CampaignSector>;
  flags: Record<string, boolean>;
  routes: Record<string, boolean>;
  blockade: boolean;
  pendingBattle: CampaignPendingBattle | null;
  pendingEncounter: CampaignEncounter | null;
  completed: boolean;
  defeated: boolean;
  lastError: string | null;
  log: CampaignLogEntry[];
  lastConversation: CampaignConversation | null;
  conversations: Record<string, CampaignConversation>;
  contracts: Record<number, CampaignServiceContract>;
  correspondence?: CampaignCorrespondence[];
  quests: Record<string, CampaignErrandRecord>;
  missions: Record<string, CampaignQuest>;
  merchants: Record<string, CampaignMerchant>;
  artilleryMerchants?: Record<string, { guns: CampaignArtillery[] }>;
  artilleryDepots?: Record<string, CampaignArtillery[]>;
  artilleryTransfers?: CampaignArtilleryTransfer[];
  armory: Record<string, number>;
  armoryItems: StoredEquipmentInstance[];
  loadouts: Record<number, EquipmentItem>;
  artillerySelection: string[];
  artillery?: CampaignArtillery[];
  stationedArtillery?: CampaignArtillery[];
  hiringArrivals: CampaignHiringArrival[];
  equipmentShipments: CampaignShipment[];
  horseState: CampaignHorseState;
  assignmentAttention: CampaignAttention;
  contractAttention: {
    version: number;
    reported: Record<number, Omit<CampaignContractEvent, 'operativeId'>>;
    notice: CampaignContractNotice | null;
  };
  logisticsNotice: CampaignLogisticsNotice | null;
  logisticsAttention: { version: number; reported: Record<string, string> };
  sceneStates: Record<string, BattleSnapshot>;
  sectorStates: Record<string, BattleSnapshot>;
  suspendedSectorSessions?: { request: CampaignPendingBattle; snapshot: BattleSnapshot }[];
  ammunitionStores: Record<string, Record<string, number>>;
  ammunitionShops: Record<string, Record<string, number>>;
  cohesion: Record<string, number>;
  travelNotice?: {
    hour: number;
    secondOfHour?: number;
    events: { squadId: string; name: string; sector: string; text: string }[];
  } | null;
  enemyIntelligence?: {
    version: 1;
    reports: Record<string, import('../enemy-intelligence.ts').EnemyIntelligenceObservation>;
  };
  nextEnemyGroupId: number;
  ammunitionVersion?: number;
  fittingRulesVersion?: number;
  contentPresence?: Omit<
    import('./content-placement-types.ts').ContentPlacementSession,
    'content' | 'history'
  >;
  skillLearningVersion?: 1;
  townIncome: {
    version: 1;
    activations: Record<string, TownIncomeReceipt>;
    lastPaidDay: number;
    dailyAmounts?: Record<string, number>;
  };
  serviceEquipmentReturns?: { version: 1; nextId: number; entries: ServiceEquipmentReturnEntry[] };
  militiaTraining: CampaignMilitiaCourse[];
  garrisons: Record<string, CampaignOperative[]>;
  missionAllies: Record<string, CampaignOperative>;
  foundMoney: string[];
  cityLoyaltyEvents: CampaignLogEntry[];
  encounterHistory: CampaignLogEntry[];
  enemyGroups: CampaignEnemyGroup[];
}
export type OfficerAttribute =
  | 'maxHp'
  | 'agility'
  | 'dexterity'
  | 'strength'
  | 'leadership'
  | 'wisdom'
  | 'marksmanship'
  | 'mechanical'
  | 'explosives'
  | 'medical';
export interface CampaignOfficerProfile {
  version: 2;
  classId: string;
  portraitId: string;
  nickname?: string;
  attributes: Record<OfficerAttribute, number>;
}
export type CampaignEquipmentSlot =
  | 'primary'
  | 'blade'
  | 'offhand'
  | 'headwear'
  | 'outfit'
  | 'legwear'
  | 'offhandItem'
  | 'mainhand';
export type CampaignInventoryOrder =
  | { direction: 'take' | 'takeRepairPoints'; sourceKey: string; expected: string; count: number }
  | { direction: 'drop'; item: string; count: number }
  | { direction: 'store'; item: string; expected: string; count?: number }
  | {
      direction: 'equip';
      slot: CampaignEquipmentSlot;
      inventoryKey: string | null;
      expected: string;
      count?: number;
    }
  | { direction: 'issueOutfit'; count?: number }
  | {
      direction: 'arrange' | 'attachment' | 'unload';
      kind?: 'cursor' | 'pocket' | 'equipment';
      cursorAction?:
        | 'pickupEquipment'
        | 'placeEquipment'
        | 'returnEquipmentCursor'
        | 'dragEquipment';
      operation?: 'attach' | 'detach';
      hostId?: string;
      expectedHost?: string;
      expectedCursor?: string;
      sourceId?: string;
      destinationId?: string;
      expectedSource?: string;
      expectedDestination?: string;
      inventoryKey?: string | null;
      slot?: string;
      item?: string;
      count?: number;
    };
export type CampaignAction =
  | { type: 'advanceStrategicTime'; seconds: number }
  | { type: 'wait'; hours?: number }
  | { type: 'selectSquad'; id: string }
  | { type: 'createSquad'; name: string; ids: number[]; sector?: string; returnToService?: boolean }
  | { type: 'squad'; ids: number[] }
  | { type: 'assignToSquad'; operativeId: number; squadId: string; returnToService?: boolean }
  | {
      type: 'travel' | 'attack';
      sector: string;
      squadIds?: string[];
      squadId?: string;
      mode?: JourneyModeValue;
      queue?: boolean;
      waypoints?: string[];
    }
  | { type: 'redirectJourney'; squadId: string; sector: string; waypoints?: string[] }
  | { type: 'cancelTravel'; squadId?: string; choice?: 'stop' | 'return' }
  | { type: 'resumeTravel'; squadId?: string }
  | { type: 'fightOnArrival' | 'withdrawOnArrival'; squadId: string; decisionId?: string }
  | { type: 'visitSector'; sector?: string }
  | { type: 'resumeSectorSession'; sectorSessionId: string; sectorState?: BattleSnapshot }
  | { type: 'visitMission'; id?: string; missionId?: string; mission?: string }
  | {
      type: 'finishMission' | 'battleResult';
      battleId: string;
      outcome: string;
      sectorState: BattleSnapshot;
      survivors: Array<Omit<BattleUnit, 'id'> & { id: string | number }>;
    }
  | {
      type: 'leaveSector';
      battleId: string;
      outcome?: string;
      sectorState: BattleSnapshot;
      survivors: Array<Omit<BattleUnit, 'id'> & { id: string | number }>;
    }
  | { type: 'beginAssault'; sector?: string; squadId?: string }
  | {
      type: 'syncTacticalTime';
      battleId: string;
      elapsedSeconds: number;
      sectorState?: BattleSnapshot;
    }
  | { type: 'setSleep'; operativeId: number; asleep: boolean }
  | ({
      type: 'assignCare' | 'assignWork';
      assignment: string;
      trainerId?: number;
      studentId?: number;
      stat?: string;
      skill?: TrainableSkill;
      instructorId?: number;
      targetId?: number;
      sector?: string;
      repairScope?: 'primary' | 'equipment';
    } & ({ operativeId: number; id?: never } | { id: number; operativeId?: never }))
  | {
      type: 'recruitCombatant' | 'recruitCivic';
      id?: number;
      characterId?: string;
      locationId?: string;
      term?: string;
      destination?: string;
      squadId?: string;
    }
  | {
      type: 'renewContract';
      id: number;
      term: string;
      expectedExpiresAt?: number | null;
      expectedExpiresSecond?: number;
      expectedGuaranteeId?: string;
    }
  | { type: 'recruit'; id?: number }
  | { type: 'dismiss'; id: number }
  | { type: 'redirectHire'; id: number; destination: string }
  | { type: 'cancelHireArrival'; id: number; expectedGuaranteeId?: string }
  | {
      type: 'createOfficer';
      name: string;
      answers: Record<string, string>;
      profile?: CampaignOfficerProfile;
    }
  | {
      type: 'talkNPC';
      dialogueNode?: string;
      dialogueChoice?: string;
      npcId: string;
      approach: string;
      unitId?: string | number;
      sectorState?: BattleSnapshot;
      term?: string;
      choice?: { id?: string; beneficiaryId?: string; targetId?: string };
    }
  | { type: 'purchaseEquipment'; item: string | number; quantity?: number }
  | { type: 'sellEquipment'; instanceId: string | number }
  | { type: 'purchaseUsedEquipment'; sector: string; instanceId: string | number }
  | {
      type: 'equip';
      operativeId?: number;
      id?: number;
      item?: string;
      itemId?: string;
      slot?: string;
      weapon?: string | number;
      blade?: string | number;
    }
  | { type: 'resupply' | 'repairWeapon'; id?: number; operativeId?: number }
  | {
      type:
        | 'purchaseMedicalSupplies'
        | 'purchaseToolkits'
        | 'purchaseAmmunition'
        | 'purchaseGrenades';
      operativeId?: number;
      count?: number;
      quantity?: number;
      amount?: number;
      ammoType?: string;
      family?: string;
      grenadeType?: string;
      sector?: string;
    }
  | {
      type: 'ammunition';
      direction: 'buy' | 'store' | 'take';
      operativeId: number;
      family: string;
      quantity: number;
    }
  | { type: 'unloadAmmunition'; operativeId: number }
  | { type: 'selectAmmunitionLoad'; operativeId: number; family: string }
  | ({ type: 'sectorInventory'; operativeId: number; sector: string } & CampaignInventoryOrder)
  | {
      type: 'exchangeEquipment';
      sector: string;
      lines: { key: string; receipt: string; quantity: number }[];
    }
  | { type: 'horseAction'; order: CampaignHorseOrder }
  | { type: 'transport'; mode: string }
  | ({ type: 'respondToEncounter'; groupId: string } & (
      | { choice: 'tactical' | 'auto' }
      | { choice: 'retreat'; destination: string }
    ))
  | { type: 'militia'; sector: string; trainerId: number; rank: number }
  | { type: 'cancelMilitia'; sector: string }
  | { type: 'transferMilitia'; from: string; to: string; rank: number; count: number }
  | { type: 'distributeMilitia'; sector: string }
  | { type: 'fortify'; sector: string }
  | { type: 'configureArtillery'; types: string[] }
  | import('./artillery-query-types.ts').ArtilleryTradeAction
  | ({ type: 'sellArtillery' } & import('./artillery-query-types.ts').ArtillerySaleOffer)
  | {
      type:
        | 'purchaseUsedArtillery'
        | 'repurchaseArtillery'
        | 'sellArtillery'
        | 'storeArtillery'
        | 'supplyArtillery'
        | 'resupplyArtillery';
      id?: string;
      artilleryId?: string;
      sector?: string;
      count?: number;
      typeId?: string;
      ammo?: number;
    }
  | {
      type: 'transportArtillery';
      sector: string;
      artilleryId: string;
      to: string;
      mode: 'carts' | 'flotilla';
      source: 'field' | 'depot';
    }
  | { type: 'fundArmy' | 'foundry' | 'academy'; amount?: number }
  | { type: 'policy'; kind: 'tax' | 'frontierRequisition' }
  | {
      type: 'diplomacy';
      kind:
        | 'northPact'
        | 'partisanSupply'
        | 'parliament'
        | 'emancipation'
        | 'commission'
        | 'gift'
        | 'requisition'
        | 'autonomy';
    };

export interface CampaignContractEvent {
  operativeId: number;
  expiresAt: number;
  expiresSecond?: number;
  code: 'expiring' | 'expired';
}
export interface CampaignContractNotice {
  hour: number;
  secondOfHour?: number;
  requestedHours: number;
  advancedHours: number;
  events: CampaignContractEvent[];
}
export type CampaignLogisticsEvent = (
  | { kind: 'production'; sector: string; name: string; goods: Record<string, number> }
  | { kind: 'shipment' | 'convoy'; sector: string; goods: Record<string, number> }
  | { kind: 'equipment'; sector: string; item: string; quantity: number }
  | { kind: 'artillery'; sector: string; id: string; quantity: number }
) & { state?: 'blocked'; code?: string };
export interface CampaignLogisticsNotice {
  hour: number;
  requestedHours: number;
  advancedHours: number;
  events: CampaignLogisticsEvent[];
}
