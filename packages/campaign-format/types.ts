/** Published campaign file contracts. Mutable progress belongs to the game snapshot. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type Point = { x: number; y: number };
export type MapEdge = 'N' | 'E' | 'S' | 'W';
export type CampaignOwner = 'patriot' | 'royalist';
export type QuestStatus = 'not-started' | 'active' | 'completed' | 'failed';
export type SupplyId = 'rations' | 'torches' | 'medkits' | 'boleadoras' | 'priming' | 'flints';
export type CharacterCondition = {
  hp: number;
  energy: number;
  fatigue: number;
  bleeding: number;
  bandaged: number;
};
export type CharacterAttributes = {
  maxHp: number;
  agility: number;
  dexterity: number;
  strength: number;
  leadership: number;
  wisdom: number;
  marksmanship: number;
  mechanical: number;
  explosives: number;
  medical: number;
};
export type CharacterState =
  | 'alive'
  | 'dead'
  | 'serving'
  | 'present'
  | 'conscious'
  | 'unconscious'
  | 'wounded'
  | 'bleeding'
  | 'stable'
  | 'healthy';
export type DialogueCondition =
  | { type: 'character'; character: string; state: CharacterState }
  | { type: 'supply'; character: string; item: SupplyId; min: number; max: number | null }
  | { type: 'meeting'; character: string }
  | { type: 'quest'; quest: string; status: QuestStatus }
  | { type: 'project'; project: 'foundry' | 'army'; completed: boolean }
  | { type: 'sector'; sector: string; owner: CampaignOwner }
  | { type: 'day' | 'treasury'; min: number; max: number | null };
export type DialogueEffect =
  | { type: 'treasury'; operation: 'pay' | 'receive'; amount: number }
  | { type: 'movement'; character: string; destination: 'speaker' | 'routine' }
  | { type: 'quest'; quest: string; status: Exclude<QuestStatus, 'not-started'> };
export type DialogueChoice = {
  id: string;
  label: string;
  next: string;
  conditions?: DialogueCondition[];
  effects?: DialogueEffect[];
};
export type DialogueNode = { id: string; title: string; text: string; choices: DialogueChoice[] };
export type Dialogue = { entry: string; nodes: DialogueNode[] };
export type CharacterEncounter = {
  recruitable: boolean;
  greeting: string;
  requiredLeadership: number;
  requiredLiberated: number;
  requiredSector: string | null;
  noncombatant?: boolean;
  dialogue?: Dialogue;
};
export type ServiceRelationship = { character: string; reason: string };
export type CharacterDefinition = {
  id: string;
  name: string;
  nickname: string;
  role: string;
  biography: string;
  portrait: string;
  monthlyPay: number;
  weapon: string | null;
  attributes: CharacterAttributes;
  blade?: string;
  personality?: string;
  abilities?: string[];
  traits?: string[];
  speech?: Record<string, string>;
  spriteAppearance?: string;
  skinTone?: string;
  arrivalHours?: number;
  ridingSkill?: number;
  recruitmentSource?: 'contract' | 'encounter';
  service?: 'contract' | 'permanent';
  progression?: 'experience' | 'fixed';
  serviceGuarantee?: number;
  startingCondition?: CharacterCondition;
  startingSupplies?: Record<'rations' | 'torches' | 'medkits' | 'boleadoras', number> &
    Partial<Record<'priming' | 'flints', number>>;
  encounter?: CharacterEncounter;
  serviceRefusals?: ServiceRelationship[];
  preferredCompanions?: ServiceRelationship[];
};
export type ProjectileEnergy = { model: string; massGrams: number; muzzleVelocityMps: number };
export type ProjectileAirDrag = { model: string; retentionAtRange: number };
export type ProjectileProfile = {
  materialRangeSlope?: number;
  projectileEnergy?: ProjectileEnergy;
  projectileAirDrag?: ProjectileAirDrag;
};
export type AlternativeLoad = ProjectileProfile & {
  family: string;
  damage: number;
  range: number;
  pattern: 'single' | 'cone';
};
export type WeaponDefinition = ProjectileProfile & {
  id: string;
  name: string;
  template: string | number;
  damage: number;
  art?: string;
  ammunitionFamily?: string;
  fireAP?: number;
  aimAP?: number;
  reloadAP?: number;
  range?: number;
  readyAP?: number;
  ap?: number;
  capacity?: number;
  price?: number;
  stockAP?: number;
  stockDamage?: number;
  weight?: number;
  reach?: number;
  stockReach?: number;
  alternativeLoads?: AlternativeLoad[];
};
export type CompiledWeaponDefinition = WeaponDefinition & {
  version: 1;
  template: string | number;
  weight: number;
  price: number;
  art: string;
} & (
    | { ap: number; reach: number }
    | {
        fireAP: number;
        aimAP: number;
        reloadAP: number;
        range: number;
        readyAP: number;
        capacity: number;
      }
  );
export type PlacementDefinition = {
  id: string;
  character: string;
  mode: 'fixed' | 'once' | 'daily';
  selection?: 'random' | 'alternate';
  loadedGuard?: 'current' | 'range';
  sectors: string[];
  moveChance: number;
  afterDeath: string | null;
  delayMin: number;
  delayMax: number;
};
export type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  deadlineHours?: number | null;
  requiredAlive?: string[];
};
export type CampaignEvent = {
  id: string;
  atHour: number;
  text: string;
  conditions: DialogueCondition[];
  effects: DialogueEffect[];
};
export type CampaignChapter = {
  id: string;
  name: string;
  objective: string;
  conditions: DialogueCondition[];
};
export type CampaignStory = {
  introduction: string;
  victory: string;
  defeat: string;
  chapters: CampaignChapter[];
  failureConditions: DialogueCondition[];
};
export type ErrandReward = { treasury: number; loyalty: boolean };
export type ErrandBeneficiary = {
  id: string;
  npcId: string;
  sector: string;
  delivery: string;
  reward: ErrandReward;
};
export type ErrandDefinition = {
  id: string;
  npcId: string;
  sector: string;
  title: string;
  offer: string;
  delivery: string;
  cost: { treasury?: number };
  requiredSectors: string[];
  requires?: string[];
  reward?: ErrandReward;
  rewardChoice?: { reimbursement: number };
  beneficiaries?: ErrandBeneficiary[];
  withdrawal?: { supportCost: number };
  carried?: { item?: string; outfit?: string; label: string; instruction: string; count: number };
  escort?: { edge: MapEdge; destination: string };
};
export type CampaignRules = {
  startingTreasury: number;
  startingHour?: number;
  cartridgePrice?: number;
  deploymentCartridges: number;
  enemyCartridges: number;
  militiaCartridges: number;
};
export type ContractRules = {
  days: { day: number; week: number; month: number };
  salaryMonthDays: number;
  xpStep: number;
  xpRaisePercent: number;
  warningHours: number;
};
export type FoundryRules = {
  sector: string;
  name: string;
  armyName: string;
  setupCost: number;
  fundingCost: number;
};
export type CampaignRoles = { foundryEngineer: string | null; marchCommander: string | null };
export type RoadsideDiscovery = Point & {
  version: number;
  id: string;
  cell: string;
  crowbarCondition: number;
  linenShirtCondition: number;
};
export type CampaignAsset = { id: string; path: string; sha256: string; type: string };
export type CampaignAssets = { version: number; assets: CampaignAsset[] };
export type CampaignOrigin = { version: 1; id: string; revision: string };
export type CampaignManifest = {
  format: string;
  version: number;
  id: string;
  name: string;
  revision: string;
  scenario: string;
  content: string;
  world: string;
  maps: string;
  presentation: string;
  assets: string;
};
export type CampaignMapIndex = { version?: number; maps: { id: string; path: string }[] };
export type WorldSector = Point & {
  shortName?: string;
  id: string;
  grid: string;
  name: string;
  theater: string;
  biome: string;
  income: number;
  asset: string;
  neighbors: string[];
};
export type WorldCell = Point & {
  id: string;
  col: number;
  row: number;
  grid: string;
  name: string;
  district: boolean;
  location: string;
  locality: string | null;
  anchor: boolean;
  land: boolean;
  biome: string;
  theater: string;
};
export type WorldDistrict = Point & {
  id: string;
  sectorId: string;
  col: number;
  row: number;
  name: string;
  urban: boolean;
};
export type WorldPlace = { lon: number; lat: number; label: string; dx: number; dy: number };
export type GeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] };
export type IncomeSource = {
  id: string;
  name: string;
  source: string;
  sectorId: string;
  requiredSectors: string[];
  dailyAmount: number;
  representative: { npcId: string; name: string; sectorId: string };
};
export type BuildingAppearance = {
  name: string;
  roof: string;
  wall: string;
  trim: string;
  height: number;
  gallery?: boolean;
  tower?: boolean;
  upper?: boolean;
  arcade?: boolean;
  awning?: boolean;
};
export type MerchantPolicies = {
  preferences: Record<
    string,
    {
      name: string;
      description: string;
      buyPercent: number;
      preferredPercent: number;
      minimumWeaponCondition: number;
      preferredItems: (string | number)[];
      weaponRefusal: string | null;
    }
  >;
  legacyAmmunitionLimits: Record<string, number>;
  defaultLegacyAmmunitionLimit: number;
};
export type CampaignPhysicalSources = {
  version: 1;
  caches: Record<string, { chest: string; contents: EnvironmentContents[] }>;
  arsenals: Record<
    string,
    {
      version: 1;
      sector: string;
      chest: string;
      pieces: { id: string; type: string; side: 'player'; loaded: boolean; ammo: number }[];
    }
  >;
  environment: Record<
    string,
    {
      doors: ({ id: string; type: 'door' } & MapEnvironment)[];
      containers: {
        selector: {
          type: 'chest' | 'container';
          id?: string;
          buildingId?: string;
          purpose?: string;
        };
        configuration: { type: 'chest' | 'container' } & MapEnvironment;
      }[];
    }
  >;
};
export type WorldDefinition = {
  exitLinks?: [
    string,
    'N' | 'S' | 'E' | 'W',
    number,
    number,
    string,
    'N' | 'S' | 'E' | 'W',
    number,
    number,
  ][];
  sceneExits?: Record<
    string,
    {
      sector: string;
      exits: {
        id: string;
        edge: 'N' | 'S' | 'E' | 'W';
        destination: string;
        entryEdge: 'N' | 'S' | 'E' | 'W';
        entryAnchor: Point;
      }[];
    }
  >;
  sceneEntries?: {
    from: string;
    to: string;
    scene: string | null;
    entryEdge: 'N' | 'S' | 'E' | 'W';
    entryAnchor: Point;
  }[];
  sceneExitAnchors?: Record<string, Point>;
  sceneLocations?: Record<string, string>;
  landscapes?: Record<string, string>;
  sectorCash?: Record<string, number>;
  physical?: CampaignPhysicalSources;
  enemyStrategy?: {
    version: 1;
    theaters: Record<
      string,
      { legHours: number; reserve: number; raidEveryHours: number; axis: string[] }
    >;
  };
  version: number;
  columns: number;
  rows: number;
  sectors: WorldSector[];
  cells: WorldCell[];
  theaters: { id: string; name: string }[];
  factions: { id: string; name: string; description?: string }[];
  places: Record<string, WorldPlace>;
  districts: Record<string, WorldDistrict[]>;
  cities: { id: string; name: string; sectors: string[] }[];
  ruralSectors: string[];
  geography: { land: GeoGeometry[]; rivers: GeoGeometry[]; argentina?: GeoGeometry };
  incomeSources: IncomeSource[];
  buildings: {
    types: Record<string, BuildingAppearance>;
    footprints: Record<string, [number, number]>;
  };
  expansion: {
    coast: string[];
    rural: string[];
    pavedStreets?: string[];
    defaultBuildingSelection: string[];
    buildingSelections?: Record<string, string[]>;
    buildingLandmarks?: Record<string, string>;
    buildingTargets?: Record<string, number>;
    waterOffsets?: Record<string, number>;
    accessRoads?: Record<string, Point[]>;
  };
  arrivalFacilities: Record<string, string[]>;
  defaultHeadquarters: string;
  defaultFoundry: FoundryRules;
  defaultRoles: CampaignRoles;
  artilleryTrading?: ArtilleryTradingRules;
  merchantPolicies?: MerchantPolicies;
  travel?: {
    roughTransportSectors?: string[];
    flotillaTheaters?: string[];
    winter?: { months: number[]; biomes: string[]; theaters: string[]; excludeCities: boolean };
    transportPresentation?: {
      id: 'posta' | 'carts' | 'flotilla' | 'mules';
      name: string;
      description: string;
    }[];
    transportIssues?: Record<string, string>;
  };
  projection: {
    minLongitude: number;
    maxLatitude: number;
    longitudeScale: number;
    latitudeScale: number;
  };
};
export type IntroductionScene = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  visual: string;
  durationMs: number;
  portrait?: string;
  portraitAlt?: string;
  portraitName?: string;
  portraitCaption?: string;
  art?: string;
};
export type PortraitDefinition = {
  id: string;
  name: string;
  gender?: string;
  role?: string;
  skinTone?: string;
  spriteAppearance?: string;
  src: string;
  spriteSkinTone?: string;
  selectable?: boolean;
};
export type CampaignPresentation = {
  calendar?: { year: number; month: number; day: number };
  officerCreation?: import('./officer-creation-types.ts').OfficerCreationDefinition;
  version: number;
  title: string;
  subtitle?: string;
  edition?: string;
  eyebrow?: string;
  period?: string;
  menuArt?: string;
  menuArtAlt?: string;
  caption?: string;
  footer?: string;
  introduction?: { id: string; version: number; title: string; scenes: IntroductionScene[] };
  manual?: { campaign: string; goals: string; note: string };
  deskSeal?: string;
  characterPortraits?: PortraitDefinition[];
  incomeLabel?: string;
  skirmish?: {
    label: string;
    operativeIds: number[];
    horse: boolean;
    request: {
      id: string;
      name: string;
      biome: string;
      seed: number;
      enemyCount: number;
      hour?: number;
    };
  };
  atlas?: {
    title?: string;
    label?: string;
    referenceLabel?: string;
    scale?: string;
    legend?: string;
    enemyLabel?: string;
    friendlyLabel?: string;
    longitudes?: number[];
    latitudes?: number[];
    mountains?: string;
    labels?: Array<Point & { text: string; transform?: string; className?: string }>;
    sites?: Array<{ id: string; label: string; lon: number; lat: number }>;
    labelPositions?: Record<
      string,
      { edge?: 'top' | 'bottom' | 'left' | 'right'; offset?: number }
    >;
  };
};
export type MapRoom = { id: string; name?: string; cells: Point[] };
export type EnvironmentContents = {
  item: string;
  count: number;
  instanceId?: string;
  kind?: string;
  name?: string;
  weight?: number;
  weapon?: string | number;
  loaded?: number;
  condition?: number;
  jammed?: boolean;
  ammoType?: string;
  repairPoints?: number;
  outfit?: string;
};
export type MapEnvironment = {
  trap?: {
    type: 'alarm' | 'injury';
    difficulty: number;
    armed?: boolean;
    discoveredBy?: ('player' | 'enemy' | 'neutral')[];
    damage?: number;
    breathLoss?: number;
  };
  open?: boolean;
  locked?: boolean;
  broken?: boolean;
  keyId?: string;
  lockDifficulty?: number;
  lockIntegrity?: number;
  contents?: EnvironmentContents[];
};
export type MapTile = Point &
  MapEnvironment & {
    type: string;
    blocked: boolean;
    cover: number;
    blocksSight?: boolean;
    buildingId?: string;
    roomId?: string;
    material?: string;
    tacticalLevel?: number;
    elevation?: number;
  };
export type MapWall = Point &
  MapEnvironment & {
    id?: string;
    axis: 'x' | 'y';
    type: string;
    doorId?: string;
    style?: string;
    blocked?: boolean;
    blocksSight?: boolean;
    cover?: number;
    material?: string;
  };
export type MapObject = Point &
  MapEnvironment & {
    id: string;
    type?: string;
    count?: number;
    target?: string;
    name?: string;
    buildingId?: string;
    roomId?: string;
    footprint?: { width: number; height: number };
    blocksMovement?: boolean;
    blocksSight?: boolean;
    cover?: number;
    rotation?: number;
    tacticalLevel?: number;
    elevation?: number;
    side?: string;
    unitId?: string;
    containerId?: string;
    item?: string;
    amount?: number;
    radius?: number;
    intensity?: number;
    color?: string;
    destination?: string;
    edge?: MapEdge;
    entryEdge?: MapEdge;
    entryAnchor?: Point;
    width?: number;
    height?: number;
    material?: string;
  };
export type MapBuilding = Point & {
  id: string;
  name: string;
  width: number;
  height: number;
  roof: string;
  material: string;
  architecture?: string;
  kind?: string;
  rooms: MapRoom[];
  walls: MapWall[];
  wallFinish?: string;
  roofFinish?: string;
  doorStyle?: string;
  windowStyle?: string;
};
export type PhysicalMap = {
  schemaVersion: number;
  id: string;
  revision: number;
  width: number;
  height: number;
  metadata: { title: string; description?: string };
  terrain: MapTile[];
  features: MapObject[];
  buildings: MapBuilding[];
  props: MapObject[];
  items: MapObject[];
  spawns: MapObject[];
  exits: MapObject[];
  lights: MapObject[];
  decor?: MapObject[];
  boundaryRoads?: Point[];
  wallEdges?: MapWall[];
  upperSurfaces?: MapUpperSurface[];
  climbLinks?: MapClimbLink[];
};
export type CampaignContent = {
  format: string;
  version: number;
  id: string;
  name: string;
  characters: CharacterDefinition[];
  weapons: WeaponDefinition[];
  placements: PlacementDefinition[];
  quests?: QuestDefinition[];
  errands?: ErrandDefinition[];
  campaignStory?: CampaignStory | null;
  campaignEvents?: CampaignEvent[];
  roadsideDiscoveries?: RoadsideDiscovery[];
  artilleryTransport?: ArtilleryTransportRules;
  artillerySupply?: ArtillerySupplyRules;
  artilleryTrading?: ArtilleryTradingRules;
  merchantPolicies?: MerchantPolicies;
  travel?: {
    roughTransportSectors?: string[];
    flotillaTheaters?: string[];
    winter?: { months: number[]; biomes: string[]; theaters: string[]; excludeCities: boolean };
    transportPresentation?: {
      id: 'posta' | 'carts' | 'flotilla' | 'mules';
      name: string;
      description: string;
    }[];
    transportIssues?: Record<string, string>;
  };
  militiaPatrol?: MilitiaPatrolRules;
  militiaProgression?: MilitiaProgressionRules;
  careRules?: CareRules;
  artilleryProfiles?: Record<'bronze4' | 'field8' | 'swivel', ArtilleryProfile>;
  ammunitionMarket?: {
    defaults: AmmunitionMarketProfile;
    locations: Record<string, AmmunitionMarketProfile>;
  };
  includeOriginalResidents?: boolean;
  rules?: CampaignRules;
  contractRules?: ContractRules;
  foundry?: FoundryRules;
  campaignRoles?: CampaignRoles;
  headquarters?: string;
  startingTerritory?: Record<string, { owner: CampaignOwner; loyalty: number }>;
  imports?: { port: string | null; minHours: number; maxHours: number };
  arrivalSites?: { sector: string; facilities: string[] }[];
  oppositionEquipment?: Record<string, string | null>;
  militiaEquipment?: Record<string, string | null>;
  oppositionBlades?: Record<string, string | null>;
  militiaBlades?: Record<string, string | null>;
  oppositionAppearance?: Record<string, { spriteAppearance: string; skinTone: string }>;
  militiaAppearance?: Record<string, { spriteAppearance: string; skinTone: string }>;
  scenario?: string;
  campaignOrigin?: CampaignOrigin;
  world?: WorldDefinition;
  maps?: Record<string, PhysicalMap>;
  presentation?: CampaignPresentation;
  assets?: CampaignAssets;
};

export type DraftPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

export type ArtilleryTransportRules = {
  enabled: boolean;
  cartsHours: number;
  flotillaHours: number;
  cartsFee: number;
  flotillaFee: number;
};

export type ArtillerySupplyRules = {
  enabled: boolean;
  bronze4: number;
  field8: number;
  swivel: number;
  reserveLimit: number;
};

export type MilitiaPatrolRules = {
  enabled: boolean;
  waypointTicks: number;
  energyReserve: number;
  restEnergy: number;
};

export type MilitiaProgressionRules = {
  regularThreshold: number;
  veteranThreshold: number;
  marksmanshipGain: number;
  leadershipGain: number;
  levelGain: number;
};

export type CareRules = {
  minimumSkill: number;
  baseHealing: number;
  skillStep: number;
  dressingPrice: number;
  energyCost: number;
  fatigueCost: number;
  restEnergy: number;
  restFatigue: number;
  restHealingHours: number;
  bleedingDamagePercent?: number;
};

export type ArtilleryProfile = {
  name: string;
  art: string;
  initialLoaded: boolean;
  price: number;
  crew: number;
  fireAP: number;
  reloadAP: number;
  moveAP: number;
  pivotAP: number;
  range: number;
  damage: number;
  radius: number;
  penetration: number;
  initialAmmo: number;
};
export type ArtilleryTradingRules = {
  enabled: boolean;
  initialCash: number;
  buyPercent: number;
  resalePercent: number;
  buyingOverrides: Record<string, number>;
};
export type AmmunitionMarketProfile = {
  enabled: boolean;
  automaticPurchase: boolean;
  restockHours: number;
  families: Record<
    'ammoMusket' | 'ammoRifle' | 'ammoPistol' | 'ammoShot',
    { initial: number; capacity: number; replenish: number; price: number | null }
  >;
};

export type CompiledCampaignContent = CampaignContent & {
  world: WorldDefinition;
  maps: Record<string, PhysicalMap>;
  presentation: CampaignPresentation;
  assets: CampaignAssets;
  scenario: string;
};
export type CampaignRegistry = {
  format: 'granaderos-campaign-registry';
  version: 1;
  campaigns: { id: string; name: string; revision: string; manifest: string }[];
};

export type MapUpperSurface = MapTile & {
  id: string;
  tacticalLevel: number;
  elevation: number;
  slabThickness?: number;
  kind?: string;
};
export type MapClimbLink = {
  id: string;
  kind: 'climb';
  from: Point & { tacticalLevel: number };
  to: Point & { tacticalLevel: number };
};
export type CompiledPhysicalMap = {
  width: number;
  height: number;
  tiles: MapTile[];
  buildings: MapBuilding[];
  wallEdges: MapWall[];
  wallGeometryVersion: 2;
  props: MapObject[];
  lights: MapObject[];
  groundItems: MapObject[];
  containers: MapObject[];
  spawns: MapObject[];
  exits: MapObject[];
  decor: MapObject[];
  boundaryRoads: Point[];
  sourceMapId: string;
  sourceMapRevision: number;
  name: string;
  sector: string;
  upperSurfaces?: MapUpperSurface[];
  climbLinks?: MapClimbLink[];
};
