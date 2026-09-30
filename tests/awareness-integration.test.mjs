import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, canSee, getReachable, actionCosts} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const field = (players = [{id: 'p', x: 1, y: 3}], enemies = [{id: 'e', x: 22, y: 7, overwatch: false}], change = () => {}) => {
  const width = 24, height = 9;
  const tiles = Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0}));
  change(tiles);
  return createBattle(players, {width, height, tiles, enemies, seed: 45});
};
const order = (state, action) => {
  const result = actBattle(state, {unitId: 'p', ...action});
  assert.equal(result.lastError, null, `${action.type}: ${result.lastError}`);
  return result;
};
const enemy = state => state.units.find(u => u.id === 'e');

test('a paid look changes authoritative sight without moving or refreshing AP', () => {
  const state = field([{id: 'p', x: 1, y: 3, facing: 6}], [{id: 'e', x: 9, y: 3, facing: 2, overwatch: false}]);
  assert.equal(canSee(state, state.units[0], enemy(state)), false);
  const next = order(state, {type: 'look', x: 9, y: 3});
  assert.equal(next.units[0].facing, 2);
  assert.equal(next.units[0].ap, state.units[0].ap - 8);
  assert.equal(next.units[0].x, 1);
  assert.equal(next.units[0].y, 3);
  assert.equal(next.units[0].loaded, state.units[0].loaded);
  assert.equal(canSee(next, next.units[0], enemy(next)), true);
  assert.equal(state.units[0].facing, 6);
});

test('a prone look pays the larger turn cost and unavailable turns fail atomically', () => {
  const state = field([{id: 'p', x: 1, y: 3, facing: 6, stance: 'prone', movementMode: 'prone'}]);
  assert.equal(order(state, {type: 'look', x: 9, y: 3}).units[0].ap, state.units[0].ap - 16);
  state.units[0].ap = 15;
  const rejected = actBattle(state, {type: 'look', unitId: 'p', x: 9, y: 3});
  assert.ok(rejected.lastError);
  assert.deepEqual(rejected.units, state.units);
  assert.equal(rejected.seed, state.seed);
  assert.equal(rejected.elapsedSeconds, state.elapsedSeconds);
});

test('moving behind an unaware enemy emits an anonymous approximate footstep report', () => {
  const state = field([{id: 'p', x: 1, y: 3}], [{id: 'e', x: 5, y: 3, facing: 2, overwatch: false}]);
  const next = order(state, {type: 'move', x: 2, y: 3});
  assert.equal(canSee(next, enemy(next), next.units[0]), false);
  assert.deepEqual(enemy(next).lastHeardNoise, {x: 1, y: 4, turn: 1, kind: 'move', uncertainty: 2});
  assert.equal(enemy(next).lastKnownEnemy, undefined);
  assert.equal(next.units[0].facing, 2);
  assert.equal(next.units[0].ap, 92);
});

test('stealth remains separate from stance and its preview cost matches the quiet move', () => {
  const state = field([{id: 'p', x: 1, y: 3, stealth: 50}], [{id: 'e', x: 5, y: 3, facing: 2, overwatch: false}]);
  const quiet = order(state, {type: 'stealth', enabled: true});
  assert.equal(quiet.units[0].stance, 'standing');
  assert.equal(quiet.units[0].movementMode, 'walk');
  assert.equal(quiet.units[0].ap, state.units[0].ap);
  const preview = getReachable(quiet, 'p').find(p => p.x === 2 && p.y === 3);
  const moved = order(quiet, {type: 'move', x: 2, y: 3});
  assert.equal(moved.units[0].ap, quiet.units[0].ap - preview.cost);
  assert.equal(preview.cost, 10);
  assert.equal(enemy(moved).lastHeardNoise, undefined);
  const crouched = order(state, {type: 'stance', stance: 'crouched'});
  assert.equal(crouched.units[0].stealthMode, false);
  assert.equal(crouched.units[0].movementMode, 'crouch');
  const crouchedQuiet = order(crouched, {type: 'stealth', enabled: true});
  assert.equal(crouchedQuiet.units[0].stance, 'crouched');
  assert.equal(crouchedQuiet.units[0].ap, crouched.units[0].ap);
});

test('a hidden discharged weapon is audible farther than footsteps and does not reveal its shooter', () => {
  const state = field([{id: 'p', x: 1, y: 3, stealthMode: true}], [
    {id: 'target', x: 6, y: 3, overwatch: false}, {id: 'e', x: 13, y: 3, facing: 2, overwatch: false},
  ]);
  const shot = order(state, {type: 'fire', targetId: 'target'});
  assert.equal(shot.units[0].loaded, 0);
  assert.equal(canSee(shot, enemy(shot), shot.units[0]), false);
  assert.deepEqual(enemy(shot).lastHeardNoise, {x: 2, y: 2, turn: 1, kind: 'fire', uncertainty: 3});
  assert.equal(enemy(shot).lastKnownEnemy, undefined);
});

test('a fresh close sound behind cover is retained until the listener investigates', () => {
  const state = field([{id: 'p', x: 1, y: 1, facing: 4}], [
    {id: 'target', x: 1, y: 6, overwatch: false}, {id: 'e', x: 3, y: 2, facing: 2, overwatch: false},
  ], tiles => Object.assign(tiles.find(t => t.x === 2 && t.y === 1), {type: 'wall', blocked: true}));
  assert.equal(canSee(state, enemy(state), state.units[0]), false);
  const shot = order(state, {type: 'fire', targetId: 'target'});
  assert.deepEqual(enemy(shot).lastHeardNoise, {x: 2, y: 2, turn: 1, kind: 'fire', uncertainty: 3});
});

