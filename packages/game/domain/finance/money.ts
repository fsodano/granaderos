import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export const EconomyLimits = Object.freeze({ maximumTreasury: 1_000_000_000 });

export class Money {
  readonly #pesos: number;

  private constructor(pesos: number) {
    if (!Number.isSafeInteger(pesos) || pesos < 0 || pesos > EconomyLimits.maximumTreasury) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#pesos = pesos;
  }

  static pesos(amount: number): Money {
    return new Money(amount);
  }
  get pesos(): number {
    return this.#pesos;
  }

  plus(other: Money): Money {
    return new Money(this.#pesos + other.#pesos);
  }
  covers(other: Money): boolean {
    return this.#pesos >= other.#pesos;
  }

  minus(other: Money): Money {
    if (!this.covers(other)) throw new DomainRefusal(DomainRefusalCode.InsufficientFunds);
    return new Money(this.#pesos - other.#pesos);
  }
}
