import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, actionCosts, medicalUsePreview, supplyUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {CRITICAL_HEALTH} from '../game/tactical-condition.js';

const field = (unit = {}, sector = {}) => createBattle([
  {id: 'p', x: 2, y: 2, facing: 2, weapon: 1800, loaded: 1, ammo: 9, hp: 80, bleeding: 2, medical: 80, energy: 65, fatigue: 15, medkits: 3, rations: 3, torches: 3, boleadoras: 3, ...unit},
  {id: 'ally', x: 2, y: 3},
], {
  id: 'held-item-admission', width: 20, height: 8, seed: 45,
  tiles: Array.from({length: 160}, (_, i) => ({x: i % 20, y: Math.floor(i / 20), type: 'grass', cover: 0, blocked: false})),
  enemies: [{id: 'e', x: 7, y: 2, facing: 6, overwatch: false}], ...sector,
});
const person = (s, id = 'p') => s.units.find(u => u.id === id);
const unchangedState = s => { const copy = structuredClone(s); delete copy.lastError; delete copy.log; return copy; };
function order(s, action) {
  const original = structuredClone(s), next = actBattle(s, {unitId: 'p', ...action});
  assert.equal(next.lastError, null, next.lastError);
  assert.deepEqual(s, original, 'the input snapshot is not mutated');
  assert.doesNotThrow(() => validateBattleSnapshot(next));
  return next;
}
function reject(s, action) {
  const original = structuredClone(s), next = actBattle(s, {unitId: 'p', ...action});
  assert.ok(next.lastError, `${action.type} must reject`);
  assert.deepEqual(unchangedState(next), unchangedState(s), 'rejection preserves AP, clock, RNG, equipment and continuation');
  assert.deepEqual(s, original);
  return next;
}
const uses = [
  {name: 'dressings', alias: 'heal', slot: 'medical', item: 'medkits', target: {targetId: 'p'}},
  {name: 'rations', alias: 'ration', slot: 'supply', item: 'rations', target: {targetId: 'p'}},
  {name: 'torches', alias: 'throwTorch', slot: 'supply', item: 'torches', target: {x: 5, y: 3}},
  {name: 'boleadoras', alias: 'boleadoras', slot: 'supply', item: 'boleadoras', target: {targetId: 'e'}},
];
const equip = use => ({type: 'weapon', slot: use.slot, ...(use.slot === 'supply' ? {supplyKey: use.item} : {})});
const holding = use => ({activeSlot: use.slot, ...(use.slot === 'supply' ? {activeSupply: use.item} : {})});
function preview(s, use) {
  const target = use.target.targetId ? person(s, use.target.targetId) : use.target;
  return use.slot === 'medical' ? medicalUsePreview(s, person(s), target) : supplyUsePreview(s, person(s), target, use.item);
}

test('direct healing and supply aliases reject the wrong hand without spending time, AP, RNG or items', () => {
  for (const mode of ['combat', 'exploration']) {
    // Facing away keeps exploration free of contact while retaining a real, reachable torch target.
    const s = mode === 'combat' ? field() : field({facing: 6}, {exploration: true, enemies: [{id: 'e', x: 19, y: 7, facing: 2, overwatch: false}]});
    assert.equal(s.mode, mode);
    for (const use of uses) {
      assert.equal(preview(s, use).allowed, false, `${use.name} requires its held item`);
      reject(s, {type: use.alias, ...use.target});
    }
  }
});

test('holding one supply does not admit aliases for a different supply or for medical care', () => {
  for (const held of uses.filter(use => use.slot === 'supply')) {
    const s = field(holding(held));
    for (const use of uses.filter(use => use !== held)) {
      assert.equal(preview(s, use).allowed, false);
      reject(s, {type: use.alias, ...use.target});
    }
  }
});

for (const use of uses) test(`held ${use.name}: the legacy alias and ordinary useItem have identical finite effects`, () => {
  const s = field(holding(use)), cost = preview(s, use).cost, before = person(s);
  assert.equal(preview(s, use).allowed, true);
  const alias = order(s, {type: use.alias, ...use.target}), ordinary = order(s, {type: 'useItem', ...use.target});
  assert.deepEqual(alias, ordinary);
  assert.equal(person(alias).ap, before.ap - cost);
  assert.equal(person(alias)[use.item], before[use.item] - 1);
  assert.equal(person(alias).activeSlot, use.slot);
  assert.equal(person(alias).activeSupply, holding(use).activeSupply);
  assert.equal(person(alias).loaded, before.loaded);
  assert.equal(person(alias).ammo, before.ammo);
  assert.equal(alias.seed, s.seed);
  if (use.slot === 'medical') {
    assert.equal(person(alias).bleeding, 0);
    assert.equal(person(alias).hp, before.hp);
  }
});

test('selection needs its own 4 AP and cannot borrow the following item-use budget', () => {
  for (const use of uses) {
    const s = field(), selectionCost = actionCosts(s, person(s)).weapon;
    assert.equal(selectionCost, 4);
    person(s).ap = selectionCost - 1;
    reject(s, equip(use));
    person(s).ap = selectionCost;
    const selected = order(s, equip(use));
    assert.equal(person(selected).ap, 0);
    assert.equal(person(selected)[use.item], person(s)[use.item]);
    reject(selected, {type: 'useItem', ...use.target});
    const onlyUse = field();
    person(onlyUse).ap = preview(field(holding(use)), use).cost;
    reject(onlyUse, {type: use.alias, ...use.target});
    reject(order(onlyUse, equip(use)), {type: 'useItem', ...use.target});
  }
});

