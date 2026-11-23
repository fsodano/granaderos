import { hasProjectileEnergy } from './projectile-energy.ts';
import type { ProjectileEnergyProfile } from './projectile-energy.ts';

export type ProjectileAirDragProfile = Readonly<{
  retentionAtRange: number;
}>;

export type ProjectileAirDragWeapon = Readonly<{
  projectileAirDrag?: ProjectileAirDragProfile;
  projectileEnergy?: ProjectileEnergyProfile;
  range?: number;
}>;

type DriftingProjectileWeapon = ProjectileAirDragWeapon &
  Readonly<{ projectileAirDrag: ProjectileAirDragProfile; range: number }>;

// Range-normalized Granaderos tuning, not a measured drag coefficient. Arc
// length and selected effective range share abstract tactical distance units.
export const PROJECTILE_AIR_DRAG_MODEL = 'range-energy-retention-v1';

export const hasProjectileAirDrag = (
  weapon: ProjectileAirDragWeapon,
): weapon is DriftingProjectileWeapon =>
  weapon.projectileAirDrag !== undefined &&
  weapon.projectileAirDrag.retentionAtRange < 1 &&
  weapon.range !== undefined &&
  Number.isFinite(weapon.range) &&
  weapon.range > 0 &&
  hasProjectileEnergy(weapon);

export function projectileAirRetention(weapon: ProjectileAirDragWeapon, distance: number): number {
  if (!hasProjectileAirDrag(weapon) || distance <= 0) {
    return 1;
  }
  return Math.exp((Math.log(weapon.projectileAirDrag.retentionAtRange) * distance) / weapon.range);
}
