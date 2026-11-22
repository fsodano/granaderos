import { hasProjectileEnergy } from './projectile-energy.ts';
import { kineticNominalImpact } from './kinetic-impact.ts';

// A firearm as these rules read it: an energy record may be absent, and the
// impact may omit the reductions a shot did not meet.
export type CombatBalanceWeapon = Readonly<{
  projectileEnergy?: Readonly<{ massGrams: number; muzzleVelocityMps: number }>;
  damage?: number;
}>;

export type FirearmImpact = Readonly<{
  coverDamageFactor?: number;
  damageFactor?: number;
  bodyDamageReduction?: number;
  ricochetDamageReduction?: number;
  airDamageReduction?: number;
  incomingImpact?: number;
}>;

// Edit this file to tune combat. Weapon-specific damage, range and AP live in
// firearm-definitions.js. Both sides use these same settings.
// These are Granaderos playtest settings, not claimed JA2 constants.
export const COMBAT_BALANCE = Object.freeze({
  firearmDamageMultiplier: 1,
  firearmFlightRangeMultiplier: 2, // Physical flight limit; effective aiming range is unchanged.
  shotLoadFlightRangeMultiplier: 3, // Finite pellet travel; keeps a falling tail beyond the shared 2-range onset.
  firearmFarDropIncrement: 0.1, // Beyond 2 effective ranges, slope falls by this / (2*range) per cell; tactical tuning.
  firearmRicochetMaximumNormalDot: 0.3, // Unique exposed vertical stone face; shallow incidence only.
  firearmRicochetForceRetention: 0.5, // Remaining force after reflection, not historical measurements.
  firearmRicochetLimit: 1,
  firearmBodyResistance: Object.freeze({ head: 15, torso: 30, legs: 23 }), // Lead-ball force spent passing through one body.
  firearmBodyPenetrationThreshold: 20,
  firearmBodyPenetrationMaximumChance: 95,
  shotLoadHorizontalSpread: 0.25, // Tangent of lateral pellet spread; explicit game tuning.
  shotLoadVerticalSpread: 0.08,
  rangePenaltyMultiplier: 0.98,
  sightPenaltyMultiplier: 1,
  outsideWeaponChanceFactor: 0.5,
  outsideSightChanceFactor: 0.5,
  woundAPMaximumPenalty: 35,
  energyAPPenaltyPerPoint: 0.25,
  runningExcessEnergyMultiplier: 0.5, // 0 = walking effort; 1 = earlier running effort.
  woundAccuracyPenaltyPerPoint: 0.3,
  shockAccuracyPenaltyPerPoint: 5,
  fireAPMultiplier: 1,
  reloadAPMultiplier: 1,
  coverDamageReductionMultiplier: 1, // 1 preserves current physical cover.
} as const);

export function coveredFirearmDamage(
  amount: number,
  coverFactor = 1,
  coverMultiplier: number = COMBAT_BALANCE.coverDamageReductionMultiplier,
): number {
  const factor = Math.max(0, Math.min(1, 1 - (1 - coverFactor) * coverMultiplier));
  return amount * factor;
}

// Cover tuning cannot return force spent on a body or reflected stone surface.
export function penetratingFirearmDamage(
  amount: number,
  impact: FirearmImpact,
  coverMultiplier: number = COMBAT_BALANCE.coverDamageReductionMultiplier,
  weapon: CombatBalanceWeapon | null = null,
  share = 1,
): number {
  if (weapon !== null && hasProjectileEnergy(weapon)) {
    return (
      (amount / (weapon.damage * share)) *
      kineticNominalImpact(weapon, impact, share, coverMultiplier)
    );
  }
  return Math.max(
    0,
    coveredFirearmDamage(amount, impact.coverDamageFactor ?? impact.damageFactor, coverMultiplier) -
      amount * ((impact.bodyDamageReduction ?? 0) + (impact.ricochetDamageReduction ?? 0)),
  );
}
