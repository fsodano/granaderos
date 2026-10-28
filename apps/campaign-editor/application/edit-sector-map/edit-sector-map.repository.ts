import type { SectorMap } from '../../domain/sector-map.js';

export interface EditSectorMapRepository {
  load(identifier: string): SectorMap;
  commit(map: SectorMap, expectedRevision: number): void;
}
