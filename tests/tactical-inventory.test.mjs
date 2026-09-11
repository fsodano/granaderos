import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_CAPACITY, SUPPLY_ITEMS, inventoryUsage, itemDescriptor, itemQuantity, extractItemQuantity, applyItemQuantity, canCarryTransfer, transferItemQuantity, validateItemStack} from '../game/tactical-inventory.js';

const soldier = (extra = {}) => ({id: 'p', weapon: 1800, blade: 1813, activeSlot: 'primary', loaded: 1, ammo: 12, priming: 50, flints: 4, rations: 2, medkits: 2, boleadoras: 1, torches: 2, condition: 100, jammed: false, inventory: {}, ...extra});
const empty = (extra = {}) => ({id: 'q', inventory: {}, ...extra});

test('normal supplies fit seven of twelve capacity units while equipped weapons stay outside the pack', () => {
  const usage = inventoryUsage(soldier());
  assert.equal(INVENTORY_CAPACITY, 12);
  assert.deepEqual({used: usage.used, capacity: usage.capacity, free: usage.free, overloaded: usage.overloaded}, {used: 7, capacity: 12, free: 5, overloaded: false});
  assert.equal(usage.items.length, 7);
  assert.equal(usage.items.some(item => item.item === 'primary' || item.item === 'blade'), false);
  assert.equal(inventoryUsage(soldier({medkits: 20})).used, 10);
  assert.equal(Object.isFrozen(SUPPLY_ITEMS), true);
  for (const descriptor of Object.values(SUPPLY_ITEMS)) assert.equal(Object.isFrozen(descriptor), true);
});

test('supplies cross explicit stack boundaries rather than using one unlimited slot', () => {
  assert.equal(inventoryUsage(empty({ammo: 20})).used, 1);
  assert.equal(inventoryUsage(empty({ammo: 21})).used, 2);
  assert.equal(inventoryUsage(empty({medkits: 5})).used, 1);
  assert.equal(inventoryUsage(empty({medkits: 6})).used, 2);
  assert.equal(inventoryUsage(empty({priming: 51})).used, 2);
  assert.equal(itemDescriptor(soldier(), 'ammo').label, 'Cartuchos');
  assert.equal(itemDescriptor(soldier(), 'ammo').name, 'Cartuchos');
});

test('stored long arms cost two units while compact weapons cost one and do not stack', () => {
  const unit = empty({inventory: {
    musket: {count: 1, weight: 4, weapon: 1800, loaded: 1},
    pistols: {count: 2, weight: 1.2, weapon: 1808, loaded: 2},
  }});
  assert.equal(inventoryUsage(unit).used, 4);
  assert.equal(itemDescriptor(unit, 'musket').slotSize, 2);
  assert.equal(itemDescriptor(unit, 'pistols').stackLimit, 1);
  assert.equal(itemQuantity(unit, 'inventory:pistols'), 2);
});

test('partial supply transfers conserve quantities and leave both inputs unchanged', () => {
  const source = soldier(), target = empty({ammo: 18}), before = structuredClone({source, target});
  const result = transferItemQuantity(source, target, 'ammo', 4);
  assert.equal(result.source.ammo, 8);
  assert.equal(result.target.ammo, 22);
  assert.equal(result.source.ammo + result.target.ammo, 30);
  assert.deepEqual(result.stack, {item: 'ammo', count: 4, weight: .04});
  assert.deepEqual({source, target}, before);
  assert.equal(result.source.loaded, 1);
  assert.equal(inventoryUsage(result.target).used, 2);
});

test('full packs accept the remainder of an existing stack but reject a new stack atomically', () => {
  const source = soldier(), almost = empty({ammo: 239}), full = empty({ammo: 240});
  const stack = extractItemQuantity(source, 'ammo', 1).stack;
  assert.equal(inventoryUsage(almost).free, 0);
  assert.equal(canCarryTransfer(almost, stack), true);
  assert.equal(applyItemQuantity(almost, stack).ammo, 240);
  assert.equal(canCarryTransfer(full, stack), false);
  const before = structuredClone({source, full});
  assert.throws(() => transferItemQuantity(source, full, 'ammo', 1), /espacio/);
  assert.deepEqual({source, full}, before);
});