test('selection plus use pays both costs and leaves the selected item in hand until another paid change', () => {
  for (const use of uses) {
    const s = field(), selectionCost = actionCosts(s, person(s)).weapon, useCost = preview(field(holding(use)), use).cost;
    person(s).ap = selectionCost + useCost;
    const selected = order(s, equip(use)), used = order(selected, {type: 'useItem', ...use.target});
    assert.equal(person(used).ap, 0);
    assert.equal(person(used).activeSlot, use.slot);
    assert.equal(person(used).activeSupply, holding(use).activeSupply);
    assert.equal(person(used).loaded, 1);
    assert.equal(person(used).ammo, 9);
    reject(used, {type: 'weapon', slot: 'primary'});
    const full = field();
    const restored = order(order(order(full, equip(use)), {type: 'useItem', ...use.target}), {type: 'weapon', slot: 'primary'});
    assert.equal(person(restored).ap, person(full).ap - useCost - selectionCost * 2);
    assert.equal(person(restored).activeSlot, 'primary');
  }
});

test('a knocked-down soldier can use aid or rations only when that item is already held', () => {
  for (const use of uses.slice(0, 2)) {
    const wrongHand = field({knockedDown: true});
    assert.equal(preview(wrongHand, use).allowed, false);
    reject(wrongHand, {type: use.alias, ...use.target});
    reject(wrongHand, equip(use));
    const held = field({...holding(use), knockedDown: true});
    assert.equal(preview(held, use).allowed, true);
    const n = order(held, {type: 'useItem', ...use.target});
    assert.deepEqual(n, order(held, {type: use.alias, ...use.target}));
    assert.equal(person(n).knockedDown, true);
    assert.equal(person(n)[use.item], person(held)[use.item] - 1);
  }
});

test('exploration selection advances bleeding before treatment and cannot rescue a collapsed medic through a shortcut', () => {
  const s = field({hp: CRITICAL_HEALTH, bleeding: 1}, {exploration: true, enemies: []});
  s.bleedSeconds = COMBAT_ROUND_SECONDS - 1;
  reject(s, {type: 'heal', targetId: 'p'});
  const selected = order(s, {type: 'weapon', slot: 'medical'});
  assert.equal(selected.elapsedSeconds - s.elapsedSeconds, 1);
  assert.equal(person(selected).hp, CRITICAL_HEALTH - 1);
  assert.equal(person(selected).unconscious, true);
  assert.equal(person(selected).bleeding, 1);
  assert.equal(person(selected).medkits, person(s).medkits);
  assert.equal(person(selected).activeSlot, 'medical');
  reject(selected, {type: 'useItem', targetId: 'p'});
  const resumed = validateBattleSnapshot(JSON.parse(JSON.stringify(selected)));
  assert.deepEqual(actBattle(resumed, {type: 'useItem', unitId: 'p', targetId: 'p'}), actBattle(selected, {type: 'useItem', unitId: 'p', targetId: 'p'}));
});

test('a real interrupt pays medical selection and use once and resumes from a saved remaining budget', () => {
  // A sabre preserves the approaching-enemy trigger; a facon can now throw.
  const s = field({x: 1, y: 1, agility: 95}, {enemies: [{id: 'e', x: 7, y: 1, weapon: 1809, overwatch: false}]});
  person(s).ap = 32;
  person(s, 'ally').ap = 0;
  person(s, 'e').ap = 24;
  const paused = endTurn(s);
  assert.equal(paused.phase, 'interrupt');
  assert.deepEqual(paused.interrupt.unitIds, ['p']);
  assert.equal(medicalUsePreview(paused, person(paused)).allowed, false);
  reject(paused, {type: 'heal', targetId: 'p'});
  const saved = validateBattleSnapshot(JSON.parse(JSON.stringify(paused))), select = {type: 'weapon', unitId: 'p', slot: 'medical'};
  assert.deepEqual(actBattle(saved, select), actBattle(paused, select));
  const selected = order(saved, select);
  assert.equal(person(selected).ap, person(paused).ap - 4);
  assert.equal(selected.phase, 'interrupt');
  assert.deepEqual(selected.enemyTurn, paused.enemyTurn);
  const selectedSave = validateBattleSnapshot(JSON.parse(JSON.stringify(selected))), use = {type: 'useItem', unitId: 'p', targetId: 'p'};
  assert.deepEqual(actBattle(selectedSave, use), actBattle(selected, use));
  const healed = order(selectedSave, use);
  assert.equal(person(healed).ap, person(paused).ap - 4 - actionCosts(selected, person(selected)).heal);
  assert.equal(person(healed).medkits, person(paused).medkits - 1);
  assert.equal(person(healed).hp, person(paused).hp);
  assert.equal(person(healed).bleeding, 0);
  assert.equal(person(healed).activeSlot, 'medical');
  assert.equal(healed.elapsedSeconds, paused.elapsedSeconds);
  assert.equal(person(healed, 'e').ap, person(paused, 'e').ap);
  const continued = endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(healed))));
  assert.deepEqual(continued, endTurn(healed));
  assert.equal(continued.phase, 'player');
  assert.equal(continued.turn, paused.turn + 1);
  assert.equal(continued.elapsedSeconds, paused.elapsedSeconds);
  assert.equal(person(continued).medkits, person(healed).medkits);
  assert.doesNotThrow(() => validateBattleSnapshot(continued));
});
