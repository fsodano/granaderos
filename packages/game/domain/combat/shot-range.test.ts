import assert from 'node:assert/strict';
import test from 'node:test';
import { shotRangeModifiers } from './shot-range.ts';

void test('a shot inside both ranges takes no chance factor reduction', () => {
  assert.deepEqual(shotRangeModifiers({ distance: 5, weaponRange: 10, visibleRange: 10 }), {
    distance: 5,
    weaponRange: 10,
    visibleRange: 10,
    apparentRange: 5,
    effectiveSightRange: 5,
    beyondSight: false,
    beyondWeapon: false,
    weaponPenalty: 2,
    sightAdjustment: 12,
    chanceFactor: 1,
  });
});

void test('a shot beyond the weapon range takes the weapon chance factor', () => {
  assert.deepEqual(shotRangeModifiers({ distance: 20, weaponRange: 10, visibleRange: 20 }), {
    distance: 20,
    weaponRange: 10,
    visibleRange: 20,
    apparentRange: 20,
    effectiveSightRange: 20,
    beyondSight: false,
    beyondWeapon: true,
    weaponPenalty: 29,
    sightAdjustment: -33,
    chanceFactor: 0.5,
  });
});

void test('a shot beyond the sight range takes the sight chance factor', () => {
  assert.deepEqual(
    shotRangeModifiers({ distance: 5, weaponRange: 10, apparentRange: 15, visibleRange: 10 }),
    {
      distance: 5,
      weaponRange: 10,
      visibleRange: 10,
      apparentRange: 15,
      effectiveSightRange: 20,
      beyondSight: true,
      beyondWeapon: false,
      weaponPenalty: 2,
      sightAdjustment: -33,
      chanceFactor: 0.5,
    },
  );
});

void test('a shot beyond both ranges combines both chance factors', () => {
  assert.deepEqual(
    shotRangeModifiers({ distance: 20, weaponRange: 10, apparentRange: 20, visibleRange: 10 }),
    {
      distance: 20,
      weaponRange: 10,
      visibleRange: 10,
      apparentRange: 20,
      effectiveSightRange: 30,
      beyondSight: true,
      beyondWeapon: true,
      weaponPenalty: 29,
      sightAdjustment: -63,
      chanceFactor: 0.25,
    },
  );
});

void test('the weapon and sight penalties keep their values', () => {
  const weapon = shotRangeModifiers({ distance: 20, weaponRange: 10, visibleRange: 20 });
  assert.equal(weapon.weaponPenalty, 29);
  assert.equal(weapon.sightAdjustment, -33);
  const sight = shotRangeModifiers({
    distance: 5,
    weaponRange: 10,
    apparentRange: 15,
    visibleRange: 10,
  });
  assert.equal(sight.weaponPenalty, 2);
  assert.equal(sight.sightAdjustment, -33);
});

void test('a non-finite or negative range is refused', () => {
  assert.throws(
    () => shotRangeModifiers({ distance: -1, weaponRange: 10, visibleRange: 10 }),
    /Invalid shot range\./,
  );
  assert.throws(
    () => shotRangeModifiers({ distance: 5, weaponRange: Infinity, visibleRange: 10 }),
    /Invalid shot range\./,
  );
  assert.throws(
    () => shotRangeModifiers({ distance: 5, weaponRange: 10, visibleRange: NaN }),
    /Invalid shot range\./,
  );
  assert.throws(
    () => shotRangeModifiers({ distance: 5, weaponRange: 10, apparentRange: -2, visibleRange: 10 }),
    /Invalid shot range\./,
  );
});
