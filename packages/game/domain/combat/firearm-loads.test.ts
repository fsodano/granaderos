import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ALTERNATIVE_LOADS,
  alternativeLoadsFor,
  firearmId,
  loadDefinition,
} from './firearm-loads.ts';
import type { AlternativeLoad } from './firearm-loads.ts';

const expectedDefaults: Readonly<Record<number, readonly AlternativeLoad[]>> = {
  1800: [{ family: 'ammoShot', damage: 28, range: 6, pattern: 'cone' }],
  1801: [{ family: 'ammoShot', damage: 26, range: 6, pattern: 'cone' }],
  1803: [{ family: 'ammoShot', damage: 22, range: 5, pattern: 'cone' }],
  1804: [{ family: 'ammoMusket', damage: 35, range: 10, pattern: 'single' }],
  1805: [{ family: 'ammoShot', damage: 14, range: 3, pattern: 'cone' }],
  1806: [{ family: 'ammoShot', damage: 12, range: 3, pattern: 'cone' }],
  1807: [{ family: 'ammoMusket', damage: 32, range: 8, pattern: 'single' }],
  1808: [{ family: 'ammoShot', damage: 14, range: 3, pattern: 'cone' }],
};

const authoredLoad: AlternativeLoad = {
  family: 'ammoMusket',
  damage: 31,
  range: 9,
  pattern: 'single',
};

void test('each firearm keeps its default load family, damage and range', () => {
  assert.deepEqual(alternativeLoadsFor(1800), expectedDefaults[1800]);
  assert.deepEqual(alternativeLoadsFor(1804), expectedDefaults[1804]);
  assert.deepEqual(alternativeLoadsFor(1807), expectedDefaults[1807]);
  for (const [id, loads] of Object.entries(expectedDefaults)) {
    assert.deepEqual(alternativeLoadsFor(Number(id)), loads);
    assert.deepEqual(DEFAULT_ALTERNATIVE_LOADS[Number(id)], loads);
  }
});

void test('a firearm identity is read from a unit, an item and a plain identifier', () => {
  assert.equal(firearmId({ weapon: { id: 1804 } }), 1804);
  assert.equal(firearmId({ primary: { id: 1800 } }), 1800);
  assert.equal(firearmId({ template: 1801 }), 1801);
  assert.equal(firearmId(1805), 1805);
  assert.equal(firearmId('1805'), '1805');
  assert.equal(firearmId({}), undefined);
  assert.equal(firearmId(undefined), undefined);
});

void test('the authored definition is found inside a unit and inside an item', () => {
  const fromUnit = {
    weapon: { id: 1801 },
    weaponMetadata: { contentWeapon: { id: 'firearm-1801', alternativeLoads: [authoredLoad] } },
  };
  const fromItem = {
    template: 1800,
    contentWeapon: { id: 'firearm-1800', alternativeLoads: [authoredLoad] },
  };
  assert.deepEqual(loadDefinition(fromUnit), fromUnit.weaponMetadata.contentWeapon);
  assert.deepEqual(loadDefinition(fromItem), fromItem.contentWeapon);
  assert.deepEqual(alternativeLoadsFor(fromUnit), [authoredLoad]);
  assert.deepEqual(alternativeLoadsFor(fromItem), [authoredLoad]);
});

void test('an authored override replaces the default of the same firearm', () => {
  const overridden = { template: 1800, alternativeLoads: [authoredLoad] };
  assert.deepEqual(alternativeLoadsFor(overridden), [authoredLoad]);
  assert.deepEqual(alternativeLoadsFor({ template: 1800 }), expectedDefaults[1800]);
});

void test('a weapon that declares its ammunition family inherits no default', () => {
  assert.deepEqual(alternativeLoadsFor({ template: 1800, ammunitionFamily: 'ammoMusket' }), []);
  assert.deepEqual(alternativeLoadsFor({ template: 1800, ammunitionFamily: 'ammoShot' }), []);
});

void test('a weapon with no definition offers no loads', () => {
  assert.deepEqual(alternativeLoadsFor({}), []);
  assert.deepEqual(alternativeLoadsFor({ template: 9999 }), []);
  assert.deepEqual(alternativeLoadsFor(null), []);
  assert.deepEqual(alternativeLoadsFor(undefined), []);
});
