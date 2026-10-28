import type { SectorOperationState } from '../sector-operation-runner.ts';
export interface ResumeSectorOperationRepository<Snapshot extends SectorOperationState> {
  loadSectorOperation(): Readonly<{ snapshot: Snapshot; revision: number }>;
  commitSectorOperation(snapshot: Snapshot, expectedRevision: number): void;
}
