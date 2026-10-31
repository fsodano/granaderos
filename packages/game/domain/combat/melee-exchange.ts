import type { SectorParticipant } from '../sector-sessions/sector-participant.ts';
export const MeleeRules = Object.freeze({
  ParryCost: 6,
  ParriedDamageFactor: 0.75,
  ProtectionDamageFactor: 0.8,
  CounterDamageFactor: 0.5,
  SabreBleeding: 3,
  LanceBalanceLoss: 20,
  BayonetBraceCost: 16,
  BodyguardCost: 8,
  BodyguardMinimumHealth: 25,
  CompanionDeathMoraleLoss: 18,
});
export class MeleeExchange {
  readonly #baseDamage: number;
  #counterResolved = false;
  constructor(baseDamage: number) {
    if (!Number.isFinite(baseDamage) || baseDamage < 0) {
      throw new RangeError('invalid-melee-damage');
    }
    this.#baseDamage = baseDamage;
  }
  defend(
    defender: SectorParticipant,
    {
      canParry,
      alreadyParried,
      protectedFromBlow,
    }: { canParry: boolean; alreadyParried: boolean; protectedFromBlow: boolean },
  ): Readonly<{ damage: number; parried: boolean }> {
    const parried = canParry && !alreadyParried && defender.canSpend(MeleeRules.ParryCost);
    if (parried) {
      defender.spend(MeleeRules.ParryCost);
    }
    return {
      damage:
        this.#baseDamage *
        (parried ? MeleeRules.ParriedDamageFactor : 1) *
        (protectedFromBlow ? MeleeRules.ProtectionDamageFactor : 1),
      parried,
    };
  }
  counterattack(
    defender: SectorParticipant,
    context: {
      enabled: boolean;
      defenderCapable: boolean;
      attackerCapable: boolean;
      usableWeapon: boolean;
      upright: boolean;
      trained: boolean;
      alreadyCountered: boolean;
      withinReach: boolean;
      cost: number;
      damage: number;
    },
  ): Readonly<{ damage: number }> | null {
    if (
      this.#counterResolved ||
      !context.enabled ||
      !context.defenderCapable ||
      !context.attackerCapable ||
      !context.usableWeapon ||
      !context.upright ||
      !context.trained ||
      context.alreadyCountered ||
      !context.withinReach ||
      !defender.canSpend(context.cost)
    ) {
      return null;
    }
    defender.spend(context.cost);
    this.#counterResolved = true;
    return { damage: context.damage * MeleeRules.CounterDamageFactor };
  }
}
