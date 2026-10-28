import type { SectorOperationState } from '../sector-operation-runner.ts';
export interface ExecuteSectorOrderRepository<Snapshot extends SectorOperationState> {
  loadSectorOrder(): Readonly<{ snapshot: Snapshot; revision: number }>;
  commitSectorOrder(snapshot: Snapshot, expectedRevision: number): void;
}
