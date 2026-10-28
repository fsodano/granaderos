import type { SectorOperationState, SectorOperationRunner } from '../sector-operation-runner.ts';
import type { ResumeSectorOperationRepository } from './resume-sector-operation.repository.ts';
export class ResumeSectorOperationUseCase<Snapshot extends SectorOperationState> {
  readonly #repository: ResumeSectorOperationRepository<Snapshot>;
  readonly #createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>;
  readonly #resume: (snapshot: Snapshot) => Snapshot;
  readonly #advanceIdleTime: (snapshot: Snapshot, seconds: number) => void;
  constructor(
    repository: ResumeSectorOperationRepository<Snapshot>,
    createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>,
    resume: (snapshot: Snapshot) => Snapshot,
    advanceIdleTime: (snapshot: Snapshot, seconds: number) => void,
  ) {
    this.#repository = repository;
    this.#createRunner = createRunner;
    this.#resume = resume;
    this.#advanceIdleTime = advanceIdleTime;
  }
  execute(): Snapshot {
    const loaded = this.#repository.loadSectorOperation();
    const result = this.#createRunner(loaded.snapshot).execute(this.#resume, this.#advanceIdleTime);
    this.#repository.commitSectorOperation(result, loaded.revision);
    return result;
  }
}
