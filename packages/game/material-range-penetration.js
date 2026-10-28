// Granaderos tuning in tactical distance units, not measured projectile speed.
// Each selected load opts in; omitted older definitions keep their resistance.
export const DEFAULT_MATERIAL_RANGE_SLOPE = 0.25;
import { validMaterialRangeSlope } from '../campaign-format/projectile-profile-schema.js';
export { validMaterialRangeSlope } from '../campaign-format/projectile-profile-schema.js';
export function materialRangeResistanceFactor(weapon, distance) {
  const slope = weapon.materialRangeSlope;
  if (
    !validMaterialRangeSlope(slope) ||
    !Number.isFinite(weapon.range) ||
    weapon.range <= 0 ||
    !Number.isFinite(distance) ||
    distance < 0
  )
    return 1;
  return 1 + slope * Math.max(0, distance / weapon.range - 1);
}
