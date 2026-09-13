import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
const AMMO='inventory:ammo:musket_75';
const ammoStack=count=>({item:AMMO,kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count,weight:.04});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, getReachable, environmentTargetAt, environmentPreview, containerLootPreview} from '../game/tactical.js';
import {environmentTargetSummary, heldTool} from '../game/environment-interactions.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave, decodeSave} from '../game/save.js';

const keyRecord = {count: 1, weight: .2, itemType: 'tool', toolKey: 'key', condition: 73, keyId: 'store'};
const toolRecord = toolKey => ({count: 1, weight: .5, itemType: 'tool', toolKey, condition: 100});
const soldier = state => state.units.find(u => u.id === 'p');
function field(extra = {}, chestExtra = {}) {
  const tiles = Array.from({length: 216}, (_, i) => ({x: i % 24, y: Math.floor(i / 24), type: 'grass', blocked: false, cover: 0}));
  Object.assign(tiles.find(t => t.x === 2 && t.y === 3), {type: 'door', doorId: 'test-door', open: false, locked: true, keyId: 'store', lockDifficulty: 25, lockIntegrity: 100, blocked: true, blocksSight: true});
  return createBattle([{id: 'p', x: 1, y: 3, mechanical: 90, dexterity: 90, wisdom: 90, experienceLevel: 8, inventory: {key: {...keyRecord}}, ...extra}], {width: 24, height: 9, tiles, seed: 45,
    props: [{id: 'test-chest', type: 'chest', x: 1, y: 4, blocksMovement: true, open: false, locked: false, contents: [ammoStack(12)], ...chestExtra}],
    enemies: [{id: 'guard', x: 22, y: 7, overwatch: false}]});
}
function order(state, action, id = 'p') {
  const next = actBattle(state, {unitId: id, ...action});
  assert.equal(next.lastError, null, `${action.type}: ${next.lastError}`);
  return next;
}
function rejectUnchanged(state, action) {
  const next = actBattle(state, {unitId: 'p', ...action});
  assert.ok(next.lastError);
  for (const key of ['units', 'tiles', 'props', 'groundItems', 'seed', 'elapsedSeconds']) assert.deepEqual(next[key], state[key], key);
  return next;
}
const doorRef = {kind: 'door', id: 'test-door'}, chestRef = {kind: 'container', id: 'test-chest'};

test('actual held key actions pay equip/unlock/open once and persist door collision', () => {
  let state = field(); const original = structuredClone(state);
  assert.equal(environmentPreview(state, soldier(state), doorRef, 'unlock').valid, false);
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:key'});
  assert.equal(soldier(state).activeSlot, 'tool'); assert.equal(heldTool(soldier(state)).condition, 73);
  const ap = soldier(state).ap, seed = state.seed;
  state = order(state, {type: 'useItem', environment: {...doorRef, verb: 'unlock'}});
  assert.equal(soldier(state).ap, ap - 4); assert.equal(state.seed, seed);
  state = order(state, {type: 'environment', ...doorRef, verb: 'open'});
  const opened = state.tiles.find(t => t.doorId === doorRef.id);
  assert.equal(opened.open, true); assert.equal(opened.locked, false); assert.equal(opened.blocked, false); assert.equal(opened.blocksSight, false);
  assert.equal(soldier(state).inventory.key.condition, 73); assert.equal(soldier(state).inventory.key.count, 1);
  assert.equal(soldier(state).ap, ap - 8);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
  assert.equal(original.tiles.find(t => t.doorId === doorRef.id).locked, true);
});

test('illegal environment commands reject atomically before RNG, wear, AP, contents or time', () => {
  const state = field({activeSlot: 'tool', activeTool: 'inventory:key'});
  rejectUnchanged(state, {type: 'environment', ...doorRef, verb: 'pick'});
  rejectUnchanged(state, {type: 'environment', ...doorRef, verb: 'open'});
  rejectUnchanged(state, {type: 'environment', ...chestRef, verb: 'disarm'});
  rejectUnchanged({...state, units: state.units.map(u => u.id === 'p' ? {...u, ap: 3} : u)}, {type: 'environment', ...doorRef, verb: 'unlock'});
  rejectUnchanged({...state, units: state.units.map(u => u.id === 'p' ? {...u, x: 10} : u)}, {type: 'environment', ...doorRef, verb: 'unlock'});
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 1});
});

