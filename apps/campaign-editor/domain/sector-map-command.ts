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

export type MapObjectInput = MapPoint & Readonly<{ id: string; [field: string]: unknown }>;
export type MapObjectValues = Readonly<Record<string, unknown>>;
export type MapBuildingTemplate = Readonly<{
  version: 1;
  building: MapBuildingInput & {
    width: number;
    height: number;
    walls: readonly MapObjectInput[];
    rooms: readonly Readonly<{ id: string; cells: readonly MapPoint[] }>[];
  };
  [layer: string]: unknown;
}>;

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
  | Readonly<{ type: 'setMetadata'; values: MapObjectValues }>
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
