import type { Object3D, Group, Vector3 } from 'three';
import type { EquipmentItem } from '../../../../packages/game/public/compatibility-types.ts';
import type { LoadedActor } from './actor-assets';

/** Presentation records only. Simulation rosters are deliberately absent. */
export type WorldPoint = {
  x: number;
  y: number;
  tacticalLevel?: number;
  elevation?: number;
  activeClimbLink?: string;
};
export type WorldTile = WorldPoint & {
  axis?: 'x' | 'y';
  edgeX?: number;
  edgeY?: number;
  id?: string;
  type: string;
  kind?: string;
  blocked?: boolean;
  cover?: number;
  material?: string;
  buildingId?: string | null;
  roomId?: string | null;
  slabThickness?: number;
  obstacleHeight?: number;
  open?: boolean;
  locked?: boolean;
  broken?: boolean;
  destroyed?: boolean;
  structureDamage?: number;
  doorId?: string;
  style?: string;
};
export type WorldRoom = {
  id: string;
  cells: readonly WorldPoint[];
  tacticalLevel?: number;
  ruined?: boolean;
};
export type WorldBuildingStyle = {
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
export type WorldBuilding = {
  id: string;
  x: number;
  y: number;
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
  campaignStyleMode?: 'selected';
  campaignStyle?: WorldBuildingStyle;
  rooms?: readonly WorldRoom[];
  walls?: readonly WorldTile[];
  ruined?: boolean;
  ruin?: boolean;
};
export type WorldProp = WorldPoint & {
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
};
export type WorldLight = WorldPoint & {
  id?: string;
  type?: string;
  radius?: number;
  intensity?: number;
  extinguished?: boolean;
  turns?: number;
  remainingSeconds?: number;
};
export type WorldItem = EquipmentItem & {
  weaponMetadata?: Pick<EquipmentItem, 'contentWeapon'>;
  itemMetadata?: Pick<EquipmentItem, 'contentWeapon'>;
  bladeMetadata?: Pick<EquipmentItem, 'contentWeapon'>;
};
export type WorldLoot = WorldPoint & WorldItem & { id?: string; items?: readonly WorldItem[] };
export type WorldCannon = WorldPoint & {
  id: string;
  type: string;
  side?: string;
  facing?: number;
  loaded?: boolean;
  reloadProgress?: number;
  profile?: { name?: string; crew?: number };
};
export type WorldSmoke = WorldPoint & {
  id?: string;
  radius?: number;
  turns?: number;
  remainingSeconds?: number;
};
export type WorldTerrain = {
  width: number;
  height: number;
  tiles: readonly WorldTile[];
  wallEdges?: readonly WorldTile[];
  upperSurfaces?: readonly WorldTile[];
  buildings?: readonly WorldBuilding[];
  props?: readonly WorldProp[];
  lights?: readonly WorldLight[];
  climbLinks?: readonly {
    id: string;
    kind: string;
    from: WorldPoint;
    to: WorldPoint;
  }[];
  night?: boolean;
  sectorId?: string;
  sceneId?: string;
  landscape?: string;
};
export type WorldInput = {
  terrain: WorldTerrain;
  revealedRooms?: ReadonlySet<string> | readonly string[];
  cursorLevel?: number;
  admittedActorPoints?: readonly WorldPoint[];
  loot?: readonly WorldLoot[];
  cannons?: readonly WorldCannon[];
  smoke?: readonly WorldSmoke[];
  /** Existing tileIllumination results, keyed by level:x,y. */
  illumination?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
  timeSeconds?: number;
  reducedMotion?: boolean;
};
export type WorldOptions = {
  tileMetres: number;
  assetUrl: (path: string) => string;
  onAssetError?: (error: Error) => void;
  equipment?: Promise<Pick<LoadedActor, 'manifest' | 'equipment'>>;
};
export type WorldInspection = {
  objects: number;
  meshes: number;
  triangles: number;
  chunks: number;
  semanticIds: readonly string[];
  pendingTextures: number;
  pendingModels: number;
  assetErrors: readonly string[];
  disposed: boolean;
};
export type SectorWorld = {
  update: (input: WorldInput) => void;
  updateActors: (points: readonly WorldPoint[]) => void;
  tick: (deltaSeconds: number, timeSeconds: number) => void;
  dispose: () => void;
  inspect: () => WorldInspection;
  anchor: (id: string, role: string) => Vector3 | null;
};
export type WorldNode = {
  id: string;
  signature: string;
  object: Group;
  anchors?: Map<string, Object3D>;
};
