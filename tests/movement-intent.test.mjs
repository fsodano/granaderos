import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, getReachable, movementStepCost, movementIntentReason, canSee} from '../game/tactical.js';
import {directionTo} from '../game/tactical-awareness.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {planGroupMove, executeGroupMove} from '../game/group-movement.js';

const intent = {movementIntent: 'preserveFacing'};
const tiles = (width = 28, height = 20) => Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0}));
const field = (unit = {}, extra = {}) => createBattle([{id: 'p', x: 6, y: 6, facing: 2, morale: 100, ...unit}], {
  width: 28, height: 20, tiles: tiles(), enemies: [{id: 'e', x: 26, y: 18, overwatch: false}], seed: 45, ...extra,
});
const player = s => s.units.find(u => u.id === 'p');
const route = (s, x, y, options = intent) => getReachable(s, 'p', options).find(p => p.x === x && p.y === y);
const move = (s, x, y, options = intent) => {
  const n = actBattle(s, {type: 'move', unitId: 'p', x, y, ...options});
  assert.equal(n.lastError, null, n.lastError);
  return n;
};
function unchanged(n, s) {
  assert.ok(n.lastError);
  assert.deepEqual(n.units, s.units);
  for (const key of ['seed', 'turn', 'phase', 'mode', 'elapsedSeconds']) assert.equal(n[key], s[key]);
}

test('backward and sideways steps preserve each of the eight original facings', () => {
  for (let facing = 0; facing < 8; facing++) for (const [x, y] of [[5, 6], [6, 5], [5, 5]]) {
    const s = field({facing}), before = structuredClone(s), path = route(s, x, y), n = move(s, x, y);
    assert.equal(path.path.length, 1);
    assert.equal(player(n).facing, facing);
    assert.equal(player(n).ap, player(s).ap - path.cost);
    assert.deepEqual([player(n).x, player(n).y], [x, y]);
    assert.deepEqual(s, before);
    assert.equal(Object.hasOwn(player(n), 'movementIntent'), false);
  }
});

test('a route around a blocked corner preserves facing at every paid step', () => {
  const s = field({facing: 1});
  Object.assign(s.tiles.find(t => t.x === 5 && t.y === 5), {type: 'wall', blocked: true, blocksSight: true});
  const path = route(s, 3, 4);
  assert.ok(path.path.length > 1);
  let from = player(s), sum = 0;
  const directions = new Set();
  for (const point of path.path) {
    const step = movementStepCost(s, player(s), from, point);
    assert.ok(Number.isFinite(step));
    sum += Math.ceil(step * 1.25); directions.add(directionTo(from, point)); from = point;
  }
  assert.ok(directions.size > 1, 'The route must change movement direction');
  assert.equal(path.cost, sum);
  const result = move(s, 3, 4);
  assert.equal(player(result).facing, 1);
  assert.equal(player(result).ap, player(s).ap - sum);
  let stepped = s;
  for (const point of path.path) {
    stepped = move(stepped, point.x, point.y);
    assert.equal(player(stepped).facing, 1);
    assert.doesNotThrow(() => validateBattleSnapshot(stepped));
  }
  assert.equal(player(stepped).ap, player(result).ap);
});

test('walk, crouch and prone previews charge preserve-facing AP above cardinal or diagonal cost', () => {
  for (const movementMode of ['walk', 'crouch', 'prone']) for (const stealthMode of [false, true]) {
    const stance = movementMode === 'prone' ? 'prone' : movementMode === 'crouch' ? 'crouched' : 'standing';
    for (const [x, y] of [[5, 6], [5, 5]]) {
      const s = field({movementMode, stance, stealthMode}), u = player(s);
      assert.equal(movementIntentReason(u, 'preserveFacing'), null);
      const cost = Math.ceil(movementStepCost(s, u, u, {x, y}) * 1.25), path = route(s, x, y);
      assert.equal(movementStepCost(s, u, u, {x, y}, intent), cost);
      assert.equal(path.cost, cost);
      const n = move(s, x, y);
      assert.equal(player(n).ap, u.ap - cost);
      assert.equal(player(n).facing, u.facing);
      assert.equal(player(n).movementMode, movementMode);
      assert.equal(player(n).stance, stance);
    }
  }
});

