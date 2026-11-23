import assert from 'node:assert/strict';
import test from 'node:test';
import { hasProjectileAirDrag, projectileAirRetention } from './projectile-air-drag.ts';
import type { ProjectileAirDragWeapon } from './projectile-air-drag.ts';

const rifle: ProjectileAirDragWeapon = {
  projectileEnergy: { massGrams: 12, muzzleVelocityMps: 320 },
  projectileAirDrag: { retentionAtRange: 0.5 },
  range: 30,
};

void test('a weapon with no air drag profile keeps all of its energy at any distance', () => {
  const weapon: ProjectileAirDragWeapon = { range: 30 };
  assert.equal(hasProjectileAirDrag(weapon), false);
  assert.equal(projectileAirRetention(weapon, 0), 1);
  assert.equal(projectileAirRetention(weapon, 10), 1);
  assert.equal(projectileAirRetention(weapon, 30), 1);
  assert.equal(projectileAirRetention(weapon, 1000), 1);
});

void test('a weapon with an air drag profile loses energy as the distance grows', () => {
  assert.equal(hasProjectileAirDrag(rifle), true);
  const near = projectileAirRetention(rifle, 10),
    far = projectileAirRetention(rifle, 20);
  assert.ok(near < 1);
  assert.ok(far < near);
  assert.ok(projectileAirRetention(rifle, 60) < far);
});

void test('the loss follows the same exponential curve, so the retention at range is the profile retention', () => {
  assert.equal(projectileAirRetention(rifle, 1), 0.9771599684342459);
  assert.equal(projectileAirRetention(rifle, 10), 0.7937005259840997);
  assert.equal(projectileAirRetention(rifle, 15), 0.7071067811865475);
  assert.equal(projectileAirRetention(rifle, 20), 0.6299605249474366);
  assert.equal(projectileAirRetention(rifle, 30), 0.5);
  assert.equal(projectileAirRetention(rifle, 60), 0.25);
  assert.equal(projectileAirRetention(rifle, 30), rifle.projectileAirDrag?.retentionAtRange);
});

void test('a distance of zero or less loses nothing', () => {
  assert.equal(projectileAirRetention(rifle, 0), 1);
  assert.equal(projectileAirRetention(rifle, -5), 1);
});
