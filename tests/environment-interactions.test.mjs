import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_TYPES, heldTool, environmentActionProfile, resolveEnvironmentInteraction, environmentTargetSummary, visibleContainerContents, extractContainerItem, validateEnvironment, authoredEnvironment} from '../game/environment-interactions.js';
import {inventoryUsage, applyItemQuantity, extractItemQuantity, itemDescriptor, validateItemStack} from '../game/tactical-inventory.js';
import {buildSectorMap} from '../game/maps.js';

const toolRecord = (toolKey, extra = {}) => ({count: 1, weight: TOOL_TYPES[toolKey].weight, itemType: 'tool', toolKey, condition: 100, ...extra});
const soldier = (toolKey, extra = {}) => ({id: 'p', side: 'player', hp: 100, energy: 100, ap: 100, mechanical: 80, dexterity: 80, strength: 80, wisdom: 80, experienceLevel: 6, activeSlot: toolKey ? 'tool' : 'unarmed', ...(toolKey ? {activeTool: `inventory:${toolKey}`} : {}), inventory: toolKey ? {[toolKey]: toolRecord(toolKey)} : {}, ...extra});
const door = (extra = {}) => ({id: 'door-a', type: 'door', open: false, locked: true, keyId: 'store', lockDifficulty: 30, lockIntegrity: 100, blocked: true, blocksSight: true, ...extra});
const chest = (extra = {}) => ({id: 'chest-a', type: 'chest', open: false, locked: false, contents: [{item: 'ammo', count: 12, weight: .04}], ...extra});
const trap = (extra = {}) => ({type: 'alarm', difficulty: 30, armed: true, discoveredBy: [], ...extra});

test('held tools require an owned marked record and the canonical equipped key', () => {
  const u = soldier('lockpick');
  assert.equal(heldTool(u).toolKey, 'lockpick');
  assert.equal(heldTool(u).item, 'inventory:lockpick');
  assert.equal(heldTool({...u, activeSlot: 'primary'}), null);
  assert.equal(heldTool({...u, activeTool: 'lockpick'}), null);
  assert.equal(heldTool({...u, inventory: {}}), null);
  assert.equal(heldTool({...u, inventory: {lockpick: {...u.inventory.lockpick, count: 0}}}), null);
  assert.equal(heldTool({...u, inventory: {lockpick: {...u.inventory.lockpick, itemType: undefined}}}), null);
  assert.equal(heldTool({...u, inventory: {lockpick: {...u.inventory.lockpick, itemType: undefined, kind: 'tool'}}}).toolKey, 'lockpick');
  assert.equal(Object.isFrozen(TOOL_TYPES.key), true);
});

test('correct keys unlock without consumption, wear, hidden RNG, or AP double spending', () => {
  const u = soldier('key', {inventory: {key: toolRecord('key', {keyId: 'store'})}}), target = door();
  const original = structuredClone({u, target}), profile = environmentActionProfile(u, target, 'unlock');
  assert.equal(profile.valid, true); assert.equal(profile.requiresRoll, false); assert.equal(profile.pa, 4);
  const result = resolveEnvironmentInteraction(u, target, {verb: 'unlock'});
  assert.equal(result.outcome, 'unlocked'); assert.equal(result.target.locked, false); assert.equal(result.target.open, false);
  assert.equal(result.unit.ap, 100); assert.deepEqual(result.unit.inventory, u.inventory);
  assert.deepEqual({u, target}, original);
  assert.equal(environmentActionProfile(soldier('key'), target, 'unlock').valid, false);
  assert.equal(environmentActionProfile({...u, activeSlot: 'unarmed'}, target, 'unlock').valid, false);
});

test('tool skill, difficulty and wear affect lock picking and impossible jobs reject before effects', () => {
  const expert = soldier('lockpick'), target = door();
  const high = environmentActionProfile(expert, target, 'pick');
  const low = environmentActionProfile({...expert, mechanical: 30}, target, 'pick');
  const worn = environmentActionProfile({...expert, inventory: {lockpick: toolRecord('lockpick', {condition: 25})}}, target, 'pick');
  assert.ok(high.chance > low.chance); assert.ok(high.chance > worn.chance);
  assert.ok(high.chance > environmentActionProfile(expert, {...target, lockDifficulty: 80}, 'pick').chance);
  assert.equal(environmentActionProfile({...expert, mechanical: 0}, target, 'pick').valid, false);
  assert.throws(() => resolveEnvironmentInteraction({...expert, mechanical: 0}, target, {verb: 'pick', roll: 0}), /habilidad/);
  assert.equal(environmentActionProfile({...expert, inventory: {lockpick: toolRecord('lockpick', {condition: 0})}}, target, 'pick').valid, false);
});

