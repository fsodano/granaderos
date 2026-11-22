export type ProjectileEnergyProfile = Readonly<{
  massGrams: number;
  muzzleVelocityMps: number;
}>;

export type ProjectileEnergyWeapon = Readonly<{
  projectileEnergy?: ProjectileEnergyProfile;
  damage?: number;
}>;

type EnergeticProjectileWeapon = ProjectileEnergyWeapon &
  Readonly<{ projectileEnergy: ProjectileEnergyProfile; damage: number }>;

// Versioned Granaderos balance: energy is measured in joules, but these impact
// points, body/material costs and injury caps are game tuning, not SI forces.
export const PROJECTILE_ENERGY_MODEL = 'kinetic-energy-v1';
export const PROJECTILE_ENERGY_JOULES_PER_IMPACT = 20;

export const projectileEnergyJ = (profile: ProjectileEnergyProfile): number =>
  0.5 * (profile.massGrams / 1000) * profile.muzzleVelocityMps ** 2;

export const hasProjectileEnergy = (
  weapon: ProjectileEnergyWeapon | undefined,
): weapon is EnergeticProjectileWeapon => weapon?.projectileEnergy !== undefined;

export function projectileLaunchImpact(weapon: ProjectileEnergyWeapon): number {
  return hasProjectileEnergy(weapon)
    ? projectileEnergyJ(weapon.projectileEnergy) / PROJECTILE_ENERGY_JOULES_PER_IMPACT
    : Math.max(1, weapon.damage ?? 1);
}

export function projectileDamageFactor(
  remaining: number,
  weapon: ProjectileEnergyWeapon,
  power: number,
): number {
  return hasProjectileEnergy(weapon)
    ? Math.max(0, Math.min(1, remaining / weapon.damage))
    : remaining / power;
}
