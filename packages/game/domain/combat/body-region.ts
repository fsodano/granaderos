export const BodyRegionId = Object.freeze({ Torso: 'torso', Head: 'head', Legs: 'legs' } as const);
export type BodyRegionIdValue = (typeof BodyRegionId)[keyof typeof BodyRegionId];
export type BodyRegionProfile = Readonly<{
  id: BodyRegionIdValue;
  chancePenaltyPerTile: number;
  damageMultiplier: number;
  breathMultiplier: number;
  balanceMultiplier: number;
}>;
export type BodyImpact = Readonly<{
  damage: number;
  breathLoss: number;
  balanceLoss: number;
  knockedDown: boolean;
  unhorse: boolean;
}>;
export const KnockdownBalanceThreshold = 20;
const profiles: Readonly<Record<BodyRegionIdValue, BodyRegionProfile>> = Object.freeze({
  torso: Object.freeze({
    id: 'torso',
    chancePenaltyPerTile: 0,
    damageMultiplier: 1,
    breathMultiplier: 0.5,
    balanceMultiplier: 0,
  }),
  head: Object.freeze({
    id: 'head',
    chancePenaltyPerTile: 3,
    damageMultiplier: 1.5,
    breathMultiplier: 0.5,
    balanceMultiplier: 0,
  }),
  legs: Object.freeze({
    id: 'legs',
    chancePenaltyPerTile: 1,
    damageMultiplier: 0.65,
    breathMultiplier: 1.2,
    balanceMultiplier: 0.5,
  }),
});
export class BodyRegion {
  readonly #profile: BodyRegionProfile;
  private constructor(profile: BodyRegionProfile) {
    this.#profile = profile;
  }
  static named(id: BodyRegionIdValue): BodyRegion {
    if (!Object.hasOwn(profiles, id)) {
      throw new RangeError('invalid-body-region');
    }
    return new BodyRegion(profiles[id]);
  }
  profile(): BodyRegionProfile {
    return { ...this.#profile };
  }
  aimingPenalty(range: number): number {
    if (!Number.isFinite(range) || range < 0) {
      throw new RangeError('invalid-aiming-range');
    }
    return Math.round(range * this.#profile.chancePenaltyPerTile);
  }
  impact(
    baseDamage: number,
    target: { health?: number; stance?: string; mounted?: boolean } = {},
  ): BodyImpact {
    if (
      !Number.isFinite(baseDamage) ||
      baseDamage < 0 ||
      (target.health !== undefined && (!Number.isFinite(target.health) || target.health < 0))
    ) {
      throw new RangeError('invalid-impact-damage');
    }
    const health = target.health ?? Infinity,
      damage = Math.round(baseDamage * this.#profile.damageMultiplier);
    if (!Number.isFinite(damage)) {
      throw new RangeError('invalid-impact-damage');
    }
    const actualDamage = Math.min(health, damage),
      breathLoss = Math.ceil(actualDamage * this.#profile.breathMultiplier);
    const balanceLoss =
      actualDamage > 0 ? Math.round(baseDamage * this.#profile.balanceMultiplier) : 0;
    const knockedDown =
      health > damage && balanceLoss >= KnockdownBalanceThreshold && target.stance !== 'prone';
    return {
      damage,
      breathLoss,
      balanceLoss,
      knockedDown,
      unhorse: knockedDown && Boolean(target.mounted),
    };
  }
}
