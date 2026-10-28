export const FirearmAccuracyRules = Object.freeze({
  MinimumChance: 1,
  MaximumChance: 95,
  MaximumAim: 4,
  AimBonus: 8,
  StandingSupport: 0,
  CrouchedSupport: 5,
  ProneSupport: 10,
  RepeatTargetBonus: 10,
  TacticalCommandBonus: 8,
  StrategicCommandBonus: 12,
  PosturePenaltyStartRange: 5,
  PosturePenaltyPerCell: 3,
  ProneTargetPenalty: 40,
  CrouchedTargetPenalty: 20,
  EnergyPenalty: 0.15,
  NormalMorale: 80,
  MoraleAdjustment: 0.1,
  MountedLongarmPenalty: 15,
  CoveredAttackerBonus: 10,
  CoveredTargetPenalty: 12,
});
export type FirearmAccuracyContext = Readonly<{
  skill: number;
  condition: number;
  distance: number;
  aim: number;
  attackerStance: string;
  attackerMounted: boolean;
  targetStance: string;
  targetMounted: boolean;
  repeatedTarget: boolean;
  strategicCommand: boolean;
  tacticalCommand: boolean;
  wounds: number;
  energy: number;
  shock: number;
  morale: number;
  weaponSuitedToMountedUse: boolean;
  coveredAttacker: boolean;
  coveredTarget: boolean;
  pairPenalty: number;
  bodyRegionPenalty: number;
  sightAdjustment: number;
  weaponRangePenalty: number;
  rangeChanceFactor: number;
}>;
export class FirearmAccuracy {
  readonly #woundPenalty: number;
  readonly #shockPenalty: number;
  constructor(balance: { woundPenalty: number; shockPenalty: number }) {
    this.#woundPenalty = balance.woundPenalty;
    this.#shockPenalty = balance.shockPenalty;
  }
  chance(context: FirearmAccuracyContext): number {
    const rules = FirearmAccuracyRules;
    const skill =
      context.condition < context.skill ? (context.skill + context.condition) / 2 : context.skill;
    const targetPosture = context.targetMounted
      ? 0
      : Math.min(
          Math.max(0, context.distance - rules.PosturePenaltyStartRange) *
            rules.PosturePenaltyPerCell,
          context.targetStance === 'prone'
            ? rules.ProneTargetPenalty
            : context.targetStance === 'crouched'
              ? rules.CrouchedTargetPenalty
              : 0,
        );
    const support = context.attackerMounted
      ? 0
      : context.attackerStance === 'prone'
        ? rules.ProneSupport
        : context.attackerStance === 'crouched'
          ? rules.CrouchedSupport
          : rules.StandingSupport;
    const aim = Math.max(
      0,
      Math.min(rules.MaximumAim, Number.isFinite(context.aim) ? Math.floor(context.aim) : 0),
    );
    const chance =
      skill +
      support +
      (context.repeatedTarget ? rules.RepeatTargetBonus : 0) +
      (context.strategicCommand ? rules.StrategicCommandBonus : 0) +
      (context.tacticalCommand ? rules.TacticalCommandBonus : 0) +
      aim * rules.AimBonus +
      context.sightAdjustment -
      context.weaponRangePenalty -
      context.wounds * this.#woundPenalty -
      (100 - context.energy) * rules.EnergyPenalty -
      context.shock * this.#shockPenalty +
      (context.morale - rules.NormalMorale) * rules.MoraleAdjustment -
      targetPosture -
      (context.attackerMounted && !context.weaponSuitedToMountedUse
        ? rules.MountedLongarmPenalty
        : 0) +
      (context.coveredAttacker ? rules.CoveredAttackerBonus : 0) -
      (context.coveredTarget ? rules.CoveredTargetPenalty : 0);
    return Math.round(
      Math.max(
        rules.MinimumChance,
        Math.min(
          rules.MaximumChance,
          (chance - context.pairPenalty - context.bodyRegionPenalty) * context.rangeChanceFactor,
        ),
      ),
    );
  }
}
