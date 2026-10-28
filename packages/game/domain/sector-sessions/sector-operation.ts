import { SectorTimeBudget } from './sector-time-budget.ts';
import type { SectorClockSnapshot } from './sector-time-budget.ts';

export const SectorOperationKind = Object.freeze({
  Order: 'order',
  EndTurn: 'endTurn',
  Continue: 'continue',
} as const);
export type SectorOrder = Readonly<{
  type: string;
  unitId?: string | number;
  [parameter: string]: unknown;
}>;
export type SectorOperationIntent = Readonly<{
  kind: (typeof SectorOperationKind)[keyof typeof SectorOperationKind];
  order?: SectorOrder;
  remainingRestSeconds?: number;
}>;
export type PendingSectorOperation = SectorOperationIntent &
  Readonly<{ interruptedAtSecond: number }>;

export class SectorOperation<Snapshot extends SectorClockSnapshot> {
  #accepted: Snapshot;
  #intent: SectorOperationIntent;
  readonly #startedAtSecond: number;
  readonly #restSeconds: number | undefined;

  constructor(snapshot: Snapshot, intent: SectorOperationIntent) {
    this.#accepted = structuredClone(snapshot);
    this.#intent = structuredClone(intent);
    this.#startedAtSecond = (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0);
    this.#restSeconds = intent.remainingRestSeconds;
  }

  accept(snapshot: Snapshot): void {
    const previousSecond =
      (this.#accepted.startSeconds ?? 0) + (this.#accepted.elapsedSeconds ?? 0);
    const nextSecond = (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0);
    if (nextSecond < previousSecond) throw new RangeError('sector-operation-time-reversed');
    SectorTimeBudget.restore(this.#accepted).assertCanAdvance(nextSecond - previousSecond);
    this.#accepted = structuredClone(snapshot);
  }

  continueAutonomously(snapshot: Snapshot): void {
    this.accept(snapshot);
    this.#intent = { kind: SectorOperationKind.Continue };
  }

  acceptedSnapshot(): Snapshot {
    return structuredClone(this.#accepted);
  }

  remainingRestSeconds(snapshot: Snapshot): number | undefined {
    if (this.#restSeconds === undefined) return undefined;
    const elapsed =
      (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0) - this.#startedAtSecond;
    return Math.max(0, this.#restSeconds - elapsed);
  }

  continuation(snapshot: Snapshot): PendingSectorOperation {
    const rest = this.remainingRestSeconds(snapshot);
    return {
      ...structuredClone(this.#intent),
      ...(rest === undefined ? {} : { remainingRestSeconds: rest }),
      interruptedAtSecond: (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0),
    };
  }
}