test('a transferred primary retains its loaded cartridge, condition, and failed ignition', () => {
  const source = soldier({condition: 47, jammed: true, ammo: 7, lastTargetId: 'e', lastShotPosition: {x: 3, y: 2}});
  const target = empty({inventory: {'weapon:1800': {count: 1, weight: 4, weapon: 1800, loaded: 0, condition: 90, jammed: false}}});
  const result = transferItemQuantity(source, target, 'primary');
  assert.equal(result.source.weaponDropped, true);
  assert.equal(result.source.activeSlot, 'unarmed');
  assert.equal(result.source.loaded, 0);
  assert.equal(result.source.ammo, 7);
  assert.equal(result.source.lastTargetId, undefined);
  assert.equal(result.source.lastShotPosition, undefined);
  assert.equal(itemQuantity(result.source, 'primary'), 0);
  assert.deepEqual(result.target.inventory['weapon:1800'], target.inventory['weapon:1800']);
  assert.deepEqual(result.target.inventory['weapon:1800:1'], {count: 1, weight: 4, weapon: 1800, loaded: 1, condition: 47, jammed: true});
  assert.equal(result.stack.item, 'weapon');
  assert.equal(source.loaded, 1);
  assert.equal(source.jammed, true);
});

test('removing the active secondary blade retains condition, selects unarmed, and keeps the primary', () => {
  const source = soldier({activeSlot: 'blade', bladeCondition: 37}), extracted = extractItemQuantity(source, 'blade');
  assert.equal(extracted.unit.blade, undefined);
  assert.equal(extracted.unit.weapon, 1800);
  assert.equal(extracted.unit.loaded, 1);
  assert.equal(extracted.unit.activeSlot, 'unarmed');
  assert.equal(extracted.stack.weapon, 1813);
  assert.equal(extracted.stack.loaded, 0);
  assert.equal(extracted.stack.condition, 37);
  assert.equal(extracted.unit.bladeCondition, undefined);
  assert.equal(source.blade, 1813);
});

test('legacy stacked weapons split into individual keys and conserve every loaded round', () => {
  const source = soldier({inventory: {captured: {count: 3, weight: 1.2, weapon: 1808, loaded: 2, condition: 33, jammed: true}}});
  const target = soldier({id: 'q'}), result = transferItemQuantity(source, target, 'captured', 2);
  assert.equal(result.source.inventory.captured.count, 1);
  const recovered = Object.values(result.target.inventory);
  assert.equal(recovered.length, 2);
  assert.ok(recovered.every(item => item.count === 1 && item.loaded === 2 && item.condition === 33 && item.jammed));
  assert.equal(recovered.reduce((sum, item) => sum + item.loaded, 0) + result.source.inventory.captured.loaded, 6);
  assert.equal(inventoryUsage(result.target).used, 9);
});

test('inventory key collisions preserve distinct metadata and merge only equivalent generic items', () => {
  const target = empty({inventory: {rope: {count: 2, weight: 1, condition: 20}}});
  const different = applyItemQuantity(target, {item: 'inventory:rope', count: 1, weight: 1, condition: 80});
  assert.equal(different.inventory.rope.count, 2);
  assert.equal(different.inventory['rope:1'].condition, 80);
  const same = applyItemQuantity(target, {item: 'inventory:rope', count: 3, weight: 1, condition: 20});
  assert.equal(same.inventory.rope.count, 5);
  assert.equal(Object.keys(same.inventory).length, 1);
  assert.equal(inventoryUsage(same).used, 2);
});

test('reserved and prefixed backpack keys remain distinct from counters and equipped hands', () => {
  const source = soldier({inventory: {ammo: {count: 3, weight: 1}, primary: {count: 1, weight: 0}, 'inventory:ammo': {count: 2, weight: .5}}});
  assert.equal(itemQuantity(source, 'ammo'), 12);
  assert.equal(itemQuantity(source, 'inventory:ammo'), 3);
  assert.equal(itemQuantity(source, 'inventory:primary'), 1);
  assert.equal(itemQuantity(source, 'inventory:inventory:ammo'), 2);
  const result = transferItemQuantity(source, empty(), 'inventory:ammo', 2);
  assert.equal(result.source.ammo, 12);
  assert.equal(result.source.inventory.ammo.count, 1);
  assert.equal(result.target.ammo, undefined);
  assert.equal(result.target.inventory.ammo.count, 2);
});

test('numeric legacy supplies can be split without deleting their untransferred quantity', () => {
  const source = empty({id: 'p', inventory: {letters: 4}}), result = transferItemQuantity(source, empty(), 'letters', 2);
  assert.equal(result.source.inventory.letters, 2);
  assert.deepEqual(result.target.inventory.letters, {count: 2, weight: 0});
  assert.equal(inventoryUsage(result.target).used, 1);
});

