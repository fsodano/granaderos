import type { BattleSnapshot } from './compatibility-types.ts';

export type SceneTerrain = Pick<
  BattleSnapshot,
  'width' | 'height' | 'tiles' | 'buildings' | 'props' | 'night' | 'sectorId'
> & {
  wallEdges: BattleSnapshot['wallEdges'];
  upperSurfaces: BattleSnapshot['upperSurfaces'];
  lights: BattleSnapshot['lights'];
  sceneId: BattleSnapshot['sceneId'];
};