test('exploration time includes the intent multiplier once and energy follows the ordinary gait', () => {
  for (const movementMode of ['walk', 'crouch', 'prone']) for (const stealthMode of [false, true]) {
    const stance = movementMode === 'prone' ? 'prone' : movementMode === 'crouch' ? 'crouched' : 'standing';
    for (const [x, y] of [[5, 6], [5, 5]]) {
      const s = field({movementMode, stance, stealthMode}, {exploration: true}); player(s).ap = 7;
      const diagonal = x !== player(s).x && y !== player(s).y;
      const n = move(s, x, y), normal = move(s, x, y, {});
      const seconds = Math.ceil((movementMode === 'prone' ? 5 : 3) * (diagonal ? 1.4 : 1) * (stealthMode ? 1.25 : 1) * 1.25);
      assert.equal(n.elapsedSeconds - s.elapsedSeconds, seconds);
      assert.ok(n.elapsedSeconds > normal.elapsedSeconds);
      assert.equal(player(n).energy, player(normal).energy);
      assert.equal(player(n).ap, 7);
      assert.equal(player(n).loaded, player(s).loaded);
      assert.equal(player(n).ammo, player(s).ammo);
      assert.equal(n.mode, 'exploration');
      assert.doesNotThrow(() => validateBattleSnapshot(n));
    }
  }
});

test('omitted and explicit forward intents are identical and a later order has no sticky facing lock', () => {
  const s = field({facing: 0});
  assert.equal(movementIntentReason(player(s), undefined), null);
  assert.equal(movementIntentReason(player(s), 'forward'), null);
  assert.deepEqual(getReachable(s, 'p'), getReachable(s, 'p', {movementIntent: 'forward'}));
  assert.deepEqual(move(s, 5, 5, {}), move(s, 5, 5, {movementIntent: 'forward'}));
  const backward = move(s, 5, 5), next = move(backward, 4, 5, {});
  assert.equal(player(backward).facing, 0);
  assert.equal(player(next).facing, 6);
  assert.equal(Object.hasOwn(next, 'movementIntent'), false);
  assert.equal(Object.hasOwn(player(next), 'movementIntent'), false);
});

test('preserving facing retains forward sight while ordinary backward movement turns sight away', () => {
  const s = field({facing: 2}, {enemies: [{id: 'e', x: 11, y: 6, facing: 6, overwatch: false}]});
  assert.equal(canSee(s, player(s), s.units[1]), true);
  const backward = move(s, 5, 6), normal = move(s, 5, 6, {});
  assert.equal(canSee(backward, player(backward), backward.units[1]), true);
  assert.equal(canSee(normal, player(normal), normal.units[1]), false);
  Object.assign(s.tiles.find(t => t.x === 8 && t.y === 6), {type: 'wall', blocked: true, blocksSight: true});
  const blocked = move(s, 5, 6);
  assert.equal(canSee(blocked, player(blocked), blocked.units[1]), false, 'The facing lock cannot bypass cover');
});

test('invalid intent, running and mounted preservation reject previews and orders atomically', () => {
  for (const movementIntent of [null, '', 'backwards', true, 1, {}, []]) {
    const s = field();
    assert.ok(movementIntentReason(player(s), movementIntent));
    assert.deepEqual(getReachable(s, 'p', {movementIntent}), []);
    unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 5, y: 6, movementIntent}), s);
  }
  for (const unit of [{movementMode: 'run'}, {mounted: true}, {mounted: true, movementMode: 'run'}]) {
    const s = field(unit);
    assert.ok(movementIntentReason(player(s), 'preserveFacing'));
    assert.deepEqual(getReachable(s, 'p', intent), []);
    unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 5, y: 6, ...intent}), s);
    assert.ok(getReachable(s, 'p').length > 1, 'Normal movement remains available');
  }
});

