import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from '../packages/game/tactical.js';
import { inventoryUsage } from '../packages/game/tactical-inventory.js';
import {
  allocatePockets,
  pocketOrderFromSlots,
  rearrangePockets,
} from '../packages/game/inventory-pockets.ts';
import {
  inventoryRoom,
  movePocket,
  personalPockets,
  pocketChangeReason,
  pocketItems,
  POCKET_FULL,
  supplyRoom,
} from '../packages/game/personal-pockets.ts';
import { present } from './assert-present.ts';

function currentCarrier() {
  const battle = createBattle([{ id: 'carrier', x: 1, y: 1 }], { enemies: [] });
  return present(battle.units.find((unit) => unit.id === 'carrier'));
}

function legacyCarrier() {
  const unit = currentCarrier();
  delete unit.ammunitionVersion;
  delete unit.pocketOrder;
  unit.inventory = {};
  return unit;
}

void test('pocket allocation retains metadata and explicit partial stacks through exchanges', () => {
  const items = [
    {
      item: 'rations',
      count: 5,
      stackLimit: 2,
      slotSize: 1,
      provenance: { source: 'depot' },
    },
    { item: 'musket', count: 1, stackLimit: 1, slotSize: 2, instanceId: 'musket-1' },
  ];
  const layout = allocatePockets(items, [
    { slotId: 'small-3', item: 'rations', index: 0, count: 1 },
  ]);
  const selected = present(layout.slots.find((slot) => slot.id === 'small-3'));
  assert.equal(selected.label, 'Bolsillo pequeño 3');
  assert.equal(present(selected.entry).count, 1);
  assert.deepEqual(present(selected.entry)['provenance'], { source: 'depot' });
  assert.deepEqual(
    pocketOrderFromSlots(layout.slots)
      .filter((entry) => entry.item === 'rations')
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.count),
    [2, 2, 1],
  );
  const before = structuredClone(layout);
  const order = rearrangePockets(layout, 'small-3', 'small-8');
  assert.deepEqual(
    order.find((entry) => entry.slotId === 'small-8'),
    {
      slotId: 'small-8',
      item: 'rations',
      index: 2,
      count: 1,
    },
  );
  assert.throws(() => rearrangePockets(layout, 'large-1', 'small-7'), {
    message: 'Ese objeto necesita un bolsillo grande.',
  });
  const restored = allocatePockets(items, order);
  assert.equal(
    present(present(restored.slots.find((slot) => slot.id === 'small-8')).entry).count,
    1,
  );
  assert.deepEqual(layout, before);
  assert.equal(present(items[0]).count, 5);
});

void test('legacy numeric inventory and ammunition produce finite pocket stacks', () => {
  const unit = legacyCarrier();
  unit.inventory = { recovered: 5 };
  const before = structuredClone(unit);
  const items = pocketItems(unit);
  assert.equal(present(items.find((item) => item.item === 'ammoMusket')).count, 12);
  assert.equal(present(items.find((item) => item.item === 'inventory:recovered')).count, 5);
  assert.deepEqual(
    personalPockets(unit)
      .slots.filter((slot) => slot.entry?.item === 'inventory:recovered')
      .map((slot) => present(slot.entry).count),
    [4, 1],
  );
  assert.deepEqual(unit, before);
});

void test('legacy overflow permits removal and refuses acquisition', () => {
  const before = legacyCarrier();
  before.inventory = { bulk: { count: 6, weight: 3 } };
  assert.equal(present(personalPockets(before).overflow[0]).count, 2);
  const reduced = structuredClone(before);
  reduced.inventory = { bulk: { count: 5, weight: 3 } };
  assert.equal(present(personalPockets(reduced).overflow[0]).count, 1);
  assert.equal(pocketChangeReason(before, reduced), null);
  const increased = structuredClone(before);
  increased.inventory = { bulk: { count: 7, weight: 3 } };
  assert.equal(pocketChangeReason(before, increased), POCKET_FULL);
});

void test('current and legacy room queries preserve the carrier and enforce pocket sizes', () => {
  for (const unit of [currentCarrier(), legacyCarrier()]) {
    const before = structuredClone(unit);
    assert.equal(supplyRoom(unit, 'rations', 100), 14);
    assert.equal(supplyRoom(unit, 'ammoMusket', 100), 100);
    assert.equal(inventoryRoom(unit, 'bulk', { count: 100, weight: 3 }), 4);
    assert.equal(inventoryRoom(unit, 'bulk', { count: 100, weight: 3 }, 0), 0);
    const layout = personalPockets(unit);
    if (unit.ammunitionVersion === 2) {
      assert.deepEqual(layout, inventoryUsage(unit));
      assert.equal(
        present(layout.slots.find((slot) => slot.entry?.item === 'inventory:ammo:musket_75')).entry
          ?.count,
        12,
      );
    }
    const occupied = present(layout.slots.find((slot) => slot.entry !== null));
    assert.ok(movePocket(unit, occupied.id, 'large-1').some((entry) => entry.slotId === 'large-1'));
    assert.deepEqual(unit, before);
  }
});
