import type {
  MapObject,
  MapBuilding,
  MapUpperSurface,
  MapClimbLink,
  PhysicalMap,
} from '../../../packages/campaign-format/types.ts';
import type { CampaignEditorRefusalSnapshot } from './campaign-editor-refusal.ts';
export type MapPoint = Readonly<{ x: number; y: number }>;
export type MapWallAxis = 'x' | 'y';
export type MapObjectLayer = 'features' | 'props' | 'items' | 'spawns' | 'exits' | 'lights';
export type MapTerrain = 'grass' | 'road' | 'stone' | 'mud' | 'water' | 'forest' | 'scrub';

export type MapBuildingInput = MapPoint &
  Readonly<{
    id: string;
    width?: number;
    height?: number;
    name?: string;
    material?: string;
    kind?: string;
    architecture?: string;
    roof?: string;
    wallFinish?: string;
    roofFinish?: string;
    doorStyle?: string;
    windowStyle?: string;
  }>;

export type MapObjectInput = Readonly<MapObject>;
export type MapObjectValues = {
  [Key in keyof MapObject | keyof MapBuilding]?:
    | (Key extends keyof MapObject
        ? MapObject[Key]
        : Key extends keyof MapBuilding
          ? MapBuilding[Key]
          : never)
    | null;
};
export type MapBuildingTemplate = {
  version: 1;
  name: string;
  building: MapBuilding;
  upperSurfaces?: MapUpperSurface[];
  climbLinks?: MapClimbLink[];
  features: MapObject[];
  props: MapObject[];
  items: MapObject[];
  spawns: MapObject[];
  exits: MapObject[];
  lights: MapObject[];
};
export type MapLayer = MapObjectLayer | 'buildings';
export type MapSelection =
  | (MapObject & { layer: MapObjectLayer })
  | (MapBuilding & { layer: 'buildings' });
export type SectorMapHistorySnapshot = {
  document: PhysicalMap;
  past: PhysicalMap[];
  future: PhysicalMap[];
  errors: string[];
  refusal?: CampaignEditorRefusalSnapshot;
};
export type SectorMapEditResult = {
  document: PhysicalMap;
  errors: string[];
  warnings: string[];
  refusal?: CampaignEditorRefusalSnapshot;
};

export type SectorMapCommand =
  | Readonly<{
      type: 'transformSelection';
      ids: readonly string[];
      dx?: number;
      dy?: number;
      rotate?: boolean;
    }>
  | Readonly<{ type: 'paintTerrain'; terrain: MapTerrain; cells: readonly MapPoint[] }>
  | Readonly<{ type: 'addBuilding'; building: MapBuildingInput }>
  | Readonly<{ type: 'addObject'; layer: MapObjectLayer; object: MapObjectInput }>
  | Readonly<{ type: 'moveObject'; id: string; x: number; y: number }>
  | Readonly<{ type: 'rotateObject'; id: string }>
  | Readonly<{ type: 'deleteObject'; id: string }>
  | Readonly<{ type: 'setObject'; id: string; values: MapObjectValues }>
  | Readonly<{ type: 'setMetadata'; values: Partial<PhysicalMap['metadata']> }>
  | Readonly<{ type: 'setDoor'; id: string; open?: boolean; locked?: boolean }>
  | Readonly<{
      type: 'setOpeningStyle';
      buildingId: string;
      x: number;
      y: number;
      axis?: MapWallAxis;
      style: string | null;
    }>
  | Readonly<{
      type: 'setWall';
      buildingId: string;
      x: number;
      y: number;
      axis?: MapWallAxis;
      wallType: 'wall' | 'door' | 'window' | 'floor';
      doorId?: string;
      style?: string;
    }>
  | Readonly<{ type: 'resizeBuilding'; id: string; width: number; height: number }>
  | Readonly<{ type: 'duplicateObject'; id: string; newId: string; x: number; y: number }>
  | Readonly<{
      type: 'stampTemplate';
      id: string;
      x: number;
      y: number;
      template: MapBuildingTemplate;
    }>;