test('legacy non-handheld and unknown equipment records remain usable without becoming equipped weapons', () => {
  for (const weapon of [1820, 55000]) {
    const source = empty({id: 'p', inventory: {legacy: {weapon, count: 3, weight: .7, loaded: 0, condition: 80}}});
    assert.equal(inventoryUsage(source).used, 3);
    const transfer = transferItemQuantity(source, empty(), 'legacy', 2);
    assert.equal(transfer.source.inventory.legacy.count, 1);
    assert.equal(Object.values(transfer.target.inventory).length, 2);
    assert.ok(Object.values(transfer.target.inventory).every(item => item.weapon === weapon && item.loaded === 0 && item.condition === 80));
    assert.throws(() => extractItemQuantity({weapon, loaded: 0}, 'primary'));
  }
});

test('an old overcapacity inventory can drop supplies but cannot acquire more', () => {
  const source = empty({ammo: 300});
  assert.equal(inventoryUsage(source).overloaded, true);
  const dropped = extractItemQuantity(source, 'ammo', 60);
  assert.equal(inventoryUsage(dropped.unit).used, 12);
  assert.equal(dropped.stack.count, 60);
  assert.equal(source.ammo, 300);
  assert.equal(canCarryTransfer(source, {item: 'ammo', count: 1, weight: .04}), false);
});

test('ground stack validation accepts real large legacy quantities without pretending they fit a pack', () => {
  const stack = {item: 'weapon', count: 100, weight: 4, weapon: 1800, loaded: 1, condition: 42, jammed: true};
  assert.equal(validateItemStack(stack), true);
  assert.equal(canCarryTransfer(empty(), stack), false);
  assert.throws(() => validateItemStack({...stack, loaded: 3}));
  assert.throws(() => validateItemStack({...stack, count: 0}));
});

test('optional weapon identities survive transfer and cannot be received twice', () => {
  const source = soldier({weaponInstanceId: 'capture-7'}), result = transferItemQuantity(source, empty(), 'primary');
  assert.equal(result.source.weaponInstanceId, undefined);
  assert.equal(result.stack.instanceId, 'capture-7');
  assert.equal(Object.values(result.target.inventory)[0].instanceId, 'capture-7');
  assert.equal(canCarryTransfer(result.target, result.stack), false);
  assert.throws(() => applyItemQuantity(result.target, result.stack), /ya está/);
});

test('invalid quantities, missing items, self-transfers, prototype keys, and weapon loads reject without mutation', () => {
  const unit = soldier(), before = structuredClone(unit);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, '2']) assert.throws(() => extractItemQuantity(unit, 'ammo', invalid));
  assert.throws(() => extractItemQuantity(unit, 'ammo', 13));
  assert.throws(() => extractItemQuantity(unit, 'unknown', 1));
  assert.throws(() => transferItemQuantity(unit, unit, 'ammo'));
  assert.throws(() => transferItemQuantity(unit, structuredClone(unit), 'ammo'));
  assert.throws(() => applyItemQuantity(empty(), {item: 'inventory:__proto__', count: 1, weight: 0}));
  assert.throws(() => inventoryUsage({inventory: JSON.parse('{"__proto__":{"count":1,"weight":0}}')}));
  assert.throws(() => applyItemQuantity(empty(), {item: 'weapon', count: 1, weight: 4, weapon: 1800, loaded: 2}));
  assert.throws(() => applyItemQuantity(empty(), {item: 'weapon', count: 1, weight: 4, weapon: 1800, loaded: 1, jammed: 'yes'}));
  assert.throws(() => applyItemQuantity(empty(), {item: 'ammo', count: 1, weight: .04, weapon: 1800}));
  assert.deepEqual(unit, before);
});

test('repeated calculations are deterministic and transferred record metadata is detached from the source', () => {
  const source = soldier({inventory: {dispatch: {count: 1, weight: 0, details: {seal: 'patriot'}}}}), target = empty();
  const first = transferItemQuantity(source, target, 'dispatch');
  assert.deepEqual(transferItemQuantity(source, target, 'dispatch'), first);
  first.stack.details.seal = 'changed';
  assert.equal(source.inventory.dispatch.details.seal, 'patriot');
  assert.equal(first.target.inventory.dispatch.details.seal, 'patriot');
  assert.equal(first.source.inventory.dispatch, undefined);
});
