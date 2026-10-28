import { Money } from '../finance/money.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export type ServicePricingRules = Readonly<{
  salaryMonthDays: number;
  experienceStep: number;
  raisePercent: number;
  priceMultiplier: number;
}>;

export class ServicePricingPolicy {
  readonly #rules: ServicePricingRules;

  constructor(rules: ServicePricingRules) {
    if (
      !Number.isSafeInteger(rules.salaryMonthDays) ||
      rules.salaryMonthDays <= 0 ||
      !Number.isSafeInteger(rules.experienceStep) ||
      rules.experienceStep <= 0 ||
      !Number.isFinite(rules.raisePercent) ||
      rules.raisePercent < 0 ||
      !Number.isFinite(rules.priceMultiplier) ||
      rules.priceMultiplier <= 0
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#rules = Object.freeze({ ...rules });
  }

  dailyPay(monthlyPay: Money, experience: number, minimumDailyPay: Money): Money {
    if (!Number.isSafeInteger(experience) || experience < 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const salaryPercent =
      100 + Math.floor(experience / this.#rules.experienceStep) * this.#rules.raisePercent;
    const amount = Math.ceil(
      (monthlyPay.pesos * this.#rules.priceMultiplier * salaryPercent) /
        (this.#rules.salaryMonthDays * 100),
    );
    return Money.pesos(Math.max(minimumDailyPay.pesos, amount));
  }
}
