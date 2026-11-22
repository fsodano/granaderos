import assert from 'node:assert/strict';
import test from 'node:test';
import { HELD_SUPPLIES, clearEmptySupply, heldSupply } from './held-supplies.ts';
import type { HeldSupplyCombatant } from './held-supplies.ts';

function combatant(overrides: Partial<HeldSupplyCombatant> = {}): HeldSupplyCombatant {
  return { activeSlot: 'supply', ...overrides };
}

void test('the three consumables keep their names, action points, and ranges', () => {
  assert.deepEqual(HELD_SUPPLIES, {
    torches: { key: 'torches', name: 'Antorcha', action: 'throwTorch', cost: 10, range: 8 },
    boleadoras: { key: 'boleadoras', name: 'Boleadoras', action: 'boleadoras', cost: 12, range: 8 },
    rations: { key: 'rations', name: 'Ración de tasajo', action: 'ration', cost: 10, range: 0 },
  });
  assert.ok(Object.isFrozen(HELD_SUPPLIES));
  for (const supply of Object.values(HELD_SUPPLIES)) {
    assert.ok(Object.isFrozen(supply));
  }
});

void test('a combatant holding a consumable in the supply slot is found with its count', () => {
  assert.deepEqual(heldSupply(combatant({ activeSupply: 'torches', torches: 3 })), {
    key: 'torches',
    name: 'Antorcha',
    action: 'throwTorch',
    cost: 10,
    range: 8,
    count: 3,
  });
  assert.deepEqual(heldSupply(combatant({ activeSupply: 'rations', rations: 2 })), {
    key: 'rations',
    name: 'Ración de tasajo',
    action: 'ration',
    cost: 10,
    range: 0,
    count: 2,
  });
});

void test('a combatant whose active slot is not the supply slot is not found', () => {
  assert.equal(
    heldSupply(combatant({ activeSlot: 'primary', activeSupply: 'torches', torches: 3 })),
    null,
  );
});

void test('a combatant whose active supply is unknown is not found', () => {
  const unknownSupply = { activeSlot: 'supply', activeSupply: 'bandages', bandages: 3 };
  assert.equal(heldSupply(unknownSupply), null);
});

void test('a combatant holding none of the consumable is not found', () => {
  assert.equal(heldSupply(combatant({ activeSupply: 'torches', torches: 0 })), null);
});

void test('an empty supply slot returns to the unarmed slot', () => {
  assert.deepEqual(
    clearEmptySupply({ activeSlot: 'supply', activeSupply: 'torches', torches: 0 }),
    {
      activeSlot: 'unarmed',
      torches: 0,
    },
  );
});
