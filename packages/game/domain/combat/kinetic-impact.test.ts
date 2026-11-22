import assert from 'node:assert/strict';
import test from 'node:test';
import { kineticNominalImpact } from './kinetic-impact.ts';
import type { ProjectileEnergyProfile } from './projectile-energy.ts';

// 12 g at 300 m/s carries 540 J, 27 impact points at 20 J each.
const rifleBall: ProjectileEnergyProfile = {
  massGrams: 12,
  muzzleVelocityMps: 300,
};
const rifle = { projectileEnergy: rifleBall, damage: 40 } as const;
// 25 g at 250 m/s carries 781.25 J, 39.0625 impact points.
const pistolBall: ProjectileEnergyProfile = {
  massGrams: 25,
  muzzleVelocityMps: 250,
};

void test('a shot with no cover lands with its whole launch', () => {
  assert.equal(kineticNominalImpact(rifle, {}), 27);
});

void test('cover takes its share of the launch', () => {
  assert.equal(kineticNominalImpact(rifle, { coverDamageFactor: 0.5 }), 13.5);
});

void test('a body, a ricochet and the air take their share of the launch', () => {
  assert.equal(kineticNominalImpact(rifle, { bodyDamageReduction: 0.2 }), 21.6);
  assert.equal(kineticNominalImpact(rifle, { ricochetDamageReduction: 0.1 }), 24.3);
  assert.equal(kineticNominalImpact(rifle, { airDamageReduction: 0.5 }), 13.5);
  assert.equal(
    kineticNominalImpact(rifle, {
      bodyDamageReduction: 0.2,
      ricochetDamageReduction: 0.1,
    }),
    18.9,
  );
});

void test('the result never exceeds the weapon damage times the share', () => {
  assert.equal(kineticNominalImpact({ ...rifle, damage: 20 }, {}), 20);
  assert.equal(
    kineticNominalImpact({ projectileEnergy: pistolBall, damage: 40 }, {}, 0.5),
    19.53125,
  );
});

void test('the result never falls below zero', () => {
  assert.equal(
    kineticNominalImpact(rifle, {
      bodyDamageReduction: 1,
      ricochetDamageReduction: 0.5,
    }),
    0,
  );
  assert.equal(kineticNominalImpact(rifle, { incomingImpact: -5 }), 0);
});

void test('a shot with no energy record still follows the same path', () => {
  assert.equal(kineticNominalImpact({ damage: 18 }, {}), 18);
  assert.equal(kineticNominalImpact({ damage: 18 }, { coverDamageFactor: 0.5 }), 9);
  assert.equal(kineticNominalImpact({ damage: 18 }, { bodyDamageReduction: 0.2 }, 0.5), 7.2);
});

void test('a measured incoming impact wins over the launch and only cover restores its loss', () => {
  assert.equal(kineticNominalImpact(rifle, { incomingImpact: 12 }), 12);
  assert.equal(kineticNominalImpact(rifle, { coverDamageFactor: 0.5 }, 1, 0.5), 20.25);
});