test('a soldier remembers the last visible transit tile rather than an unseen final position', () => {
  const state = field([{id: 4, x: 1, y: 3}], [{id: 'e', x: 1, y: 5, facing: 0, overwatch: false}]);
  state.units[0].ap = 120;
  const next = order(state, {type: 'move', unitId: 4, x: 19, y: 3});
  assert.equal(next.units[0].x, 19);
  assert.equal(canSee(next, enemy(next), next.units[0]), false);
  assert.deepEqual(enemy(next).lastKnownEnemy, {x: 16, y: 3, turn: 1});
});

test('enemy investigation turns and searches a heard area without following hidden current positions', () => {
  const state = field([{id: 'p', x: 1, y: 7}], [{id: 'e', x: 14, y: 1, facing: 2, overwatch: false}], tiles => {
    for (const tile of tiles.filter(t => t.x === 3)) Object.assign(tile, {type: 'wall', blocked: true});
  });
  enemy(state).lastHeardNoise = {x: 8, y: 1, turn: 1, kind: 'fire', uncertainty: 3};
  const movedHidden = structuredClone(state); movedHidden.units[0].y = 5;
  assert.equal(canSee(state, enemy(state), state.units[0]), false);
  assert.deepEqual(chooseEnemyAction(state, enemy(state)), {type: 'look', unitId: 'e', x: 8, y: 1});
  assert.deepEqual(chooseEnemyAction(movedHidden, enemy(movedHidden)), chooseEnemyAction(state, enemy(state)));
  const next = endTurn(state), other = endTurn(movedHidden);
  assert.deepEqual(enemy(next), enemy(other));
  const heard = enemy(state).lastHeardNoise;
  assert.ok(Math.hypot(enemy(next).x - heard.x, enemy(next).y - heard.y) <= heard.uncertainty);
  assert.ok(Math.hypot(enemy(next).x - heard.x, enemy(next).y - heard.y) < Math.hypot(enemy(state).x - heard.x, enemy(state).y - heard.y));
  const costs = actionCosts(next, enemy(next));
  assert.ok(enemy(next).ap >= costs.fire + costs.aim * 2);
  assert.equal(enemy(next).lastHeardNoise, undefined);
  assert.equal(enemy(next).loaded, 1);
  assert.equal(chooseEnemyAction(next, enemy(next)), null);
});

test('an enemy with no live contact follows its patrol instead of the hidden squad', () => {
  const state = field([{id: 'p', x: 1, y: 3}], [{id: 'e', x: 10, y: 3, facing: 2, overwatch: false}]);
  assert.equal(canSee(state, enemy(state), state.units[0]), false);
  assert.equal(chooseEnemyAction(state, enemy(state))?.patrol, true);
  const other = structuredClone(state); other.units[0].x = 2; other.units[0].y = 8;
  assert.deepEqual(chooseEnemyAction(other, enemy(other)), chooseEnemyAction(state, enemy(state)));
});

test('a nearby noise behind the enemy causes one paid look rather than permanent inaction', () => {
  const state = field([{id: 'p', x: 1, y: 7}], [{id: 'e', x: 14, y: 1, facing: 2, overwatch: false}], tiles => {
    for (const tile of tiles.filter(t => t.x === 3)) Object.assign(tile, {type: 'wall', blocked: true});
  });
  enemy(state).lastHeardNoise = {x: 13, y: 1, turn: 1, kind: 'fire', uncertainty: 3};
  assert.deepEqual(chooseEnemyAction(state, enemy(state)), {type: 'look', unitId: 'e', x: 13, y: 1});
  const next = endTurn(state);
  assert.equal(enemy(next).x, 14);
  assert.equal(enemy(next).y, 1);
  assert.equal(enemy(next).facing, 6);
  assert.equal(enemy(next).ap, enemy(state).ap - 8);
  assert.equal(enemy(next).lastHeardNoise, undefined);
  assert.equal(chooseEnemyAction(next, enemy(next)), null);
});

test('saved facing, stealth, and anonymous reports round-trip and reject leaked or malformed data', () => {
  const state = order(field([{id: 'p', x: 1, y: 3}], [{id: 'e', x: 5, y: 3, facing: 2, overwatch: false}]), {type: 'move', x: 2, y: 3});
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(state))), state);
  for (const change of [{id: 'p'}, {sourceId: 'p'}, {side: 'player'}, {hp: 100}, {kind: 'secret'}, {turn: 2}, {x: 24}, {uncertainty: -1}]) {
    const bad = structuredClone(state); Object.assign(enemy(bad).lastHeardNoise, change);
    assert.throws(() => validateBattleSnapshot(bad));
  }
  for (const change of [{facing: 8}, {facing: 1.5}, {stealthMode: 'true'}]) {
    const bad = structuredClone(state); Object.assign(bad.units[0], change);
    assert.throws(() => validateBattleSnapshot(bad));
  }
  const legacy = structuredClone(state);
  for (const unit of legacy.units) {delete unit.facing; delete unit.stealthMode;}
  const migrated = validateBattleSnapshot(legacy);
  assert.equal(migrated.units[0].facing, 2); assert.equal(enemy(migrated).facing, 6);
  assert.equal(migrated.units[0].stealthMode, false);
});
