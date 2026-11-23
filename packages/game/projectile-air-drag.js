import { isProjectileAirDragRecord } from '../campaign-format/projectile-profile-schema.js';
import { validProjectileEnergy } from './projectile-energy.js';
import { PROJECTILE_AIR_DRAG_MODEL } from './domain/combat/projectile-air-drag.ts';

export {
  PROJECTILE_AIR_DRAG_MODEL,
  hasProjectileAirDrag,
  projectileAirRetention,
} from './domain/combat/projectile-air-drag.ts';

export function validProjectileAirDrag(value, energy) {
  return Boolean(
    isProjectileAirDragRecord(value) &&
    value.model === PROJECTILE_AIR_DRAG_MODEL &&
    validProjectileEnergy(energy),
  );
}
