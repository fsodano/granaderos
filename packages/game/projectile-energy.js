import { isProjectileEnergyRecord } from '../campaign-format/projectile-profile-schema.js';
import { AMMUNITION_WEIGHT } from './ammunition-types.js';
import {
  PROJECTILE_ENERGY_MODEL,
  projectileLaunchImpact,
} from './domain/combat/projectile-energy.ts';

export {
  PROJECTILE_ENERGY_MODEL,
  PROJECTILE_ENERGY_JOULES_PER_IMPACT,
  projectileEnergyJ,
  hasProjectileEnergy,
  projectileLaunchImpact,
  projectileDamageFactor,
} from './domain/combat/projectile-energy.ts';

export function validProjectileEnergy(value) {
  return Boolean(
    isProjectileEnergyRecord(value) &&
    value.model === PROJECTILE_ENERGY_MODEL &&
    value.massGrams >= 0.1 &&
    value.massGrams <= 40 &&
    value.massGrams <= AMMUNITION_WEIGHT * 1000 &&
    value.muzzleVelocityMps >= 25 &&
    value.muzzleVelocityMps <= 600,
  );
}
// The injury denominator remains authored damage. An energetic ball may carry
// more penetration, while a weak contact cannot receive a full damage draw.
export function kineticNominalImpact(weapon, impact, share = 1, coverMultiplier = 1) {
  const launch = projectileLaunchImpact(weapon) * share,
    cap = weapon.damage * share;
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