test('closed target summaries and inspection previews keep trap and contents private', () => {
  const normal = field(), hidden = field({}, {trap: {type: 'alarm', difficulty: 60, armed: true, discoveredBy: []}});
  const a = environmentTargetAt(normal, {x: 1, y: 4}), b = environmentTargetAt(hidden, {x: 1, y: 4});
  assert.equal(a.kind, 'container'); assert.deepEqual(environmentTargetSummary(soldier(normal), a), environmentTargetSummary(soldier(hidden), b));
  assert.equal(environmentTargetSummary(soldier(hidden), b).contents, undefined);
  assert.deepEqual(environmentPreview(normal, soldier(normal), chestRef, 'inspect'), environmentPreview(hidden, soldier(hidden), chestRef, 'inspect'));
  assert.equal(environmentPreview(hidden, soldier(hidden), chestRef, 'inspect').chance, null);
});

test('actual hidden injury trap uses shared wounds and breath once, with no free opening', () => {
  let state = field({}, {trap: {type: 'injury', difficulty: 40, armed: true, discoveredBy: [], damage: 18, breathLoss: 25}});
  state = order(state, {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(soldier(state).hp, 82); assert.equal(soldier(state).energy, 75); assert.ok(soldier(state).bleeding > 0);
  assert.equal(soldier(state).ap, 96); assert.equal(state.props[0].trap.armed, false); assert.equal(state.props[0].open, false);
  assert.deepEqual(state.props[0].trap.discoveredBy, ['player']);
  state = order(state, {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(soldier(state).hp, 82); assert.equal(state.props[0].open, true);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

test('actual trap examination and disarm use one RNG draw and worn held pliers', () => {
  let state = field({inventory: {pliers: toolRecord('pliers')}, activeSlot: 'tool', activeTool: 'inventory:pliers'}, {trap: {type: 'alarm', difficulty: 0, armed: true, discoveredBy: []}});
  const initial = structuredClone(state);
  state = order(state, {type: 'environment', ...chestRef, verb: 'inspect'});
  assert.equal(state.seed, 1088807848); assert.equal(soldier(state).ap, 96);
  assert.deepEqual(state.props[0].trap.discoveredBy, ['player']);
  assert.equal(soldier(state).inventory.pliers.condition, 100);
  const preview = environmentPreview(state, soldier(state), chestRef, 'disarm'); assert.equal(preview.valid, true);
  state = order(state, preview.action);
  assert.equal(state.seed, 1547203303);
  assert.equal(soldier(state).ap, 78); assert.equal(soldier(state).inventory.pliers.condition, 98); assert.equal(state.props[0].trap.armed, false);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
  assert.equal(initial.props[0].trap.armed, true);
});

test('partial container acquisition, capacity rejection and repeat pickup conserve contents', () => {
  let state = order(field({ammo: 238, priming: 0, flints: 0, medkits: 0, rations: 0, boleadoras: 0, torches: 0, inventory: {}}), {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(inventoryUsage(soldier(state)).used, 12);
  assert.equal(containerLootPreview(state, soldier(state), chestRef, 0, 3).valid, false);
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 3});
  state = order(state, {type: 'containerLoot', ...chestRef, index: 0, count: 2});
  assert.equal(soldier(state).ammo, 240); assert.equal(state.props[0].contents[0].count, 10); assert.equal(soldier(state).ap, 88);
  state = order(state, {type: 'drop', item: AMMO, count: 20});
  state = order(state, {type: 'containerLoot', ...chestRef, index: 0, count: 10});
  assert.equal(soldier(state).ammo, 230); assert.equal(state.groundItems[0].count, 20); assert.deepEqual(state.props[0].contents, []);
  assert.equal(soldier(state).ammo + state.groundItems[0].count, 250);
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 1});
});

test('dropping the actual equipped tool clears the hand and finite pickup retains its condition', () => {
  let state = field({activeSlot: 'tool', activeTool: 'inventory:key'});
  state = order(state, {type: 'drop', item: 'inventory:key'});
  assert.equal(soldier(state).activeSlot, 'unarmed'); assert.equal(soldier(state).activeTool, undefined);
  assert.equal(state.groundItems[0].condition, 73); assert.equal(state.groundItems[0].keyId, 'store');
  state = order(state, {type: 'loot', groundId: state.groundItems[0].id});
  assert.equal(soldier(state).inventory.key.condition, 73); assert.equal(soldier(state).activeSlot, 'unarmed');
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

function approach(state, id, target) {
  const u = state.units.find(unit => unit.id === String(id));
  const distance = p => Math.hypot(p.x - target.x, p.y - target.y);
  const point = getReachable(state, u).filter(p => distance(p) <= 1.5).sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
  assert.ok(point, `A legal route must reach ${target.id ?? target.doorId}.`);
  return point.cost ? order(state, {type: 'move', x: point.x, y: point.y}, id) : state;
}

test('Yatasto tools can be acquired through a legal open-door path and its key unlocks the other leaf', () => {
  const request = {id: 'cache-visit', sector: 'yatasto', sceneId: 'yatasto', exploration: true, hour: 12, squad: [{id: 'p', mechanical: 80, dexterity: 80, strength: 80}]};
  let state = enterSector(request);
  const chest = state.props.find(p => p.type === 'chest'); assert.ok(chest);
  assert.equal(state.tiles.find(t => t.doorId === 'yatasto:door-left').open, true);
  const ref = {kind: 'container', id: chest.id};
  state = approach(state, 'p', chest);
  state = order(state, {type: 'environment', ...ref, verb: 'open'});
  while (state.props.find(p => p.id === chest.id).contents.length) state = order(state, {type: 'containerLoot', ...ref, index: 0, count: 1});
  assert.equal(inventoryUsage(soldier(state)).used, 11);
  assert.deepEqual(Object.values(soldier(state).inventory).filter(item => item.toolKey).map(item => item.toolKey).sort(), ['crowbar', 'key', 'lockpick', 'pliers']);
  const right = state.tiles.find(t => t.doorId === 'yatasto:door-right');
  state = approach(state, 'p', right);
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:key'});
  state = order(state, {type: 'environment', kind: 'door', id: right.doorId, verb: 'unlock'});
  assert.equal(state.tiles.find(t => t.doorId === right.doorId).locked, false);
  const validated = validateBattleSnapshot(state);
  const returned = enterSector({...request, squad: validated.units.filter(u => u.side === 'player')}, validated);
  assert.deepEqual(returned.props.find(p => p.id === chest.id).contents, []);
  assert.equal(returned.tiles.find(t => t.doorId === right.doorId).locked, false);
  assert.equal(soldier(returned).activeTool, 'inventory:key');
});

test('full campaign report/save/reentry retains a worn active tool without regenerating it', () => {
  let campaign = dispatchCampaign(initialCampaign(), {type: 'visitSector'});
  assert.equal(campaign.lastError, null);
  let state = enterSector(campaign.pendingBattle), u = state.units.find(unit => unit.id === '4');
  u.inventory.pliers = toolRecord('pliers'); u.inventory.pliers.condition = 39;
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:pliers'}, '4');
  let pair = syncBattleTime(campaign, state); assert.equal(pair.error, null);
  pair = decodeSave(encodeSave(pair.campaign, pair.battle));
  assert.equal(pair.battle.units.find(unit => unit.id === '4').activeTool, 'inventory:pliers');
  campaign = dispatchCampaign(pair.campaign, {type: 'leaveSector', battleId: pair.campaign.pendingBattle.id, sectorState: pair.battle, survivors: pair.battle.units.filter(unit => unit.side === 'player')});
  assert.equal(campaign.lastError, null);
  assert.equal(campaign.operativeState[4].activeSlot, 'tool'); assert.equal(campaign.operativeState[4].activeTool, 'inventory:pliers');
  campaign = decodeSave(encodeSave(campaign)).campaign;
  campaign = dispatchCampaign(campaign, {type: 'visitSector'}); assert.equal(campaign.lastError, null);
  state = enterSector(campaign.pendingBattle, campaign.sectorStates[campaign.location]);
  u = state.units.find(unit => unit.id === '4');
  assert.equal(u.activeTool, 'inventory:pliers'); assert.equal(heldTool(u).condition, 39); assert.equal(u.inventory.pliers.count, 1);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

test('save validation rejects duplicate container identities and malformed hidden state or tools', () => {
  const state = field({inventory: {letter: {count: 1, weight: 0, instanceId: 'letter-one'}}}, {contents: [{item: 'inventory:letter', count: 1, weight: 0, instanceId: 'letter-one'}]});
  assert.throws(() => validateBattleSnapshot(state), /identidad/);
  const malformed = field({}, {trap: {type: 'alarm', difficulty: -1, armed: true, discoveredBy: []}});
  assert.throws(() => validateBattleSnapshot(malformed), /dificultad/);
  const tool = field({activeSlot: 'tool', activeTool: 'inventory:key'}); tool.units[0].inventory.key.keyId = '__proto__';
  assert.throws(() => validateBattleSnapshot(tool));
});
