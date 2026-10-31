import type { TacticalOrder } from '../packages/game/public/hud-types.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  EquipmentItem,
} from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import { enterAssault } from './assault-fixture.ts';
import test from 'node:test';
const AMMO = 'inventory:ammo:musket_75';
import assert from 'node:assert/strict';
import {
  createBattle,
  actBattle,
  transferPreview,
  dropPreview,
  lootBatchPreview,
} from '../packages/game/tactical.js';
import { inventoryUsage } from '../packages/game/tactical-inventory.js';
import { validatePersonalInventory } from '../packages/game/squads.js';
import { validateBattleSnapshot } from '../packages/game/validate-battle.js';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { syncBattleTime } from '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { enterSector } from '../packages/game/world.js';

const tiles = () =>
  Array.from({ length: 216 }, (_, i) => ({
    x: i % 24,
    y: Math.floor(i / 24),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
const field = (
  first: Partial<BattleUnit> = {},
  second: Partial<BattleUnit> = {},
  enemies: Partial<BattleUnit>[] = [],
) =>
  createBattle(
    [
      { id: 'p', x: 1, y: 3, ...first },
      { id: 'q', x: 2, y: 3, ...second },
    ],
    {
      width: 24,
      height: 9,
      tiles: tiles(),
      seed: 45,
      enemies: [...enemies, { id: 'guard', x: 22, y: 7, overwatch: false }],
    },
  );
const troop = (state: BattleSnapshot, id = 'p') => present(state.units.find((u) => u.id === id));
const order = (state: BattleSnapshot, action: TacticalOrder) => {
  const next = actBattle(state, { unitId: 'p', ...action });
  assert.equal(next.lastError, null, `${action.type}: ${next.lastError}`);
  return next;
};
function rejectUnchanged(state: BattleSnapshot, action: TacticalOrder) {
  const rejected = actBattle(state, { unitId: 'p', ...action });
  assert.ok(rejected.lastError);
  assert.deepEqual(rejected.units, state.units);
  assert.deepEqual(rejected.groundItems, state.groundItems);
  assert.deepEqual(rejected.droppedWeapons, state.droppedWeapons);
  assert.equal(rejected.seed, state.seed);
  assert.equal(rejected.elapsedSeconds, state.elapsedSeconds);
  return rejected;
}

void test('nearby passing uses the preview cost, conserves supplies, and does not draw randomness', () => {
  const state = field(),
    preview = transferPreview(state, troop(state), troop(state, 'q'), AMMO, 3);
  assert.deepEqual(
    { kind: preview.kind, pa: preview.pa, chance: preview.chance, valid: preview.valid },
    { kind: 'give', pa: 4, chance: 100, valid: true },
  );
  const next = order(state, { type: 'transfer', targetId: 'q', item: AMMO, count: 3 });
  assert.equal(troop(next).ammo, 9);
  assert.equal(troop(next, 'q').ammo, 15);
  assert.equal(troop(next).ap, 96);
  assert.equal(troop(next, 'q').ap, 100);
  assert.equal(next.seed, state.seed);
  assert.equal(next.groundItems.length, 0);
  assert.equal(troop(state).ammo, 12);
});

void test('a successful throw spends throw and catch AP and delivers the exact selected quantity', () => {
  const state = field({ dexterity: 100 }, { x: 5, dexterity: 100 });
  const preview = transferPreview(state, troop(state), troop(state, 'q'), 'medkits', 2);
  assert.equal(preview.kind, 'throw');
  assert.equal(preview.pa, 8);
  assert.equal(preview.chance, 95);
  const next = order(state, { type: 'transfer', targetId: 'q', item: 'medkits', count: 2 });
  assert.equal(troop(next).medkits, 0);
  assert.equal(troop(next, 'q').medkits, 4);
  assert.equal(troop(next).ap, 92);
  assert.equal(troop(next, 'q').ap, 98);
  assert.notEqual(next.seed, state.seed);
  assert.equal(next.groundItems.length, 0);
});

void test('a failed catch leaves supplies at the receiver’s feet for finite partial pickup', () => {
  const state = field({ dexterity: 0 }, { x: 5, dexterity: 0, energy: 20 });
  assert.equal(transferPreview(state, troop(state), troop(state, 'q'), AMMO, 4).chance, 5);
  let next = order(state, { type: 'transfer', targetId: 'q', item: AMMO, count: 4 });
  assert.equal(troop(next).ammo, 8);
  assert.equal(troop(next, 'q').ammo, 12);
  assert.equal(troop(next).ap, troop(state).ap - 8);
  assert.equal(troop(next, 'q').ap, troop(state, 'q').ap);
  const ground = next.groundItems[0];
  assert.equal(present(ground).x, 5);
  assert.equal(present(ground).y, 3);
  assert.equal(present(ground).count, 4);
  assert.equal(present(ground).item, AMMO);
  next = order(next, {
    type: 'loot',
    unitId: 'q',
    groundId: present(present(ground).id),
    count: 2,
  });
  assert.equal(troop(next, 'q').ammo, 14);
  assert.equal(present(next.groundItems[0]).count, 2);
  next = order(next, { type: 'loot', unitId: 'q', groundId: present(present(ground).id) });
  assert.equal(troop(next, 'q').ammo, 16);
  assert.equal(present(next.groundItems[0]).count, 0);
  rejectUnchanged(next, { type: 'loot', unitId: 'q', groundId: present(present(ground).id) });
});

void test('dropping and picking up a loaded jammed primary preserves its condition and leaves the giver unarmed', () => {
  const state = field({ condition: 37, jammed: true, weaponInstanceId: 'captured-1' });
  assert.equal(dropPreview(state, troop(state), 'primary').pa, 4);
  let next = order(state, { type: 'drop', item: 'primary' });
  assert.equal(troop(next).activeSlot, 'unarmed');
  assert.equal(troop(next).weaponDropped, true);
  assert.equal(troop(next).loaded, 0);
  assert.equal(troop(next).ammo, 12);
  const ground = next.groundItems[0];
  assert.equal(present(ground).item, 'weapon');
  assert.equal(present(ground).loaded, 1);
  assert.equal(present(ground).condition, 37);
  assert.equal(present(ground).jammed, true);
  assert.equal(present(ground).instanceId, 'captured-1');
  next = order(next, { type: 'loot', unitId: 'q', groundId: present(present(ground).id) });
  const received = Object.values(troop(next, 'q').inventory).find(
    (r): r is EquipmentItem => typeof r !== 'number' && r.instanceId === 'captured-1',
  );
  assert.equal(present(received).loaded, 1);
  assert.equal(present(received).condition, 37);
  assert.equal(present(received).jammed, true);
  assert.equal(present(received).instanceId, 'captured-1');
  assert.equal(present(next.groundItems[0]).count, 0);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

void test('failed weapon throws preserve every weapon field in the resulting ground stack', () => {
  const state = field(
    { dexterity: 0, weapon: 1808, loaded: 2, condition: 28, jammed: true },
    { x: 5, dexterity: 0, energy: 20 },
  );
  const next = order(state, { type: 'transfer', targetId: 'q', item: 'primary' });
  assert.equal(troop(next).activeSlot, 'unarmed');
  assert.equal(troop(next).loaded, 0);
  assert.deepEqual(troop(next, 'q').inventory, troop(state, 'q').inventory);
  const stack = next.groundItems[0];
  assert.equal(present(stack).weapon, 1808);
  assert.equal(present(stack).loaded, 2);
  assert.equal(present(stack).condition, 28);
  assert.equal(present(stack).jammed, true);
  assert.equal(present(stack).count, 1);
});

void test('partial corpse loot leaves unselected supplies and the loaded weapon on the body', () => {
  const state = field({}, {}, [
    { id: 'corpse', x: 1, y: 4, hp: 0, ammo: 9, loaded: 1, jammed: true, condition: 29 },
  ]);
  let next = order(state, { type: 'loot', targetId: 'corpse', item: AMMO, count: 3 });
  assert.equal(troop(next).ammo, 15);
  assert.equal(troop(next, 'corpse').ammo, 6);
  assert.equal(troop(next, 'corpse').loaded, 1);
  assert.equal(troop(next, 'corpse').weaponDropped, undefined);
  next = order(next, { type: 'loot', targetId: 'corpse', item: 'weapon' });
  assert.equal(troop(next, 'corpse').weaponDropped, true);
  assert.equal(troop(next, 'corpse').loaded, 0);
  const received = Object.values(troop(next).inventory).find(
    (r): r is EquipmentItem => typeof r !== 'number' && r.weapon === troop(state, 'corpse').weapon,
  );
  assert.equal(present(received).loaded, 1);
  assert.equal(present(received).condition, 29);
  assert.equal(present(received).jammed, true);
  assert.equal(troop(next, 'corpse').ammo, 6);
});

void test('select-all preflight rejects capacity overflow without taking the first items or spending AP', () => {
  const state = field({}, {}, [
    {
      id: 'corpse',
      x: 1,
      y: 4,
      hp: 0,
      ammo: 200,
      priming: 0,
      flints: 0,
      rations: 0,
      medkits: 0,
      boleadoras: 0,
      torches: 0,
    },
  ]);
  const items = [
    { targetId: 'corpse', item: 'primary', count: 1 },
    { targetId: 'corpse', item: AMMO, count: 200 },
  ];
  assert.equal(lootBatchPreview(state, troop(state), items).valid, false);
  rejectUnchanged(state, { type: 'lootBatch', items });
  const partial = order(state, { type: 'loot', targetId: 'corpse', item: AMMO, count: 8 });
  assert.equal(troop(partial).ammo, 20);
  assert.equal(troop(partial, 'corpse').ammo, 192);
});

void test('transfer range, obstacles, capacity, quantities, and insufficient AP reject atomically', () => {
  const far = field({}, { x: 9 });
  rejectUnchanged(far, { type: 'transfer', targetId: 'q', item: AMMO });
  const wall = field({}, { x: 3 });
  Object.assign(present(wall.tiles.find((t) => t.x === 2 && t.y === 3)), {
    type: 'wall',
    blocked: true,
  });
  rejectUnchanged(wall, { type: 'transfer', targetId: 'q', item: AMMO });
  const full = field(
    {},
    { ammo: 240, priming: 0, flints: 0, rations: 0, medkits: 0, boleadoras: 0, torches: 0 },
  );
  rejectUnchanged(full, { type: 'transfer', targetId: 'q', item: AMMO });
  const poor = field();
  troop(poor).ap = 3;
  rejectUnchanged(poor, { type: 'transfer', targetId: 'q', item: AMMO });
  rejectUnchanged(poor, { type: 'drop', item: AMMO });
  for (const count of [0, -1, 1.5, NaN, 13]) {
    rejectUnchanged(field(), { type: 'transfer', targetId: 'q', item: AMMO, count });
  }
});

void test('a valid legacy overload can be reduced by dropping a large stack and remains saveable', () => {
  const state = field({
    ammo: 300,
    priming: 0,
    flints: 0,
    rations: 0,
    medkits: 0,
    boleadoras: 0,
    torches: 0,
  });
  assert.equal(inventoryUsage(troop(state)).used, 15);
  const next = order(state, { type: 'drop', item: AMMO, count: 60 });
  assert.equal(troop(next).ammo, 240);
  assert.equal(inventoryUsage(troop(next)).used, 12);
  assert.equal(present(next.groundItems[0]).count, 60);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

void test('a full campaign save preserves a dropped weapon and permits exactly one later pickup', () => {
  let campaign = dispatchCampaign(initialCampaign(), { type: 'travel', sector: 'buenos_aires' });
  campaign = enterAssault(campaign, 'san_nicolas');
  assert.equal(campaign.lastError, null);
  const request = campaign.pendingBattle;
  let battle = createBattle(
    present(request).squad.map((unit, index) => ({ ...unit, x: 1 + index, y: 1 })),
    {
      ...request,
      width: 24,
      height: 9,
      tiles: tiles(),
      seed: 45,
      enemies: [{ id: 'guard', x: 22, y: 7, overwatch: false }],
    },
  );
  const giverId = present(battle.units[0]).id,
    receiverId = present(battle.units[1]).id;
  present(battle.units[0]).weapon = 1800;
  present(battle.units[0]).loaded = 1;
  present(battle.units[0]).jammed = true;
  present(battle.units[0]).condition = 31;
  battle = order(battle, { type: 'drop', unitId: giverId, item: 'primary' });
  const pair = syncBattleTime(campaign, battle);
  assert.equal(pair.error, null);
  const saved = decodeSave(encodeSave(pair.campaign, pair.battle));
  assert.deepEqual(present(saved.battle).groundItems, pair.battle.groundItems);
  const groundId = present(present(present(saved.battle).groundItems[0]).id);
  const next = order(present(saved.battle), { type: 'loot', unitId: receiverId, groundId });
  const weapon = Object.values(troop(next, receiverId).inventory).find(
    (r): r is EquipmentItem =>
      typeof r !== 'number' && r.weapon === present(present(saved.battle).groundItems[0]).weapon,
  );
  assert.equal(present(weapon).condition, 31);
  assert.equal(present(weapon).jammed, true);
  assert.equal(present(weapon).loaded, 1);
  assert.equal(troop(next, giverId).weaponDropped, true);
  rejectUnchanged(next, { type: 'loot', unitId: receiverId, groundId });
});

void test('campaign reports and reentry retain dropped guns and the blade left in the other hand', () => {
  let campaign = dispatchCampaign(initialCampaign(), { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  let battle = enterSector(campaign.pendingBattle);
  const giver = troop(battle, '4');
  giver.condition = 26;
  giver.jammed = true;
  giver.inventory['legacy'] = { weapon: 1820, count: 3, weight: 0.7, loaded: 0, condition: 80 };
  giver.inventory['letters'] = 10001;
  battle = order(battle, { type: 'drop', unitId: '4', item: 'primary' });
  const originalGround = structuredClone(battle.groundItems[0]);
  const pair = syncBattleTime(campaign, battle);
  assert.equal(pair.error, null);
  campaign = dispatchCampaign(pair.campaign, {
    type: 'leaveSector',
    battleId: present(pair.campaign.pendingBattle).id,
    sectorState: pair.battle,
    survivors: pair.battle.units.filter((u) => u.side === 'player'),
  });
  assert.equal(campaign.lastError, null);
  assert.equal(present(campaign.operativeState[4]).weaponDropped, true);
  assert.equal(present(campaign.operativeState[4]).activeSlot, 'blade');
  const legacy = present(present(present(campaign.operativeState[4]).inventory)['legacy']);
  assert.ok(typeof legacy !== 'number');
  assert.equal(legacy.count, 3);
  campaign = decodeSave(encodeSave(campaign)).campaign;
  campaign = dispatchCampaign(campaign, { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  const revisited = enterSector(campaign.pendingBattle, campaign.sectorStates[campaign.location]);
  const returned = troop(revisited, '4');
  assert.equal(returned.weaponDropped, true);
  assert.equal(returned.loaded, 0);
  assert.equal(returned.activeSlot, 'blade');
  assert.deepEqual(returned.inventory['legacy'], {
    weapon: 1820,
    count: 3,
    weight: 0.7,
    loaded: 0,
    condition: 80,
  });
  assert.equal(returned.inventory['letters'], 10001);
  assert.deepEqual(revisited.groundItems[0], originalGround);
  assert.doesNotThrow(() => validateBattleSnapshot(revisited));
});

void test('campaign inventory validation preserves old overflow and rejects malformed metadata or duplicate identities', () => {
  assert.doesNotThrow(() =>
    validatePersonalInventory({
      letters: 10001,
      legacy: { count: 3, weapon: 55000, loaded: 0, condition: 80, weight: 0.7 },
    }),
  );
  const base = {
    weapon: 1800,
    count: 1,
    weight: 4,
    loaded: 1,
    condition: 40,
    jammed: true,
    instanceId: 'old-musket',
  };
  for (const change of [
    { weapon: 65536 },
    { weapon: 55000, loaded: 1 },
    { loaded: 2 },
    { condition: -1 },
    { jammed: 'yes' },
    { instanceId: {} },
    { count: 2 },
    { weight: undefined },
  ]) {
    assert.throws(() => validatePersonalInventory({ gun: { ...base, ...change } }));
  }
  assert.throws(() => validatePersonalInventory({ one: base, two: { ...base } }));
  assert.throws(() => validatePersonalInventory({ rope: { count: 1, weight: 1, condition: -1 } }));
  assert.throws(() => validatePersonalInventory({ rope: { count: 1, weight: 1, jammed: 'yes' } }));
  assert.throws(() => validatePersonalInventory(JSON.parse('{"__proto__":1}')));
  assert.throws(() => validatePersonalInventory({ letters: 1.5 }));
});

void test('campaign tool inventory validation shares canonical type, key, and condition rules', () => {
  const key = {
    count: 1,
    weight: 0.2,
    itemType: 'tool',
    toolKey: 'key',
    keyId: 'store',
    condition: 56,
  };
  assert.doesNotThrow(() =>
    validatePersonalInventory({
      key,
      legacy: { count: 3, weight: 0.7, weapon: 1820, loaded: 0, condition: 80 },
    }),
  );
  assert.doesNotThrow(() =>
    validatePersonalInventory({
      pliers: { count: 2, weight: 0.5, kind: 'tool', toolKey: 'pliers', condition: 40 },
    }),
  );
  for (const change of [
    { toolKey: 'unknown' },
    { keyId: '__proto__' },
    { condition: -1 },
    { condition: '100' },
    { weapon: 1800 },
    { keyId: {} },
  ]) {
    assert.throws(() => validatePersonalInventory({ key: { ...key, ...change } }));
  }
});
