import type { BattleBuilding, BattleRoom, BattleTile } from './compatibility-types.ts';
/** Read models for building presentation. Dimensions use scene pixels and map tiles. */
export interface BuildingProfile {
  wallHeight: number;
  roofRise: number;
  roofShape: 'hip' | 'gable' | 'shed';
  eave: number;
  plinthHeight: number;
  groundFloorHeight: number;
  floors: number;
}

export interface BuildingFinish {
  wallFinish: string;
  roofFinish: string;
  doorStyle: string;
  windowStyle: string;
}

export type BuildingRoomReadModel = Omit<BattleRoom, 'cells'> & {
  cells: readonly BattleRoom['cells'][number][];
};
export type BuildingReadModel = Omit<BattleBuilding, 'rooms' | 'walls'> & {
  rooms?: readonly BuildingRoomReadModel[];
  walls?: readonly BattleTile[];
};

export interface BuildingOpening {
  id?: string;
  doorId?: string;
  x: number;
  y: number;
  axis?: 'x' | 'y';
  open?: boolean;
  locked?: boolean;
  style?: string;
}
export interface BuildingAuthoringInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  doors?: readonly BuildingOpening[];
  windows?: readonly BuildingOpening[];
  material?: string;
  architecture?: string;
  roof?: string;
}
export interface BuildingAuthoringResult {
  tiles: BattleTile[];
  building: import('../../campaign-format/types.ts').MapBuilding;
  wallEdges: import('../../campaign-format/types.ts').MapWall[];
}
export interface TerraceAuthoringOptions {
  elevation?: number;
  tacticalLevel?: number;
  slabThickness?: number;
  climbPoints?: {
    id: string;
    from: import('./compatibility-types.ts').TacticalPoint;
    to: import('./compatibility-types.ts').TacticalPoint;
  }[];
}
