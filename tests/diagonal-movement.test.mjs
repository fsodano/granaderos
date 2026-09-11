import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, getReachable, movementStepCost} from '../game/tactical.js';
import {directionTo} from '../game/tactical-awareness.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const grid = (width = 28, height = 20) => Array.from({length: width * height}, (_, i) => ({
  x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0,
}));
const field = (unit = {}, extra = {}) => createBattle([
  {id: 'p', x: 5, y: 5, morale: 100, ...unit},
], {width: 28, height: 20, tiles: grid(), enemies: [{id: 'e', x: 26, y: 18, overwatch: false}], seed: 45, ...extra});
const player = s => s.units.find(u => u.id === 'p');
const at = (s, x, y) => s.tiles.find(t => t.x === x && t.y === y);
const pathTo = (s, x, y) => getReachable(s, 'p').find(p => p.x === x && p.y === y);
const move = (s, x, y) => {
  const next = actBattle(s, {type: 'move', unitId: 'p', x, y});
  assert.equal(next.lastError, null, next.lastError);
  return next;
};
function pathCost(s, route) {
  let from = player(s), total = 0;
  for (const to of route.path) {
    const step = movementStepCost(s, player(s), from, to);
    assert.ok(Number.isFinite(step) && step > 0, `Illegal route step ${JSON.stringify({from, to})}`);
    total += step; from = to;
  }
  return total;
}
function unchanged(rejected, before) {
  assert.ok(rejected.lastError);
  assert.deepEqual(rejected.units, before.units);
  for (const key of ['seed', 'elapsedSeconds', 'turn', 'phase', 'mode']) assert.equal(rejected[key], before[key]);
}

test('all eight adjacent directions use one step and set authoritative facing', () => {
  const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  for (const [facing, [dx, dy]] of directions.entries()) {
    const s = field(), u = player(s), destination = {x: u.x + dx, y: u.y + dy};
    const route = pathTo(s, destination.x, destination.y);
    assert.equal(route.path.length, 1);
    assert.equal(route.cost, movementStepCost(s, u, u, destination));
    const n = move(s, destination.x, destination.y);
    assert.equal(player(n).facing, facing);
    assert.equal(player(n).facing, directionTo(u, destination));
    assert.equal(player(n).ap, u.ap - route.cost);
    assert.deepEqual([player(n).x, player(n).y], [destination.x, destination.y]);
    assert.doesNotThrow(() => validateBattleSnapshot(n));
  }
});

test('diagonal cost uses the shared multiplier and complete path cost matches committed AP', () => {
  for (const unit of [
    {}, {movementMode: 'run'}, {stance: 'crouched', movementMode: 'crouch'},
    {stance: 'prone', movementMode: 'prone'}, {stealthMode: true},
    {mounted: true, ridingSkill: 40}, {weight: 45, strength: 40},
  ]) {
    const s = field(unit), u = player(s); u.ap = 120;
    const cardinal = movementStepCost(s, u, u, {x: 6, y: 5});
    const diagonal = movementStepCost(s, u, u, {x: 6, y: 6});
    assert.equal(diagonal, Math.ceil(cardinal * 1.4));
    assert.ok(diagonal < cardinal * 2);
    const route = pathTo(s, 7, 7);
    assert.ok(route, `Missing route for ${JSON.stringify(unit)}`);
    assert.equal(route.path.length, 2);
    assert.equal(route.cost, pathCost(s, route));
    const n = move(s, 7, 7);
    assert.equal(player(n).ap, u.ap - route.cost);
    assert.doesNotThrow(() => validateBattleSnapshot(n));
  }
});

test('mixed surfaces keep preview and committed costs equal on the chosen legal path', () => {
  const s = field({stealthMode: true}); player(s).ap = 120;
  for (const [x, y, type] of [[6, 6, 'mud'], [6, 5, 'forest'], [7, 6, 'stone'], [7, 7, 'scrub']]) at(s, x, y).type = type;
  const route = pathTo(s, 8, 8);
  assert.ok(route);
  assert.equal(route.cost, pathCost(s, route));
  const n = move(s, 8, 8);
  assert.equal(player(n).ap, player(s).ap - route.cost);
  assert.deepEqual([player(n).x, player(n).y], [8, 8]);
});

test('either blocked corner flank prevents diagonal cutting through a wall, door or prop', () => {
  for (const [x, y] of [[6, 5], [5, 6]]) for (const obstacle of ['wall', 'door', 'prop']) {
    const s = field();
    if (obstacle === 'prop') s.props.push({id: 'corner-table', type: 'table', x, y, blocksMovement: true});
    else Object.assign(at(s, x, y), {type: obstacle, blocked: true, ...(obstacle === 'door' ? {doorId: 'corner-door', open: false, blocksSight: true} : {})});
    assert.equal(movementStepCost(s, player(s), player(s), {x: 6, y: 6}), Infinity, `${obstacle} at ${x},${y}`);
    const route = pathTo(s, 6, 6);
    assert.ok(route, 'The other flank still has a legal route around the obstacle');
    assert.ok(route.path.length > 1);
    assert.equal(route.cost, pathCost(s, route));
    const n = move(s, 6, 6);
    assert.equal(player(n).ap, player(s).ap - route.cost);
    assert.doesNotThrow(() => validateBattleSnapshot(n));
  }
});

