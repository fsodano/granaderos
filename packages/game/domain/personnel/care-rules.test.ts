import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CARE_RULES, DEFAULT_STRATEGIC_BLEEDING_PERCENT } from './care-rules.ts';

void test('the default care rules keep their values', () => {
  assert.deepEqual(DEFAULT_CARE_RULES, {
    minimumSkill: 20,
    baseHealing: 2,
    skillStep: 20,
    dressingPrice: 10,
    energyCost: 3,
    fatigueCost: 2,
    restEnergy: 12,
    restFatigue: 8,
    restHealingHours: 6,
  });
});

void test('the default care rules stay frozen', () => {
  assert.equal(Object.isFrozen(DEFAULT_CARE_RULES), true);
});

void test('the default strategic bleeding percentage stays at a quarter of health per hour', () => {
  assert.equal(DEFAULT_STRATEGIC_BLEEDING_PERCENT, 25);
});
