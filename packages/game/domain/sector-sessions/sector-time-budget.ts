import { SectorTimeLimitReached } from './sector-time-limit-reached.ts';

export type SectorClockSnapshot = Readonly<{
  startSeconds?: number;
  elapsedSeconds?: number;
  worldTimeLimitSecond?: number;
}>;

export class SectorTimeBudget {
  readonly #currentSecond: number;
  readonly #limitSecond: number;

  private constructor(currentSecond: number, limitSecond: number) {
    if (
      !Number.isSafeInteger(currentSecond) ||
      currentSecond < 0 ||
      (limitSecond !== Infinity && (!Number.isSafeInteger(limitSecond) || limitSecond < 0))
    ) {
      throw new RangeError('invalid-sector-time-budget');
    }
    this.#currentSecond = currentSecond;
    this.#limitSecond = limitSecond;
  }

  static restore(clock: SectorClockSnapshot): SectorTimeBudget {
    return new SectorTimeBudget(
      (clock.startSeconds ?? 0) + (clock.elapsedSeconds ?? 0),
      clock.worldTimeLimitSecond ?? Infinity,
    );
  }

  get remainingSeconds(): number {
    return Math.max(0, this.#limitSecond - this.#currentSecond);
  }
  get reached(): boolean {
    return this.remainingSeconds === 0;
  }

  assertCanAdvance(seconds: number): void {
    if (!Number.isSafeInteger(seconds) || seconds < 0) {
      throw new RangeError('invalid-sector-duration');
    }
    if (seconds > this.remainingSeconds) {
      throw new SectorTimeLimitReached(this.#limitSecond, this.remainingSeconds);
    }
  }

  assertCanStartOperation(): void {
    if (this.reached) {
      throw new SectorTimeLimitReached(this.#limitSecond, 0);
    }
  }

  permittedSeconds(requestedSeconds: number): number {
    if (!Number.isSafeInteger(requestedSeconds) || requestedSeconds < 0) {
      throw new RangeError('invalid-sector-duration');
    }
    return Math.min(requestedSeconds, this.remainingSeconds);
  }
}
