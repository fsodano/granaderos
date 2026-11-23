import assert from 'node:assert/strict';
import test from 'node:test';
import { reloadRoundCost, validateReloadProgress } from './weapon-reload.ts';
import type { ReloadCombatant, ReloadWeapon } from './weapon-reload.ts';

const carbine: ReloadWeapon = { reloadAP: 10, capacity: 5 };
const refusal = 'El avance de recarga no es válido.';

function combatant(overrides: Partial<ReloadCombatant> = {}): ReloadCombatant {
  return { stance: 'standing', traits: [], ...overrides };
}

void test('a standing round costs the reload work spread over the capacity', () => {
  assert.equal(reloadRoundCost(combatant(), carbine), 2);
  assert.equal(reloadRoundCost(combatant(), { reloadAP: 8, capacity: 1 }), 8);
});

void test('a prone round costs half again as much as a standing one', () => {
  assert.equal(reloadRoundCost(combatant({ stance: 'prone' }), carbine), 3);
  assert.equal(reloadRoundCost(combatant({ stance: 'prone' }), { reloadAP: 8, capacity: 1 }), 12);
});

void test('an assistant makes a round cheaper', () => {
  assert.equal(reloadRoundCost(combatant(), carbine, true), 1.6);
  assert.equal(reloadRoundCost(combatant({ stance: 'prone' }), carbine, true), 2.4000000000000004);
});

void test('the gunsmith training makes a round cheaper', () => {
  const trained = combatant({ traits: ['gunsmith_artillerist'] });
  assert.equal(reloadRoundCost(trained, carbine), 1.7);
  assert.equal(reloadRoundCost(trained, carbine, true), 1.36);
});

void test('a valid stored progress is accepted', () => {
  validateReloadProgress(0.5, 5, 0);
  validateReloadProgress(0.25, 5, 3);
  validateReloadProgress(undefined, 5, 0);
});

void test('a stored progress that is not a number is refused', () => {
  for (const value of ['0.5', null, {}, [], true]) {
    assert.throws(() => validateReloadProgress(value, 5, 0), { message: refusal });
  }
  for (const value of [Number.NaN, Infinity]) {
    assert.throws(() => validateReloadProgress(value, 5, 0), { message: refusal });
  }
});

void test('a stored progress outside the open range is refused', () => {
  for (const value of [0, -0.1, 1, 1.5]) {
    assert.throws(() => validateReloadProgress(value, 5, 0), { message: refusal }, String(value));
  }
});

void test('a stored progress for a full weapon is refused', () => {
  assert.throws(() => validateReloadProgress(0.5, 5, 5), { message: refusal });
});

void test('a stored progress for a dropped weapon is refused', () => {
  assert.throws(() => validateReloadProgress(0.5, 5, 0, true), { message: refusal });
});
