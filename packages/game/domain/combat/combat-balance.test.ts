import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_BALANCE,
  coveredFirearmDamage,
  penetratingFirearmDamage,
} from './combat-balance.ts';

// 12 g at 300 m/s carries 540 J, 27 impact points at 20 J each.
const rifleBall = { massGrams: 12, muzzleVelocityMps: 300 } as const;
const rifle = { projectileEnergy: rifleBall, damage: 40 } as const;
const weakRifle = { projectileEnergy: rifleBall, damage: 20 } as const;
const plainFirearm = { damage: 18 } as const;

void test('a shot with no cover keeps its whole damage', () => {
  assert.equal(coveredFirearmDamage(40), 40);
  assert.equal(coveredFirearmDamage(40, 1), 40);
  assert.equal(coveredFirearmDamage(40, 0.5, 0), 40);
  assert.equal(penetratingFirearmDamage(40, {}, 1, { damage: 40 }), 40);
});

void test('cover reduces the damage by its factor and never passes below zero', () => {
  assert.equal(coveredFirearmDamage(40, 0.5), 20);
  assert.equal(coveredFirearmDamage(40, 0.25), 10);
  assert.equal(coveredFirearmDamage(40, 0), 0);
  assert.equal(coveredFirearmDamage(40, 0.5, 2), 0);
  assert.equal(penetratingFirearmDamage(18, { coverDamageFactor: 0.5 }, 1, { damage: 18 }), 9);
  assert.equal(penetratingFirearmDamage(18, { damageFactor: 0.5 }, 1, { damage: 18 }), 9);
});

void test('a body and a ricochet take their share of a penetrating shot', () => {
  assert.equal(penetratingFirearmDamage(40, { bodyDamageReduction: 0.25 }), 30);
  assert.equal(penetratingFirearmDamage(40, { ricochetDamageReduction: 0.125 }), 35);
  assert.equal(
    penetratingFirearmDamage(40, {
      bodyDamageReduction: 0.25,
      ricochetDamageReduction: 0.125,
    }),
    25,
  );
  assert.equal(
    penetratingFirearmDamage(40, {
      coverDamageFactor: 0.5,
      bodyDamageReduction: 0.25,
      ricochetDamageReduction: 0.125,
    }),
    5,
  );
  assert.equal(
    penetratingFirearmDamage(40, {
      bodyDamageReduction: 0.875,
      ricochetDamageReduction: 0.25,
    }),
    0,
  );
  assert.equal(penetratingFirearmDamage(40, { bodyDamageReduction: 0.25 }, 1, rifle), 20.25);
  assert.equal(penetratingFirearmDamage(40, { ricochetDamageReduction: 0.125 }, 1, rifle), 23.625);
});

void test('the result never exceeds the weapon damage', () => {
  assert.equal(penetratingFirearmDamage(20, {}, 1, weakRifle), 20);
  assert.equal(penetratingFirearmDamage(20, {}, 1, rifle, 0.5), 13.5);
});

void test('a shot with no energy record follows the cover path, not the energy path', () => {
  assert.equal(penetratingFirearmDamage(18, { coverDamageFactor: 0.5 }, 1, plainFirearm), 9);
  assert.equal(penetratingFirearmDamage(18, { coverDamageFactor: 0.5 }, 1, null), 9);
  assert.equal(
    penetratingFirearmDamage(18, { coverDamageFactor: 0.5 }, 1, {
      projectileEnergy: rifleBall,
      damage: 18,
    }),
    13.5,
  );
});

void test('the tuning table keeps the wound and energy penalties, the cover multiplier and the body resistance', () => {
  assert.equal(COMBAT_BALANCE.woundAPMaximumPenalty, 35);
  assert.equal(COMBAT_BALANCE.energyAPPenaltyPerPoint, 0.25);
  assert.equal(COMBAT_BALANCE.coverDamageReductionMultiplier, 1);
  assert.deepEqual(COMBAT_BALANCE.firearmBodyResistance, { head: 15, torso: 30, legs: 23 });
  assert.equal(Object.isFrozen(COMBAT_BALANCE), true);
  assert.equal(Object.isFrozen(COMBAT_BALANCE.firearmBodyResistance), true);
});
