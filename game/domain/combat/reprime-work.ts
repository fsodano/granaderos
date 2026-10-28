export const ReprimeRules = Object.freeze({ NormalCost: 15, TrainedCost: 10 });
export type FirearmHand = 'primary' | 'offhand';
export class ReprimeWork {
  readonly #required: readonly FirearmHand[];
  readonly #cost: number;
  constructor(required: readonly FirearmHand[], trained: boolean) {
    this.#required = [...required];
    this.#cost = trained ? ReprimeRules.TrainedCost : ReprimeRules.NormalCost;
  }
  get cost(): number {
    return this.#cost;
  }
  plan(budget: number): Readonly<{
    hands: readonly FirearmHand[];
    required: number;
    pending: number;
    pa: number;
    totalPA: number;
    cost: number;
  }> {
    const count = Math.min(this.#required.length, Math.floor(Math.max(0, budget) / this.#cost));
    const hands = this.#required.slice(0, count);
    return {
      hands,
      required: this.#required.length,
      pending: this.#required.length - hands.length,
      pa: hands.length * this.#cost,
      totalPA: this.#required.length * this.#cost,
      cost: this.#cost,
    };
  }
}
