import { FirearmRefusal, FirearmRefusalCode } from './firearm.ts';
export const ReloadRules = Object.freeze({
  CompletionTolerance: 1e-9,
  ProneMultiplier: 1.5,
  AssistedMultiplier: 0.8,
  TrainedMultiplier: 0.85,
});
export type ReloadPlan = Readonly<{
  pa: number;
  totalPA: number;
  rounds: number;
  available: number;
  progress: number;
  partial: boolean;
  remainingPA: number;
}>;
export class ReloadWork {
  readonly #loaded: number;
  readonly #reserve: number;
  readonly #capacity: number;
  readonly #progress: number;
  readonly #roundCost: number;
  constructor({
    loaded,
    reserve,
    capacity,
    progress = 0,
    roundCost,
  }: {
    loaded: number;
    reserve: number;
    capacity: number;
    progress?: number;
    roundCost: number;
  }) {
    if (
      ![loaded, reserve, capacity].every(Number.isSafeInteger) ||
      loaded < 0 ||
      reserve < 0 ||
      capacity < 0 ||
      loaded > capacity ||
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress >= 1 ||
      (progress > 0 && loaded === capacity) ||
      !Number.isFinite(roundCost) ||
      roundCost < 0
    )
      throw new FirearmRefusal(FirearmRefusalCode.InvalidWork);
    this.#loaded = loaded;
    this.#reserve = reserve;
    this.#capacity = capacity;
    this.#progress = progress;
    this.#roundCost = roundCost;
  }
  plan(budget: number): ReloadPlan {
    if (budget !== Infinity && (!Number.isFinite(budget) || budget < 0))
      throw new FirearmRefusal(FirearmRefusalCode.InvalidWork);
    const available = Math.max(0, Math.min(this.#capacity - this.#loaded, this.#reserve));
    if (!available || this.#roundCost === 0)
      return {
        pa: 0,
        totalPA: 0,
        rounds: 0,
        available: 0,
        progress: this.#progress,
        partial: false,
        remainingPA: 0,
      };
    const totalPA = Math.ceil(
      (available - this.#progress) * this.#roundCost - ReloadRules.CompletionTolerance,
    );
    const pa = Math.min(totalPA, budget);
    const work = pa >= totalPA ? available : this.#progress + pa / this.#roundCost;
    const rounds = Math.min(available, Math.floor(work + ReloadRules.CompletionTolerance));
    const progress = rounds === available ? 0 : Math.max(0, work - rounds);
    return {
      pa,
      totalPA,
      rounds,
      available,
      progress,
      partial: pa < totalPA,
      remainingPA: Math.ceil(
        (available - rounds - progress) * this.#roundCost - ReloadRules.CompletionTolerance,
      ),
    };
  }
}