test('the bundled effective gait is checked before intent, without an implicit dismount', () => {
  const running = field({movementMode: 'run'}), walking = field({movementMode: 'walk'});
  const n = move(running, 5, 6, {movement: 'walk', ...intent}), expected = move(walking, 5, 6);
  assert.equal(player(n).ap, player(expected).ap);
  assert.equal(player(n).energy, player(expected).energy);
  assert.equal(player(n).facing, player(running).facing);
  assert.equal(player(n).movementMode, 'walk');
  unchanged(actBattle(walking, {type: 'move', unitId: 'p', x: 5, y: 6, movement: 'run', ...intent}), walking);
  const mounted = field({mounted: true, movementMode: 'run'});
  unchanged(actBattle(mounted, {type: 'move', unitId: 'p', x: 5, y: 6, movement: 'walk', ...intent}), mounted);
});

test('preserve-facing AP cannot use the cheaper forward range or overspend on the first step', () => {
  const s = field(), cost = route(s, 5, 5).cost;
  player(s).ap = cost - 1;
  assert.equal(route(s, 5, 5), undefined);
  assert.ok(route(s, 5, 5, {}));
  unchanged(actBattle(s, {type: 'move', unitId: 'p', x: 5, y: 5, ...intent}), s);
  player(s).ap = cost;
  assert.equal(player(move(s, 5, 5)).ap, 0);
});

test('an interrupted diagonal retains original facing and only pays completed preserved steps', () => {
  const s = createBattle([
    {id: 'p', x: 1, y: 1, facing: 0, agility: 30, morale: 100},
    {id: 'c', x: 1, y: 5, agility: 100, experienceLevel: 10, morale: 100},
  ], {width: 16, height: 10, tiles: tiles(16, 10), seed: 45, enemies: [{id: 'e', x: 7, y: 1, agility: 70, weapon: 1813, morale: 100}]});
  const path = route(s, 4, 4), first = path.path[0], cost = Math.ceil(movementStepCost(s, player(s), player(s), first) * 1.25);
  const n = move(s, 4, 4);
  assert.deepEqual([player(n).x, player(n).y], [first.x, first.y]);
  assert.equal(player(n).ap, player(s).ap - cost);
  assert.equal(player(n).facing, 0);
  assert.equal(n.phase, 'interrupt');
  assert.ok(n.reactionStack?.length);
  const loaded = validateBattleSnapshot(JSON.parse(JSON.stringify(n)));
  assert.equal(player(loaded).facing, 0);
  assert.deepEqual(endTurn(loaded), endTurn(n));
  assert.doesNotThrow(() => validateBattleSnapshot(endTurn(loaded)));
});

test('preserve-facing is an individual order and cannot silently change into a formation order', () => {
  const s = createBattle([{id: 'p', x: 6, y: 6, facing: 2}, {id: 'friend', x: 6, y: 8, facing: 5}], {
    width: 28, height: 20, tiles: tiles(), exploration: true, enemies: [], seed: 45,
  });
  const n = move(s, 5, 6);
  assert.deepEqual(n.units.find(u => u.id === 'friend'), s.units.find(u => u.id === 'friend'));
  const request = {unitIds: ['p', 'friend'], anchorId: 'p', x: 3, y: 6, ...intent};
  assert.equal(planGroupMove(s, request).ok, false);
  const result = executeGroupMove(s, request);
  assert.equal(result.status, 'invalid'); assert.strictEqual(result.state, s);
  assert.equal(result.actions, 0); assert.equal(result.elapsedSeconds, 0);
  assert.deepEqual(planGroupMove(s, {...request, movementIntent: 'forward'}), planGroupMove(s, {...request, movementIntent: undefined}));
});
