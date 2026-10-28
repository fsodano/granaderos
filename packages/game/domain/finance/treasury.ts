import { Money } from './money.ts';

export class Treasury {
  #balance: Money;

  constructor(balance: Money) {
    this.#balance = balance;
  }
  get balance(): Money {
    return this.#balance;
  }
  canPay(amount: Money): boolean {
    return this.#balance.covers(amount);
  }
  pay(amount: Money): void {
    this.#balance = this.#balance.minus(amount);
  }
  receive(amount: Money): void {
    this.#balance = this.#balance.plus(amount);
  }
}