test('the helper rejects nonsteps, off-grid coordinates and blocked destinations', () => {
  const s = field(), u = player(s);
  for (const to of [u, {x: 7, y: 7}, {x: 5.5, y: 6}, {x: -1, y: 5}, {x: 28, y: 5}]) {
    assert.equal(movementStepCost(s, u, u, to), Infinity);
  }
  Object.assign(at(s, 6, 6), {type: 'wall', blocked: true});
  assert.equal(movementStepCost(s, u, u, {x: 6, y: 6}), Infinity);
  assert.equal(pathTo(s, 6, 6), undefined);
  unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 6, y: 6}), s);
  const p = field(); p.props.push({id: 'destination-table', type: 'table', x: 6, y: 6, blocksMovement: true});
  assert.equal(movementStepCost(p, player(p), player(p), {x: 6, y: 6}), Infinity);
  assert.equal(pathTo(p, 6, 6), undefined);
  unchanged(actBattle(p, {type: 'move', unitId: 'p', x: 6, y: 6}), p);
});

test('occupied destinations remain unavailable while occupancy stays outside terrain cost', () => {
  const s = field({}, {enemies: [{id: 'e', x: 6, y: 6, overwatch: false}]});
  assert.ok(Number.isFinite(movementStepCost(s, player(s), player(s), {x: 6, y: 6})));
  assert.equal(pathTo(s, 6, 6), undefined);
  unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 6, y: 6}), s);
});

test('a diagonal requires the full AP cost and reaching zero AP never starts another step', () => {
  const s = field(), cost = movementStepCost(s, player(s), player(s), {x: 6, y: 6});
  player(s).ap = cost - 1;
  assert.equal(pathTo(s, 6, 6), undefined);
  unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 6, y: 6}), s);
  player(s).ap = cost;
  const n = move(s, 6, 6);
  assert.equal(player(n).ap, 0);
  assert.equal(pathTo(n, 7, 7), undefined);
  unchanged(actBattle(n, {type: 'move', unitId: 'p', x: 7, y: 7}), n);
});

test('exploration charges diagonal distance in time and energy without spending or refilling AP', () => {
  for (const movementMode of ['walk', 'run', 'crouch', 'prone']) {
    const stance = movementMode === 'prone' ? 'prone' : movementMode === 'crouch' ? 'crouched' : 'standing';
    const s = field({movementMode, stance}, {exploration: true}); player(s).ap = 7;
    assert.equal(s.mode, 'exploration');
    const cardinal = move(s, 6, 5), diagonal = move(s, 6, 6);
    assert.equal(cardinal.mode, 'exploration'); assert.equal(diagonal.mode, 'exploration');
    assert.equal(player(cardinal).ap, 7); assert.equal(player(diagonal).ap, 7);
    assert.ok(diagonal.elapsedSeconds > cardinal.elapsedSeconds);
    assert.ok(player(diagonal).energy < player(cardinal).energy);
    assert.equal(player(diagonal).loaded, player(s).loaded);
    assert.equal(player(diagonal).ammo, player(s).ammo);
    assert.doesNotThrow(() => validateBattleSnapshot(diagonal));
  }
});

test('energy exhaustion stops a multi-diagonal exploration path at the completed step', () => {
  const s = field({energy: 1}, {exploration: true}), route = pathTo(s, 8, 8);
  assert.ok(route.path.length > 1);
  const first = route.path[0], oneStep = move(s, first.x, first.y), n = move(s, 8, 8);
  assert.deepEqual([player(n).x, player(n).y], [first.x, first.y]);
  assert.equal(player(n).energy, 0);
  assert.equal(player(n).unconscious, true);
  assert.equal(player(n).ap, 0, 'Collapse removes action capacity even during exploration');
  assert.equal(player(n).ap, player(oneStep).ap);
  assert.equal(n.elapsedSeconds, oneStep.elapsedSeconds);
  assert.doesNotThrow(() => validateBattleSnapshot(n));
});

test('a reaction stops diagonal movement after the paid step and the paused state survives saving', () => {
  const s = createBattle([
    {id: 'p', x: 1, y: 1, agility: 30, morale: 100},
    {id: 'c', x: 1, y: 5, agility: 100, experienceLevel: 10, morale: 100},
  ], {width: 16, height: 10, tiles: grid(16, 10), seed: 45,
    enemies: [{id: 'e', x: 7, y: 1, agility: 70, weapon: 1813, morale: 100}],
  });
  const route = pathTo(s, 4, 4), first = route.path[0];
  assert.notEqual(first.x, player(s).x); assert.notEqual(first.y, player(s).y);
  const step = movementStepCost(s, player(s), player(s), first), n = move(s, 4, 4);
  assert.deepEqual([player(n).x, player(n).y], [first.x, first.y]);
  assert.equal(player(n).ap, player(s).ap - step);
  assert.equal(player(n).facing, directionTo(player(s), first));
  assert.equal(n.turn, s.turn);
  assert.equal(n.phase, 'interrupt');
  assert.ok(n.reactionStack?.length);
  const saved = validateBattleSnapshot(JSON.parse(JSON.stringify(n)));
  assert.deepEqual(endTurn(saved), endTurn(n));
  assert.doesNotThrow(() => validateBattleSnapshot(endTurn(saved)));
});
