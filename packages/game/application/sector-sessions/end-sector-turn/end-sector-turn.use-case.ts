import type { SectorOperationState, SectorOperationRunner } from '../sector-operation-runner.ts';
import type { EndSectorTurnRepository } from './end-sector-turn.repository.ts';
export class EndSectorTurnUseCase<Snapshot extends SectorOperationState> {
  readonly #repository: EndSectorTurnRepository<Snapshot>;
  readonly #createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>;
  readonly #endTurn: (snapshot: Snapshot) => Snapshot;
  readonly #advanceIdleTime: (snapshot: Snapshot, seconds: number) => void;
  constructor(
    repository: EndSectorTurnRepository<Snapshot>,
    createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>,
    endTurn: (snapshot: Snapshot) => Snapshot,
    advanceIdleTime: (snapshot: Snapshot, seconds: number) => void,
  ) {
    this.#repository = repository;
    this.#createRunner = createRunner;
    this.#endTurn = endTurn;
    this.#advanceIdleTime = advanceIdleTime;
  }
  execute(): Snapshot {
    const loaded = this.#repository.loadSectorTurn();
    const result = this.#createRunner(loaded.snapshot).execute(
      this.#endTurn,
      this.#advanceIdleTime,
    );
    this.#repository.commitSectorTurn(result, loaded.revision);
    return result;
  }
}
