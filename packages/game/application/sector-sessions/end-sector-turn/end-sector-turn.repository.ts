import type { SectorOperationState } from '../sector-operation-runner.ts';
export interface EndSectorTurnRepository<Snapshot extends SectorOperationState> {
  loadSectorTurn(): Readonly<{ snapshot: Snapshot; revision: number }>;
  commitSectorTurn(snapshot: Snapshot, expectedRevision: number): void;
}
