import assert from 'node:assert/strict';
import test from 'node:test';
import { Firearm } from './firearm.ts';
import { BROKEN_FIREARM_REASON, firearmServiceable } from './firearm-serviceability.ts';

// The sentence the game refuses with today.
const refusal = 'El arma está rota: reparala o elegí otra.';

void test('a firearm with a good condition is serviceable', () => {
  const firearm = new Firearm({ loaded: 1, condition: 100, jammed: false });
  assert.equal(firearmServiceable(firearm.snapshot()), true);
  assert.equal(firearmServiceable({ condition: 1 }), true);
});

void test('a firearm with no recorded condition is serviceable', () => {
  assert.equal(firearmServiceable({}), true);
  assert.equal(firearmServiceable({ condition: undefined }), true);
  assert.equal(firearmServiceable({ condition: null }), true);
});

void test('a firearm with a condition of zero is not serviceable', () => {
  const worn = new Firearm({ loaded: 0, condition: 0, jammed: false });
  assert.equal(firearmServiceable(worn.snapshot()), false);
  assert.equal(firearmServiceable({ condition: 0 }), false);
});

void test('a missing firearm is not serviceable', () => {
  assert.equal(firearmServiceable(null), false);
  assert.equal(firearmServiceable(undefined), false);
});

void test('the refusal sentence is the one the game uses today', () => {
  assert.equal(BROKEN_FIREARM_REASON, refusal);
});
