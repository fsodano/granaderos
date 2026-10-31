import { SectorOperation } from '../../domain/sector-sessions/sector-operation.ts';
import type {
  SectorOperationIntent,
  PendingSectorOperation,
} from '../../domain/sector-sessions/sector-operation.ts';
import { SectorTimeBudget } from '../../domain/sector-sessions/sector-time-budget.ts';
import type { SectorClockSnapshot } from '../../domain/sector-sessions/sector-time-budget.ts';
import { SectorTimeLimitReached } from '../../domain/sector-sessions/sector-time-limit-reached.ts';

export type SectorOperationState = SectorClockSnapshot & {
  pendingSectorOperation?: PendingSectorOperation;
  lastError?: string | null;
};
export interface SectorOperationEffects {
  checkpoint(): unknown;
  restore(checkpoint: unknown): void;
}
export class SectorOperationRunner<Snapshot extends SectorOperationState> {
  readonly #operation: SectorOperation<Snapshot>;
  readonly #effects: SectorOperationEffects;
  #effectsCheckpoint: unknown;

  constructor(snapshot: Snapshot, intent: SectorOperationIntent, effects: SectorOperationEffects) {
    this.#operation = new SectorOperation(snapshot, intent);
    this.#effects = effects;
    this.#effectsCheckpoint = effects.checkpoint();
  }

  checkpoint(snapshot: Snapshot): void {
    this.#operation.accept(snapshot);
    this.#effectsCheckpoint = this.#effects.checkpoint();
  }

  completeOrder(snapshot: Snapshot): void {
    this.#operation.continueAutonomously(snapshot);
    this.#effectsCheckpoint = this.#effects.checkpoint();
  }

  remainingRestSeconds(snapshot: Snapshot): number | undefined {
    return this.#operation.remainingRestSeconds(snapshot);
  }

  execute(
    execute: (snapshot: Snapshot) => Snapshot,
    advanceIdleTime: (snapshot: Snapshot, seconds: number) => void,
  ): Snapshot {
    const snapshot = this.#operation.acceptedSnapshot();
    delete snapshot.pendingSectorOperation;
    try {
      SectorTimeBudget.restore(snapshot).assertCanStartOperation();
      return execute(snapshot);
    } catch (error) {
      if (!(error instanceof SectorTimeLimitReached)) {
        throw error;
      }
      const accepted = this.#operation.acceptedSnapshot();
      this.#effects.restore(this.#effectsCheckpoint);
      const remainingSeconds = SectorTimeBudget.restore(accepted).remainingSeconds;
      if (remainingSeconds > 0) {
        advanceIdleTime(accepted, remainingSeconds);
      }
      accepted.pendingSectorOperation = this.#operation.continuation(accepted);
      accepted.lastError = null;
      return accepted;
    }
  }
}
