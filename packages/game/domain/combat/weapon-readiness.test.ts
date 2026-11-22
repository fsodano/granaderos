import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEAPON_READY_AP,
  firearmPreparation,
  lowerWeapon,
  lowersWeapon,
  turnLowersWeapon,
  validateWeaponReadiness,
} from './weapon-readiness.ts';
import type { WeaponReadyCombatant } from './weapon-readiness.ts';

const musket = { id: 1803, readyAP: 4 } as const;
const refusal = 'La posición de tiro del arma no es válida.';

function combatant(overrides: Partial<WeaponReadyCombatant> = {}): WeaponReadyCombatant {
  return { stance: 'standing', hp: 100, energy: 100, ...overrides };
}

void test('a standing shot spends the same action points as before the move', () => {
  assert.deepEqual(firearmPreparation(combatant(), musket, 8), {
    ready: 4,
    raise: 4,
    turn: 0,
    setup: 4,
    discharge: 4,
    total: 8,
  });
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8).total, 4);
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8, 2).total, 6);
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8, 4).total, 8);
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8, 6).total, 10);
});

void test('a prone shot adds the turning work on top of raising and discharging', () => {
  assert.deepEqual(firearmPreparation(combatant({ stance: 'prone' }), musket, 8, 4), {
    ready: 4,
    raise: 4,
    turn: 4,
    setup: 8,
    discharge: 4,
    total: 12,
  });
  assert.equal(firearmPreparation(combatant({ stance: 'prone' }), musket, 8).total, 8);
  const raised = combatant({ stance: 'prone', weaponReady: true });
  assert.equal(firearmPreparation(raised, musket, 8, 4).total, 12);
});

void test('the ready table supplies the raising cost when the weapon carries none', () => {
  assert.equal(WEAPON_READY_AP['1803'], 4);
  assert.equal(firearmPreparation(combatant(), { id: 1803 }, 8).raise, 4);
  assert.equal(firearmPreparation(combatant(), { id: 9999 }, 8).raise, 0);
});

void test('a turn lowers the weapon in the cases it did before and not in the others', () => {
  assert.equal(turnLowersWeapon({ stance: 'standing' }, 0), false);
  assert.equal(turnLowersWeapon({ stance: 'standing' }, 2), false);
  assert.equal(turnLowersWeapon({ stance: 'standing' }, 4), false);
  assert.equal(turnLowersWeapon({ stance: 'standing' }, 6), false);
  assert.equal(turnLowersWeapon({ stance: 'standing' }, 8), true);
  assert.equal(turnLowersWeapon({ stance: 'crouched' }, 2), false);
  assert.equal(turnLowersWeapon({ stance: 'crouched' }, 4), true);
  assert.equal(turnLowersWeapon({ stance: 'prone' }, 0), false);
  assert.equal(turnLowersWeapon({ stance: 'prone' }, 4), true);
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8, 4).ready, 0);
  assert.equal(firearmPreparation(combatant({ weaponReady: true }), musket, 8, 8).ready, 4);
});

void test('free orders leave a raised weapon alone and the others lower it', () => {
  for (const type of ['fire', 'firePoint', 'look', 'overwatch', 'stealth']) {
    assert.equal(lowersWeapon(type), false, type);
  }
  for (const type of ['movement', 'reload', 'stance', 'turn']) {
    assert.equal(lowersWeapon(type), true, type);
  }
});

void test('a raised weapon is refused for a combatant that cannot hold it', () => {
  const capable = combatant({ weaponReady: true });
  validateWeaponReadiness(capable, true);
  validateWeaponReadiness(combatant({ weaponReady: false }), false);
  validateWeaponReadiness(combatant(), false);
  for (const unable of [
    { ...capable, weaponDropped: true },
    { ...capable, activeSlot: 'secondary' },
    { ...capable, hp: 14 },
    { ...capable, energy: 0 },
    { ...capable, unconscious: true },
    { ...capable, knockedDown: true },
    { ...capable, routed: true },
    { ...capable, surrendered: true },
    { ...capable, departure: {} },
  ]) {
    assert.throws(() => validateWeaponReadiness(unable, true), { message: refusal });
  }
  assert.throws(() => validateWeaponReadiness(capable, false), { message: refusal });
});

void test('lowering a weapon forgets the raised state without touching the combatant', () => {
  const unit = combatant({ weaponReady: true });
  lowerWeapon(unit);
  assert.equal(unit.weaponReady, undefined);
  assert.equal(unit.hp, 100);
  assert.equal(unit.stance, 'standing');
});
