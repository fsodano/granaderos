import { Health } from '../personnel/health.ts';
import type { HealthSnapshot } from '../personnel/health.ts';
import type { BodyImpact } from './body-region.ts';
export const CombatInjuryRules = Object.freeze({
  MaximumShock: 20,
  HealthShockDivisor: 10,
  BreathShockDivisor: 20,
  BleedingDamageDivisor: 15,
  MoraleLossPerDamage: 0.45,
});
export type CombatInjuryCondition = Readonly<{
  health: HealthSnapshot;
  energy: number;
  shock: number;
  morale: number;
}>;
export class CombatInjury {
  readonly #impact: BodyImpact;
  readonly #additionalBreathLoss: number;
  constructor(impact: BodyImpact, additionalBreathLoss = 0) {
    if (
      ![impact.damage, impact.breathLoss, impact.balanceLoss, additionalBreathLoss].every(
        (value) => Number.isFinite(value) && value >= 0,
      )
    ) {
      throw new RangeError('invalid-combat-injury');
    }
    this.#impact = { ...impact };
    this.#additionalBreathLoss = additionalBreathLoss;
  }
  inflict(condition: CombatInjuryCondition): Readonly<{
    condition: CombatInjuryCondition;
    healthLost: number;
    died: boolean;
    balanceLoss: number;
    knockedDown: boolean;
  }> {
    const health = new Health(condition.health),
      rules = CombatInjuryRules;
    const injury = health.sufferInjury(
      this.#impact.damage,
      Math.ceil(this.#impact.damage / rules.BleedingDamageDivisor),
    );
    const breathLoss = this.#impact.breathLoss + this.#additionalBreathLoss;
    return {
      condition: {
        health: health.toSnapshot(),
        energy: Math.max(0, condition.energy - breathLoss),
        shock: Math.min(
          rules.MaximumShock,
          condition.shock +
            injury.healthLost / rules.HealthShockDivisor +
            breathLoss / rules.BreathShockDivisor,
        ),
        morale: Math.max(0, condition.morale - this.#impact.damage * rules.MoraleLossPerDamage),
      },
      ...injury,
      balanceLoss: this.#impact.balanceLoss,
      knockedDown: this.#impact.knockedDown,
    };
  }
}
