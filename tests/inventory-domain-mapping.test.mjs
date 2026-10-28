import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../packages/game/tactical.js';
import {
  readTacticalInventory,
  writeTacticalInventory,
  readIncomingPlacement,
} from '../packages/game/infrastructure/inventory/tactical-inventory-mapper.js';
import { ItemTransferService } from '../packages/game/domain/inventory/item-transfer-service.ts';
import { readItemStack } from '../packages/game/tactical-inventory.js';
import { makeOutfit } from '../packages/game/outfits.js';
import { validateBattleSnapshot } from '../packages/game/validate-battle.js';

function fixture() {
  return createBattle(
    [
      {
        id: 'p',
        weapon: 1808,
        weaponInstanceId: 'weapon-p',
        loaded: 2,
        condition: 61,
        jammed: true,
        outfit: { ...makeOutfit(), instanceId: 'outfit-p' },
        inventory: {
          keepsake: { count: 2, weight: 0.1, name: 'Medal', detail: { origin: 'Retiro' } },
        },
        equipmentCursor: {
          stack: { item: 'rations', count: 2, weight: 0.65 },
          sourceId: 'large-1',
        },
      },
      { id: 'q', weapon: 1800 },
    ],
    { id: 'inventory-mapping', sector: 'buenos_aires', exploration: true, enemies: [] },
  );
}

test('canonical inventory projection clears hand, body, cursor, supply, and stored custody without reissuing items', () => {
  const state = fixture();
  const actor = state.units[0];
  const inventory = readTacticalInventory(actor);
  for (const entry of inventory.toSnapshot().entries)
    inventory.take(entry.selectionId, entry.item.quantity);
  const emptied = writeTacticalInventory(actor, inventory);
  assert.equal(emptied.weaponDropped, true);
  assert.equal(emptied.loaded, 0);
  assert.equal(emptied.outfit, null);
  assert.equal(emptied.equipmentCursor, undefined);
  assert.deepEqual(readTacticalInventory(emptied).toSnapshot().entries, []);
  state.units[0] = emptied;
  const restored = JSON.parse(JSON.stringify(state));
  validateBattleSnapshot(restored);
  assert.deepEqual(readTacticalInventory(restored.units[0]).toSnapshot().entries, []);
  assert.equal(actor.weaponDropped, undefined);
});

test('canonical transfer projects exact source removal and destination weapon metadata', () => {
  const state = fixture();
  const source = readTacticalInventory(state.units[0]);
  const target = readTacticalInventory(state.units[1]);
  const stack = readItemStack(state.units[0], 'primary', 1);
  const transfer = new ItemTransferService().prepare(
    source,
    target,
    'primary',
    1,
    readIncomingPlacement(stack),
  );
  state.units[0] = writeTacticalInventory(state.units[0], transfer.source);
  state.units[1] = writeTacticalInventory(state.units[1], transfer.destination);
  const restored = JSON.parse(JSON.stringify(state));
  validateBattleSnapshot(restored);
  const destination = Object.values(restored.units[1].inventory).find(
    (item) => item.instanceId === 'weapon-p',
  );
  assert.equal(destination.loaded, 2);
  assert.equal(destination.condition, 61);
  assert.equal(destination.jammed, true);
  assert.equal(restored.units[0].weaponInstanceId, undefined);
  assert.equal(restored.units[0].weaponDropped, true);
  assert.equal(readTacticalInventory(restored.units[0]).quantityOf('primary'), 0);
});

test('canonical partial inventory projection retains metadata and does not refill depleted stacks', () => {
  const state = fixture();
  const inventory = readTacticalInventory(state.units[0]);
  inventory.take('inventory:keepsake', 1);
  inventory.take('cursor', 1);
  inventory.take('medkits', inventory.quantityOf('medkits'));
  const projected = writeTacticalInventory(state.units[0], inventory);
  assert.equal(projected.inventory.keepsake.count, 1);
  assert.deepEqual(projected.inventory.keepsake.detail, { origin: 'Retiro' });
  assert.equal(projected.equipmentCursor.stack.count, 1);
  assert.equal(projected.medkits, 0);
  assert.deepEqual(writeTacticalInventory(projected, readTacticalInventory(projected)), projected);
});
