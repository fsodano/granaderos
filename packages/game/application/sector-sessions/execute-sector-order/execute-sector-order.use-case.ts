import type { SectorOrder } from '../../../domain/sector-sessions/sector-operation.ts';
import type { SectorOperationState, SectorOperationRunner } from '../sector-operation-runner.ts';
import type { ExecuteSectorOrderRepository } from './execute-sector-order.repository.ts';
export type ExecuteSectorOrderRequest = Readonly<{ order: SectorOrder }>;
export class ExecuteSectorOrderUseCase<Snapshot extends SectorOperationState> {
  readonly #repository: ExecuteSectorOrderRepository<Snapshot>;
  readonly #createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>;
  readonly #executeOrder: (snapshot: Snapshot, order: SectorOrder) => Snapshot;
  readonly #advanceIdleTime: (snapshot: Snapshot, seconds: number) => void;
  constructor(
    repository: ExecuteSectorOrderRepository<Snapshot>,
    createRunner: (snapshot: Snapshot) => SectorOperationRunner<Snapshot>,
    executeOrder: (snapshot: Snapshot, order: SectorOrder) => Snapshot,
    advanceIdleTime: (snapshot: Snapshot, seconds: number) => void,
  ) {
    this.#repository = repository;
    this.#createRunner = createRunner;
    this.#executeOrder = executeOrder;
    this.#advanceIdleTime = advanceIdleTime;
  }
  execute(request: ExecuteSectorOrderRequest): Snapshot {
    const loaded = this.#repository.loadSectorOrder();
    const result = this.#createRunner(loaded.snapshot).execute(
      (snapshot) => this.#executeOrder(snapshot, request.order),
      this.#advanceIdleTime,
    );
    this.#repository.commitSectorOrder(result, loaded.revision);
    return result;
  }
}
