import { isProjectileEnergyRecord } from '../campaign-format/projectile-profile-schema.js';
import { AMMUNITION_WEIGHT } from './ammunition-types.js';
import { PROJECTILE_ENERGY_MODEL } from './domain/combat/projectile-energy.ts';

export {
  PROJECTILE_ENERGY_MODEL,
  PROJECTILE_ENERGY_JOULES_PER_IMPACT,
  projectileEnergyJ,
  hasProjectileEnergy,
  projectileLaunchImpact,
  projectileDamageFactor,
} from './domain/combat/projectile-energy.ts';

export { kineticNominalImpact } from './domain/combat/kinetic-impact.ts';

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
