import { projectileLaunchImpact } from './projectile-energy.ts';
import type { ProjectileEnergyProfile } from './projectile-energy.ts';

export type KineticImpactWeapon = Readonly<{
  projectileEnergy?: ProjectileEnergyProfile;
  damage: number;
}>;

export type KineticImpact = Readonly<{
  coverDamageFactor?: number;
  bodyDamageReduction?: number;
  ricochetDamageReduction?: number;
  airDamageReduction?: number;
  incomingImpact?: number;
}>;

// The injury denominator remains authored damage. An energetic ball may carry
// more penetration, while a weak contact cannot receive a full damage draw.
export function kineticNominalImpact(
  weapon: KineticImpactWeapon,
  impact: KineticImpact,
  share = 1,
  coverMultiplier = 1,
): number {
  const launch = projectileLaunchImpact(weapon) * share;
  const cap = weapon.damage * share;
  const coverLoss = launch * (1 - (impact.coverDamageFactor ?? 1));
  const incoming =
    impact.incomingImpact ??
    Math.max(
      0,
      launch -
        coverLoss -
        launch *
          ((impact.bodyDamageReduction ?? 0) +
            (impact.ricochetDamageReduction ?? 0) +
            (impact.airDamageReduction ?? 0)),
    );
  return Math.max(0, Math.min(cap, incoming + (1 - coverMultiplier) * coverLoss));
}
