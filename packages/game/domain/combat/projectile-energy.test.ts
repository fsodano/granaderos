import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROJECTILE_ENERGY_JOULES_PER_IMPACT,
  PROJECTILE_ENERGY_MODEL,
  hasProjectileEnergy,
  projectileDamageFactor,
  projectileEnergyJ,
  projectileLaunchImpact,
} from './projectile-energy.ts';
import type { ProjectileEnergyProfile, ProjectileEnergyWeapon } from './projectile-energy.ts';

const rifleBall: ProjectileEnergyProfile = {
  massGrams: 12,
  muzzleVelocityMps: 300,
};
const pistolBall: ProjectileEnergyProfile = {
  massGrams: 25,
  muzzleVelocityMps: 250,
};

void test('the joules of a projectile follow its mass and muzzle velocity', () => {
  assert.equal(projectileEnergyJ(rifleBall), 540);
  assert.equal(projectileEnergyJ(pistolBall), 781.25);
});

void test('the launch impact divides the joules by the joules per impact', () => {
  assert.equal(projectileLaunchImpact({ projectileEnergy: rifleBall, damage: 40 }), 27);
  assert.equal(projectileLaunchImpact({ projectileEnergy: pistolBall, damage: 40 }), 39.0625);
});

void test('a weapon with no energy record falls back to its authored damage, never below one', () => {
  assert.equal(projectileLaunchImpact({ damage: 18 }), 18);
  assert.equal(projectileLaunchImpact({ damage: 0 }), 1);
  assert.equal(projectileLaunchImpact({}), 1);
  assert.equal(hasProjectileEnergy({ damage: 18 }), false);
  assert.equal(hasProjectileEnergy({ projectileEnergy: rifleBall, damage: 40 }), true);
});

void test('the damage factor falls to zero as the damage is spent and is one while untouched', () => {
  const weapon: ProjectileEnergyWeapon = { projectileEnergy: rifleBall, damage: 40 };
  assert.equal(projectileDamageFactor(40, weapon, 40), 1);
  assert.equal(projectileDamageFactor(20, weapon, 40), 0.5);
  assert.equal(projectileDamageFactor(0, weapon, 40), 0);
  assert.equal(projectileDamageFactor(80, weapon, 40), 1);
  assert.equal(projectileDamageFactor(-5, weapon, 40), 0);
  assert.equal(projectileDamageFactor(9, { damage: 18 }, 9), 1);
});

void test('the energy model and the joules per impact keep their values', () => {
  assert.equal(PROJECTILE_ENERGY_MODEL, 'kinetic-energy-v1');
  assert.equal(PROJECTILE_ENERGY_JOULES_PER_IMPACT, 20);
});
