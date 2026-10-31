import assert from 'node:assert/strict';
import test from 'node:test';
import { Item } from './item.ts';
import { Inventory } from './inventory.ts';
import type { InventoryEntrySnapshot } from './inventory.ts';
import { ItemTransferService } from './item-transfer-service.ts';
import { PocketLayout } from './pocket-layout.ts';

function supply(
  selectionId: string,
  quantity: number,
  { heldQuantity = 0, stackLimit = 2, slotSize = 1 } = {},
): InventoryEntrySnapshot {
  return {
    selectionId,
    item: { kind: selectionId, quantity, instanceIds: [], metadata: { weight: 0.5 } },
    heldQuantity,
    stackLimit,
    slotSize,
  };
}

function weapon(selectionId: string, identity: string): InventoryEntrySnapshot {
  return {
    selectionId,
    item: {
      kind: 'musket',
      quantity: 1,
      instanceIds: [identity, `${identity}:bayonet`],
      metadata: {
        loaded: 1,
        jammed: true,
        condition: 37,
        fittings: { bayonet: { instanceId: `${identity}:bayonet`, condition: 63 } },
      },
    },
    heldQuantity: 0,
    stackLimit: 1,
    slotSize: 2,
  };
}

void test('an item refuses invalid quantities and preserves identity and nested metadata through a transfer', () => {
  const value = new Item(weapon('musket', 'one').item);
  assert.throws(() => value.take(2));
  assert.equal(value.quantity, 1);
  const moved = value.take(1);
  assert.equal(value.quantity, 0);
  assert.deepEqual(moved.instanceIds, ['one', 'one:bayonet']);
  const changed = moved.toSnapshot();
  const fittings = changed.metadata['fittings'];
  assert.ok(fittings && typeof fittings === 'object' && 'bayonet' in fittings);
  const bayonet = fittings.bayonet;
  assert.ok(bayonet && typeof bayonet === 'object' && 'condition' in bayonet);
  bayonet.condition = 0;
  assert.deepEqual(moved.toSnapshot().metadata['fittings'], {
    bayonet: { instanceId: 'one:bayonet', condition: 63 },
  });
  assert.throws(() => new Item({ ...weapon('musket', 'one').item, quantity: 2 }));
});

void test('an inventory rejects duplicate custody across hands, clothing, and packed items', () => {
  const first = weapon('primary', 'same');
  assert.throws(
    () =>
      new Inventory({
        custodianId: 'character:one',
        entries: [first, { ...first, selectionId: 'packed-copy' }],
      }),
  );
  const inventory = new Inventory({ custodianId: 'character:one', entries: [first] });
  const original = inventory.toSnapshot();
  assert.throws(() =>
    inventory.receive(new Item(first.item), { selectionId: 'second', stackLimit: 1, slotSize: 2 }),
  );
  assert.deepEqual(inventory.toSnapshot(), original);
});

void test('pocket capacity distinguishes large objects, hand custody, and explicit partial stacks', () => {
  const large = Array.from({ length: 4 }, (_, index) =>
    supply(`large-${index}`, 1, { stackLimit: 1, slotSize: 2 }),
  );
  const inventory = new Inventory({
    custodianId: 'character:one',
    entries: [...large, supply('held', 1, { heldQuantity: 1, stackLimit: 1, slotSize: 2 })],
  });
  assert.equal(inventory.overloaded, false);
  assert.throws(() =>
    inventory.receive(new Item(supply('fifth', 1).item), {
      selectionId: 'fifth',
      stackLimit: 1,
      slotSize: 2,
    }),
  );
  const partial = new Inventory({
    custodianId: 'character:partial',
    entries: [supply('dressings', 2, { stackLimit: 5 })],
    pocketOrder: [
      { slotId: 'small-1', item: 'dressings', index: 0, count: 1 },
      { slotId: 'small-2', item: 'dressings', index: 1, count: 1 },
    ],
  });
  partial.receive(new Item(supply('dressings', 2).item), {
    selectionId: 'dressings',
    stackLimit: 5,
    slotSize: 1,
  });
  assert.deepEqual(partial.toSnapshot().pocketOrder, [
    { slotId: 'small-1', item: 'dressings', index: 0, count: 3 },
    { slotId: 'small-2', item: 'dressings', index: 1, count: 1 },
  ]);
});

void test('the transfer service stages both custodians and refuses stale or over-capacity requests atomically', () => {
  const source = new Inventory({
    custodianId: 'ground:one',
    unlimitedCapacity: true,
    entries: [weapon('musket', 'loaded-musket')],
  });
  const destination = new Inventory({
    custodianId: 'character:one',
    entries: Array.from({ length: 4 }, (_, index) =>
      weapon(`existing-${index}`, `existing-${index}`),
    ),
  });
  const before = source.toSnapshot();
  const service = new ItemTransferService();
  const placement = { selectionId: 'musket', stackLimit: 1, slotSize: 2 };
  assert.throws(() => service.prepare(source, destination, 'musket', 1, placement));
  assert.deepEqual(source.toSnapshot(), before);
  const empty = new Inventory({ custodianId: 'character:two', entries: [] });
  assert.throws(() => service.prepare(source, empty, 'musket', 1, placement, 'obsolete'));
  assert.throws(() => service.prepare(source, source, 'musket', 1, placement));
  const transfer = service.prepare(
    source,
    empty,
    'musket',
    1,
    placement,
    source.fingerprint('musket'),
  );
  assert.equal(transfer.source.quantityOf('musket'), 0);
  assert.equal(transfer.destination.quantityOf('musket'), 1);
  assert.equal(transfer.item.metadata['loaded'], 1);
  assert.equal(source.quantityOf('musket'), 1);
  assert.equal(empty.quantityOf('musket'), 0);
});

void test('an overloaded saved inventory can reduce quantities but cannot add more items', () => {
  const inventory = new Inventory({ custodianId: 'legacy', entries: [supply('rations', 100)] });
  assert.equal(inventory.overloaded, true);
  assert.throws(() =>
    inventory.receive(new Item(supply('rations', 1).item), {
      selectionId: 'rations',
      stackLimit: 2,
      slotSize: 1,
    }),
  );
  inventory.take('rations', 90);
  assert.equal(inventory.overloaded, false);
});

void test('pocket movement owns slot size and partition uniqueness', () => {
  const pockets = PocketLayout.allocate([{ item: 'musket', count: 1, stackLimit: 1, slotSize: 2 }]);
  assert.throws(() => pockets.exchange('large-1', 'small-1'));
  pockets.exchange('large-1', 'large-4');
  const [firstPocket] = pockets.toOrder();
  assert.ok(firstPocket);
  assert.equal(firstPocket.slotId, 'large-4');
  assert.throws(() =>
    PocketLayout.allocate(
      [{ item: 'rations', count: 1, stackLimit: 2, slotSize: 1 }],
      [
        { slotId: 'small-1', item: 'rations', index: 0 },
        { slotId: 'small-2', item: 'rations', index: 0 },
      ],
    ),
  );
});
