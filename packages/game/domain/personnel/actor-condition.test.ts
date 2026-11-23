import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CRITICAL_HEALTH,
  fieldCapable,
  isUnconscious,
  refreshMilitaryCondition,
} from './actor-condition.ts';
import type { ConditionCombatant } from './actor-condition.ts';

function combatant(overrides: Partial<ConditionCombatant> = {}): ConditionCombatant {
  return { hp: 100, energy: 100, ...overrides };
}

void test('a combatant below the critical health is unconscious', () => {
  assert.equal(CRITICAL_HEALTH, 15);
  assert.equal(isUnconscious(combatant({ hp: 14 })), true);
  assert.equal(isUnconscious(combatant({ hp: 1 })), true);
  assert.equal(isUnconscious(combatant({ hp: 15 })), false);
  assert.equal(isUnconscious(combatant({ hp: 100 })), false);
  assert.equal(isUnconscious(combatant({ hp: 0 })), false);
});

void test('a combatant with no energy is unconscious until exhaustion recovers', () => {
  assert.equal(isUnconscious(combatant({ energy: 0 })), true);
  assert.equal(isUnconscious(combatant({ energy: 1 })), false);
  assert.equal(isUnconscious({ hp: 100 }), false);
});

void test('a combatant can hold the field only while alive and not gone', () => {
  assert.equal(fieldCapable(combatant({ hp: 15 })), true);
  assert.equal(fieldCapable(combatant({ hp: 14 })), false);
  assert.equal(fieldCapable(combatant({ hp: 0 })), false);
  assert.equal(fieldCapable(combatant({ departure: {} })), false);
  assert.equal(fieldCapable(combatant({ fled: true })), false);
  assert.equal(fieldCapable(combatant({ surrendered: true })), false);
  // Routed troops still occupy the field until they leave.
  assert.equal(fieldCapable(combatant({ routed: true })), true);
});

void test('a refresh lowers the weapon and stops a combatant needing care', () => {
  const wounded = combatant({
    hp: 10,
    ap: 4,
    maxAP: 6,
    mounted: true,
    braced: true,
    overwatch: true,
    bleeding: 2,
    weaponReady: true,
  });
  const refreshed = refreshMilitaryCondition(wounded);
  assert.equal(refreshed, wounded);
  assert.equal(wounded.unconscious, true);
  assert.equal(wounded.weaponReady, undefined);
  assert.equal(wounded.ap, 0);
  assert.equal(wounded.maxAP, 0);
  assert.equal(wounded.mounted, false);
  assert.equal(wounded.braced, false);
  assert.equal(wounded.overwatch, false);
  assert.equal(wounded.bleeding, 2);
});

void test('a refresh leaves a routed combatant without a ready weapon but with its action points', () => {
  const routed = combatant({ hp: 100, ap: 3, maxAP: 6, routed: true, weaponReady: true });
  refreshMilitaryCondition(routed);
  assert.equal(routed.unconscious, false);
  assert.equal(routed.weaponReady, undefined);
  assert.equal(routed.ap, 3);
  assert.equal(routed.maxAP, 6);
});

void test('a refresh stops the bleeding of a dead combatant', () => {
  const dead = combatant({ hp: 0, ap: 2, bleeding: 3, weaponReady: true });
  refreshMilitaryCondition(dead);
  assert.equal(dead.unconscious, false);
  assert.equal(dead.weaponReady, undefined);
  assert.equal(dead.ap, 0);
  assert.equal(dead.maxAP, 0);
  assert.equal(dead.bleeding, 0);
});

void test('a refresh keeps a healthy combatant ready', () => {
  const healthy = combatant({ ap: 3, maxAP: 6, weaponReady: true });
  refreshMilitaryCondition(healthy);
  assert.equal(healthy.unconscious, false);
  assert.equal(healthy.weaponReady, true);
  assert.equal(healthy.ap, 3);
  assert.equal(healthy.maxAP, 6);
});

void test('a refresh lowers the weapon of a knocked down or disarmed combatant', () => {
  const knockedDown = combatant({ knockedDown: true, weaponReady: true });
  refreshMilitaryCondition(knockedDown);
  assert.equal(knockedDown.weaponReady, undefined);
  assert.equal(knockedDown.ap, undefined);
  const disarmed = combatant({ weaponDropped: true, weaponReady: true });
  refreshMilitaryCondition(disarmed);
  assert.equal(disarmed.weaponReady, undefined);
});