test('successful and failed lock picks both wear one tool and conserve input state', () => {
  const u = soldier('lockpick'), target = door(), before = structuredClone({u, target});
  const success = resolveEnvironmentInteraction(u, target, {verb: 'pick', roll: 0});
  const failure = resolveEnvironmentInteraction(u, target, {verb: 'pick', roll: 1});
  assert.equal(success.target.locked, false); assert.equal(success.outcome, 'unlocked');
  assert.equal(failure.target.locked, true); assert.equal(failure.outcome, 'failed');
  for (const result of [success, failure]) {assert.equal(result.unit.inventory.lockpick.condition, 98); assert.equal(result.pa, 16); assert.equal(result.unit.ap, u.ap);}
  assert.deepEqual({u, target}, before);
});

test('force and crowbar attempts use strength and leave persistent lock damage', () => {
  let target = door(); const u = soldier('crowbar');
  const profile = environmentActionProfile(u, target, 'pry');
  assert.ok(profile.chance > environmentActionProfile({...u, strength: 20}, target, 'pry').chance);
  const first = resolveEnvironmentInteraction(u, target, {verb: 'pry', roll: 0});
  assert.equal(first.outcome, 'lock-damaged'); assert.ok(first.target.lockIntegrity < 100); assert.equal(first.target.locked, true);
  assert.equal(first.noiseKind, 'melee'); assert.equal(first.unit.inventory.crowbar.condition, 97);
  const second = resolveEnvironmentInteraction(first.unit, first.target, {verb: 'pry', roll: 0});
  assert.equal(second.outcome, 'lock-broken'); assert.equal(second.target.locked, false); assert.equal(second.target.lockIntegrity, 0);
  const forced = resolveEnvironmentInteraction(soldier(), target, {verb: 'force', roll: 0});
  assert.equal(forced.pa, 24); assert.ok(forced.target.lockIntegrity > first.target.lockIntegrity);
  const failed = resolveEnvironmentInteraction(u, target, {verb: 'pry', roll: 1});
  assert.equal(failed.target.lockIntegrity, 100); assert.equal(failed.unit.inventory.crowbar.condition, 97);
});

test('door collision tracks opening and closing while a broken latch remains closable', () => {
  const u = soldier(), opened = resolveEnvironmentInteraction(u, door({locked: false, broken: true}), {verb: 'open'});
  assert.equal(opened.target.open, true); assert.equal(opened.target.blocked, false); assert.equal(opened.target.blocksSight, false);
  const closed = resolveEnvironmentInteraction(u, opened.target, {verb: 'close'});
  assert.equal(closed.target.open, false); assert.equal(closed.target.blocked, true); assert.equal(closed.target.broken, true);
  assert.equal(environmentActionProfile(u, door(), 'open').valid, false);
  assert.equal(environmentActionProfile(u, door(), 'close').valid, false);
});

test('unknown trap and absent trap expose equal summaries and inspection/disarm previews', () => {
  const u = soldier('pliers'), ordinary = chest(), hidden = {...ordinary, trap: trap({difficulty: 99})};
  assert.deepEqual(environmentTargetSummary(u, hidden), environmentTargetSummary(u, ordinary));
  assert.deepEqual(environmentActionProfile(u, hidden, 'inspect'), environmentActionProfile(u, ordinary, 'inspect'));
  assert.deepEqual(environmentActionProfile(u, hidden, 'disarm'), environmentActionProfile(u, ordinary, 'disarm'));
  assert.equal(environmentActionProfile(u, hidden, 'inspect').chance, null);
  assert.equal(environmentActionProfile(u, hidden, 'inspect').requiresRoll, true);
  const absent = resolveEnvironmentInteraction(u, ordinary, {verb: 'inspect', roll: 1});
  const undetected = resolveEnvironmentInteraction(u, hidden, {verb: 'inspect', roll: 1});
  assert.equal(absent.message, undetected.message); assert.equal(absent.outcome, undetected.outcome);
  assert.equal(undetected.target.trap.discoveredBy.length, 0); assert.equal(undetected.trapTriggered, false);
});

test('trap discovery is uncertain and belongs to the observing side only', () => {
  const u = soldier('pliers'), hidden = chest({trap: trap()}), found = resolveEnvironmentInteraction(u, hidden, {verb: 'inspect', roll: 0});
  assert.equal(found.outcome, 'trap-found'); assert.deepEqual(found.target.trap.discoveredBy, ['player']);
  assert.deepEqual(environmentTargetSummary(u, found.target).trap, {type: 'alarm', armed: true});
  assert.equal(environmentTargetSummary({...u, side: 'enemy'}, found.target).trap, undefined);
  assert.equal(environmentTargetSummary(u, found.target).contents, undefined);
  assert.equal(found.unit.inventory.pliers.condition, 100);
  assert.deepEqual(hidden.trap.discoveredBy, []);
});

