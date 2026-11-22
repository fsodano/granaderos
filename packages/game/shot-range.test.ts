import assert from 'node:assert/strict';
import test from 'node:test';
import { shotRangeText } from './shot-range.js';

// These are the literal sentences the game produced before the rule moved to
// the domain, so a change to the wording is a test failure.
void test('a shot inside both ranges names only the distance and the weapon range', () => {
  assert.equal(
    shotRangeText({ distance: 5, weaponRange: 10, beyondWeapon: false, beyondSight: false }),
    'Distancia: 5 casillas · alcance del arma: 10.',
  );
});

void test('a shot beyond the weapon range names its chance', () => {
  assert.equal(
    shotRangeText({
      distance: 20,
      weaponRange: 10,
      beyondWeapon: true,
      weaponChanceFactor: 0.5,
      beyondSight: false,
    }),
    'Distancia: 20 casillas · alcance del arma: 10. Fuera del alcance eficaz: probabilidad al 50%.',
  );
});

void test('a shot beyond both ranges names both chances', () => {
  assert.equal(
    shotRangeText({
      distance: 20,
      weaponRange: 10,
      beyondWeapon: true,
      weaponChanceFactor: 0.5,
      beyondSight: true,
      sightChanceFactor: 0.25,
    }),
    'Distancia: 20 casillas · alcance del arma: 10. Fuera del alcance eficaz: probabilidad al 50%. Visión difícil: probabilidad al 25%.',
  );
});
