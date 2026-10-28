import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export const HealthRules = Object.freeze({
  BleedingIntervalSeconds: 6,
  CriticalHealth: 15,
  MaximumCombatBleeding: 10,
});

export type HealthSnapshot = Readonly<{
  current: number;
  maximum: number;
  bleeding: number;
  bandaged: number;
}>;

export type BleedingResult = Readonly<{
  healthLost: number;
  died: boolean;
  deathAfterTicks: number | null;
}>;

export class Health {
  #current: number;
  readonly #maximum: number;
  #bleeding: number;
  #bandaged: number;

  constructor(snapshot: HealthSnapshot) {
    if (
      ![snapshot.current, snapshot.maximum, snapshot.bleeding, snapshot.bandaged].every(
        Number.isFinite,
      ) ||
      snapshot.maximum <= 0 ||
      snapshot.current < 0 ||
      snapshot.current > snapshot.maximum ||
      snapshot.bleeding < 0 ||
      snapshot.bandaged < 0 ||
      snapshot.bandaged > snapshot.maximum - snapshot.current ||
      (snapshot.current === 0 && snapshot.bleeding !== 0)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#current = snapshot.current;
    this.#maximum = snapshot.maximum;
    this.#bleeding = snapshot.bleeding;
    this.#bandaged = snapshot.bandaged;
  }

  get alive(): boolean {
    return this.#current > 0;
  }
  get criticallyWounded(): boolean {
    return this.alive && this.#current < HealthRules.CriticalHealth;
  }

  sufferInjury(
    amount: number,
    addedBleeding: number,
    maximumBleeding = HealthRules.MaximumCombatBleeding,
  ): Readonly<{ healthLost: number; died: boolean }> {
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isFinite(addedBleeding) ||
      addedBleeding < 0 ||
      !Number.isFinite(maximumBleeding) ||
      maximumBleeding < 0
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const wasAlive = this.alive;
    const healthLost = Math.min(this.#current, amount);
    this.#current -= healthLost;
    this.#bandaged = Math.min(this.#bandaged, this.#maximum - this.#current);
    this.#bleeding = this.alive ? Math.min(maximumBleeding, this.#bleeding + addedBleeding) : 0;
    return { healthLost, died: wasAlive && !this.alive };
  }

  advanceBleeding(ticks: number): BleedingResult {
    if (!Number.isSafeInteger(ticks) || ticks < 0)
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    const before = this.#current;
    const deathAfterTicks =
      this.#bleeding > 0 && this.alive ? Math.ceil(before / this.#bleeding) : null;
    const healthLost = Math.min(before, this.#bleeding * ticks);
    this.#current -= healthLost;
    this.#bandaged = Math.min(this.#bandaged, this.#maximum - this.#current);
    if (!this.alive) this.#bleeding = 0;
    const died = before > 0 && !this.alive;
    return { healthLost, died, deathAfterTicks: died ? deathAfterTicks : null };
  }

  toSnapshot(): HealthSnapshot {
    return {
      current: this.#current,
      maximum: this.#maximum,
      bleeding: this.#bleeding,
      bandaged: this.#bandaged,
    };
  }
}
