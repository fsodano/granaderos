import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUTTSTOCK,
  FISTS,
  STEAL_MIN_AP,
  unarmedChance,
  unarmedImpact,
  weaponStealChance,
} from './unarmed-combat.ts';
import type { UnarmedCombatant, UnarmedDefender } from './unarmed-combat.ts';

function combatant(overrides: Partial<UnarmedCombatant> = {}): UnarmedCombatant {
  return {
    dexterity: 50,
    agility: 50,
    strength: 50,
    experienceLevel: 4,
    energy: 100,
    ...overrides,
  };
}

function defender(overrides: Partial<UnarmedDefender> = {}): UnarmedDefender {
  return { ...combatant(), ...overrides };
}

void test('the unarmed weapons keep their action cost, damage, and reach', () => {
  assert.deepEqual(FISTS, { id: 0, name: 'Puños', ap: 12, damage: 6, reach: 1.5 });
  assert.deepEqual(BUTTSTOCK, { id: -1, name: 'Culata', ap: 16, damage: 18, reach: 1.5 });
  assert.ok(Object.isFrozen(FISTS));
  assert.ok(Object.isFrozen(BUTTSTOCK));
  assert.equal(STEAL_MIN_AP, 28);
});

void test('an unconscious target is reached with a chance of 95', () => {
  assert.equal(unarmedChance(combatant(), defender({ unconscious: true })), 95);
  assert.equal(
    unarmedChance(combatant({ strength: 0, energy: 0 }), defender({ unconscious: true })),
    95,
  );
});

void test('a stronger, more agile, and more experienced attacker raises the chance', () => {
  const trained = combatant({ dexterity: 80, agility: 80, strength: 80, experienceLevel: 7 });
  assert.equal(unarmedChance(combatant(), defender()), 60);
  assert.equal(unarmedChance(trained, defender()), 87);
});

void test('a stronger defender lowers the chance', () => {
  const guard = defender({ dexterity: 80, agility: 80 });
  assert.equal(unarmedChance(combatant(), guard), 42);
});

void test('an unaware defender is easier to hit than an aware one', () => {
  assert.equal(unarmedChance(combatant(), defender(), { aware: true }), 60);
  assert.equal(unarmedChance(combatant(), defender(), { aware: false }), 80);
});

void test('the chance stays between 5 and 95 for extreme combatants', () => {
  const overwhelming = combatant({
    dexterity: 100,
    agility: 100,
    strength: 100,
    experienceLevel: 20,
    energy: 100,
  });
  const helpless = defender({
    dexterity: 0,
    agility: 0,
    strength: 0,
    experienceLevel: 0,
    energy: 100,
  });
  assert.equal(unarmedChance(overwhelming, helpless), 95);

  const spent = combatant({ dexterity: 0, agility: 0, strength: 0, experienceLevel: 0, energy: 0 });
  const rested = defender({
    dexterity: 100,
    agility: 100,
    strength: 100,
    experienceLevel: 20,
    energy: 100,
  });
  assert.equal(unarmedChance(spent, rested), 5);
});

void test('the impact damage and breath loss follow strength and energy', () => {
  assert.deepEqual(unarmedImpact(combatant({ strength: 50, energy: 100 })), {
    damage: 5,
    breathLoss: 26,
  });
  assert.deepEqual(unarmedImpact(combatant({ strength: 80, energy: 100 })), {
    damage: 7,
    breathLoss: 34,
  });
  assert.deepEqual(unarmedImpact(combatant({ strength: 50, energy: 0 })), {
    damage: 3,
    breathLoss: 13,
  });
  assert.deepEqual(unarmedImpact(combatant({ strength: 200, energy: 100 })), {
    damage: 8,
    breathLoss: 40,
  });
});

void test('the impact damage never falls below 1', () => {
  assert.deepEqual(unarmedImpact(combatant({ strength: 0, energy: 0 })), {
    damage: 1,
    breathLoss: 6,
  });
});

void test('an unaware defender is easier to disarm, and the chance stays between 5 and 95', () => {
  // The rule reads unconsciousness only in unarmedChance. A defender who cannot
  // watch the hands reaches the steal rule as unaware, which raises the chance.
  const aware = weaponStealChance(combatant(), defender({ unconscious: true }), { aware: true });
  const unaware = weaponStealChance(combatant(), defender({ unconscious: true }), { aware: false });
  assert.equal(aware, 50);
  assert.equal(unaware, 65);
  assert.ok(unaware > aware);
  assert.equal(weaponStealChance(combatant(), defender({ knockedDown: true })), 65);

  const overwhelming = combatant({
    dexterity: 100,
    agility: 100,
    strength: 100,
    experienceLevel: 20,
    energy: 100,
  });
  const helpless = defender({
    dexterity: 0,
    agility: 0,
    strength: 0,
    experienceLevel: 0,
    energy: 100,
  });
  assert.equal(weaponStealChance(overwhelming, helpless), 95);

  const spent = combatant({ dexterity: 0, agility: 0, strength: 0, experienceLevel: 0, energy: 0 });
  const rested = defender({
    dexterity: 100,
    agility: 100,
    strength: 100,
    experienceLevel: 20,
    energy: 100,
  });
  assert.equal(weaponStealChance(spent, rested), 5);
});