test('successful disarm uses held pliers and skill, consumes wear, and persists across reopen', () => {
  const u = soldier('pliers'), target = chest({trap: trap({discoveredBy: ['player']})});
  assert.equal(environmentActionProfile(soldier(), target, 'disarm').valid, false);
  assert.equal(environmentActionProfile({...u, mechanical: 0}, target, 'disarm').valid, false);
  const result = resolveEnvironmentInteraction(u, target, {verb: 'disarm', roll: 0});
  assert.equal(result.outcome, 'disarmed'); assert.equal(result.target.trap.armed, false); assert.equal(result.unit.inventory.pliers.condition, 98);
  assert.equal(result.damage, 0); assert.equal(result.breathLoss, 0);
  const open = resolveEnvironmentInteraction(result.unit, result.target, {verb: 'open'});
  assert.equal(open.target.open, true); assert.equal(open.trapTriggered, false);
  assert.equal(environmentActionProfile(u, open.target, 'disarm').valid, false);
});

test('failed disarm triggers a finite alarm once; repeat manipulation cannot trigger it again', () => {
  const u = soldier('pliers'), target = chest({trap: trap({discoveredBy: ['player']})});
  const failed = resolveEnvironmentInteraction(u, target, {verb: 'disarm', roll: 1});
  assert.equal(failed.outcome, 'alarm-triggered'); assert.equal(failed.noiseKind, 'alarm');
  assert.equal(failed.target.trap.armed, false); assert.equal(failed.target.open, false); assert.equal(failed.damage, 0);
  const opened = resolveEnvironmentInteraction(failed.unit, failed.target, {verb: 'open'});
  assert.equal(opened.target.open, true); assert.equal(opened.trapTriggered, false);
});

test('unexamined manipulation triggers injury once and returns effects without applying HP or AP', () => {
  const u = soldier('lockpick'), target = door({trap: trap({type: 'injury', damage: 18, breathLoss: 25})});
  const result = resolveEnvironmentInteraction(u, target, {verb: 'pick', roll: 0});
  assert.equal(result.outcome, 'injury-triggered'); assert.equal(result.target.locked, true);
  assert.equal(result.target.trap.armed, false); assert.equal(result.damage, 18); assert.equal(result.breathLoss, 25);
  assert.equal(result.unit.hp, u.hp); assert.equal(result.unit.energy, u.energy); assert.equal(result.unit.ap, u.ap);
  assert.equal(result.unit.inventory.lockpick.condition, 98);
  const retry = resolveEnvironmentInteraction(result.unit, result.target, {verb: 'pick', roll: 0});
  assert.equal(retry.target.locked, false); assert.equal(retry.damage, 0); assert.equal(retry.trapTriggered, false);
});

test('contents stay hidden until opened; partial removal and later reopen conserve every unit', () => {
  const target = chest(), before = structuredClone(target);
  assert.deepEqual(visibleContainerContents(target), []);
  assert.equal(environmentTargetSummary(soldier(), target).contents, undefined);
  assert.throws(() => extractContainerItem(target, 0, 1), /Abrí/);
  const opened = resolveEnvironmentInteraction(soldier(), target, {verb: 'open'}).target;
  const part = extractContainerItem(opened, 0, 5);
  assert.equal(part.stack.count, 5); assert.equal(part.target.contents[0].count, 7);
  const closed = resolveEnvironmentInteraction(soldier(), part.target, {verb: 'close'}).target;
  const reopened = resolveEnvironmentInteraction(soldier(), closed, {verb: 'open'}).target;
  const rest = extractContainerItem(reopened, 0, 7);
  assert.equal(rest.stack.count + part.stack.count, 12); assert.deepEqual(rest.target.contents, []);
  assert.throws(() => extractContainerItem(rest.target, 0, 1), /ya no/);
  assert.deepEqual(target, before);
});

test('container weapon extraction preserves identity, load, condition, jam and detached metadata', () => {
  const target = chest({open: true, contents: [{item: 'weapon', count: 1, weight: 4, weapon: 1800, loaded: 1, condition: 43, jammed: true, instanceId: 'captured-a', note: {origin: 'cache'}}]});
  const extracted = extractContainerItem(target, 0);
  assert.deepEqual(extracted.stack, target.contents[0]); assert.equal(extracted.target.contents.length, 0);
  extracted.stack.note.origin = 'changed'; assert.equal(target.contents[0].note.origin, 'cache');
  const visible = visibleContainerContents(target); visible[0].count = 100; assert.equal(target.contents[0].count, 1);
});

test('validation rejects malformed trap/lock/container state and bad rolls without mutation', () => {
  const target = chest({trap: trap()}), u = soldier('pliers'), before = structuredClone({target, u});
  for (const roll of [undefined, NaN, -1, 1.1, '0']) assert.throws(() => resolveEnvironmentInteraction(u, target, {verb: 'inspect', roll}), /tirada/);
  for (const bad of [door({open: true}), door({lockDifficulty: NaN}), chest({contents: {}}), chest({contents: [{item: 'ammo', count: 0}]}), chest({trap: trap({type: 'explosive'})}), chest({trap: trap({discoveredBy: ['player', 'player']})}), chest({trap: trap({damage: Infinity})})]) assert.throws(() => validateEnvironment(bad));
  const identified = {item: 'inventory:letter', count: 1, weight: 0, instanceId: 'one'};
  assert.throws(() => validateEnvironment(chest({contents: [identified, identified]})), /repetido/);
  assert.deepEqual({target, u}, before);
});

test('finite tools occupy individual slots and transfer condition without stacking or duplication', () => {
  const source = soldier('lockpick', {inventory: {lockpick: toolRecord('lockpick', {count: 2, condition: 63})}});
  assert.equal(inventoryUsage(source).used, 2); assert.equal(itemDescriptor(source, 'inventory:lockpick').label, 'Ganzúas');
  const extracted = extractItemQuantity(source, 'inventory:lockpick', 2), received = applyItemQuantity(soldier(), extracted.stack);
  assert.equal(extracted.unit.activeSlot, 'unarmed'); assert.equal(extracted.unit.activeTool, undefined);
  assert.equal(Object.keys(received.inventory).length, 2);
  for (const record of Object.values(received.inventory)) {assert.equal(record.count, 1); assert.equal(record.condition, 63); assert.equal(record.toolKey, 'lockpick');}
  assert.equal(inventoryUsage(received).used, 2);
  assert.equal(inventoryUsage(soldier('crowbar')).used, 1);
});

test('wear of a legacy tool stack affects only one tool and retains its equipped identity', () => {
  const u = soldier('lockpick', {inventory: {lockpick: toolRecord('lockpick', {count: 3})}});
  const result = resolveEnvironmentInteraction(u, door(), {verb: 'pick', roll: 1});
  assert.equal(result.unit.inventory.lockpick.count, 2); assert.equal(result.unit.inventory.lockpick.condition, 100);
  assert.equal(result.unit.inventory['lockpick:1'].count, 1); assert.equal(result.unit.inventory['lockpick:1'].condition, 98);
  assert.equal(result.unit.activeTool, 'inventory:lockpick:1'); assert.equal(heldTool(result.unit).condition, 98);
  assert.equal(inventoryUsage(result.unit).used, 3); assert.equal(u.inventory.lockpick.count, 3);
});

test('invalid tool metadata is rejected at the shared item persistence boundary', () => {
  const stack = {item: 'inventory:key', ...toolRecord('key', {keyId: 'store'})};
  assert.equal(validateItemStack(stack), true);
  assert.throws(() => validateItemStack({...stack, toolKey: 'explosive'}), /herramienta/);
  assert.throws(() => validateItemStack({...stack, keyId: '__proto__'}), /clave/);
  assert.throws(() => validateItemStack({...stack, weapon: 1800}), /herramienta/);
  assert.throws(() => validateItemStack({...stack, condition: -1}), /condición/);
});

test('authored caches reuse existing map IDs and give tools before any required lock', () => {
  const map = buildSectorMap({sector: 'yatasto'}), before = structuredClone(map), authored = authoredEnvironment('yatasto', map);
  assert.equal(authored.containers.length, 1); assert.equal(authored.containers[0].locked, false); assert.equal(authored.containers[0].trap, undefined);
  assert.equal(map.tiles.find(tile => tile.doorId === 'yatasto:door-left').open, true);
  assert.equal(authored.doors.length, 1); assert.equal(authored.doors[0].id, 'yatasto:door-right');
  assert.ok(map.props.some(prop => prop.id === authored.containers[0].id));
  let unit = soldier();
  for (const item of authored.containers[0].contents) unit = applyItemQuantity(unit, item);
  assert.equal(inventoryUsage(unit).used, 4);
  const key = Object.entries(unit.inventory).find(([, record]) => record.toolKey === 'key');
  unit.activeSlot = 'tool'; unit.activeTool = `inventory:${key[0]}`;
  assert.equal(environmentActionProfile(unit, authored.doors[0], 'unlock').valid, true);
  assert.deepEqual(map, before);
  const mendoza = authoredEnvironment('mendoza', buildSectorMap({sector: 'mendoza'}));
  assert.equal(mendoza.containers.length, 1); assert.equal(mendoza.containers[0].locked, true); assert.equal(mendoza.containers[0].trap.type, 'alarm');
  for (const record of [...authored.containers, ...authored.doors, ...mendoza.containers]) validateEnvironment(record);
  assert.deepEqual(authoredEnvironment('retiro', buildSectorMap({sector: 'retiro'})), {doors: [], containers: []});
});
