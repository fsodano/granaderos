import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, getReachable, actionCosts, canSee, hasLineOfSight} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field({actor = {}, enemy = {}, changeTiles = () => {}, ...extra} = {}) {
  const width = 32, height = 12;
  const tiles = Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0}));
  changeTiles(tiles);
  return createBattle([{id: 'p', x: 2, y: 3, facing: 2, weapon: 1803, ...actor}], {
    width, height, tiles, enemies: [{id: 'e', x: 30, y: 10, facing: 6, overwatch: false, ...enemy}], seed: 45, ...extra,
  });
}
const actor = s => s.units.find(u => u.id === 'p');
const remember = (s, x = 20, y = 3) => {actor(s).lastKnownEnemy = {x, y, turn: s.turn}; return s;};
const pathFor = (s, action) => getReachable(s, actor(s)).find(cell => cell.x === action.x && cell.y === action.y);
const reserve = (s, u = actor(s)) => {const c = actionCosts(s, u); return c.fire + c.aim * 2;};

test('a loaded soldier searches in short bounds and retains AP for aimed fire', () => {
  let s = remember(field()), count = 0;
  assert.equal(canSee(s, actor(s), s.units[1]), false);
  while (count < 12) {
    const action = chooseEnemyAction(s, actor(s));
    if (!action) break;
    assert.equal(action.type, 'move');
    const path = pathFor(s, action), before = actor(s).ap;
    assert.ok(path.path.length <= 3 && path.cost <= 24);
    assert.ok(before - path.cost >= reserve(s));
    const resumed = validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
    const next = actBattle(s, action);
    assert.equal(next.lastError, null);
    assert.deepEqual(next, actBattle(resumed, action));
    assert.equal(actor(next).ap, before - path.cost);
    assert.doesNotThrow(() => validateBattleSnapshot(next));
    s = next; count++;
  }
  assert.ok(count > 0 && count < 12);
  assert.ok(actor(s).ap >= reserve(s));
  assert.equal(actor(s).loaded, 1);
  assert.ok(actor(s).x < 20, 'reserving fire AP stops a full-turn dash to a distant memory');
});

test('investigation prefers useful nearby cover to an exposed direct route', () => {
  const s = remember(field({changeTiles: tiles => {tiles.find(t => t.x === 4 && t.y === 4).cover = 40;}}));
  const action = chooseEnemyAction(s, actor(s));
  assert.equal(action.type, 'move');
  assert.equal(s.tiles.find(t => t.x === action.x && t.y === action.y).cover, 40);
  assert.ok(pathFor(s, action).cost <= 24);
});

test('the next decision can fire after a short search acquires actual visual contact', () => {
  let s = remember(field({actor: {marksmanship: 80}, enemy: {x: 20, y: 3}}));
  assert.equal(canSee(s, actor(s), s.units[1]), false);
  const search = chooseEnemyAction(s, actor(s));
  assert.equal(search.type, 'move');
  s = actBattle(s, search); assert.equal(s.lastError, null);
  assert.equal(canSee(s, actor(s), s.units[1]), true);
  const fire = chooseEnemyAction(s, actor(s)), cost = actionCosts(s, actor(s));
  assert.equal(fire.type, 'fire');
  assert.ok(cost.fire + cost.aim * fire.aim <= actor(s).ap);
  const next = actBattle(s, fire); assert.equal(next.lastError, null);
  assert.equal(actor(next).loaded, 0);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

test('an interruption does not turn a distant memory into an exposed pursuit', () => {
  for (const control of [{phase: 'interrupt'}, {phase: 'enemy', reactionStack: [{}]}]) {
    const s = remember(field()); Object.assign(s, control);
    assert.equal(chooseEnemyAction(s, actor(s)), null);
    s.tiles.find(t => t.x === 3 && t.y === 3).cover = 30;
    const action = chooseEnemyAction(s, actor(s));
    assert.equal(action.type, 'move');
    assert.equal(pathFor(s, action).path.length, 1);
    assert.ok(actor(s).ap - pathFor(s, action).cost >= reserve(s));
  }
});

test('an interrupt search keeps existing cover and does not spend the last shot AP', () => {
  const s = remember(field({changeTiles: tiles => {tiles.find(t => t.x === 2 && t.y === 3).cover = 40;}}));
  s.phase = 'interrupt';
  assert.equal(chooseEnemyAction(s, actor(s)), null);
  actor(s).facing = 6; actor(s).ap = actionCosts(s, actor(s)).fire;
  assert.equal(chooseEnemyAction(s, actor(s)), null);
});

test('a bounded search can take a wall detour before gaining a view of the remembered area', () => {
  const s = remember(field({actor: {x: 7, y: 3, facing: 6}, changeTiles: tiles => {
    for (const t of tiles.filter(t => t.x === 5 && t.y >= 2 && t.y <= 4)) Object.assign(t, {type: 'wall', blocked: true, blocksSight: true});
  }}), 3, 3);
  assert.equal(hasLineOfSight(s, actor(s), actor(s).lastKnownEnemy), false);
  const action = chooseEnemyAction(s, actor(s)), path = pathFor(s, action);
  assert.equal(action.type, 'move');
  assert.ok(path.cost <= 24 && path.path.length <= 3);
  assert.ok(path.path.every(p => !s.tiles.find(t => t.x === p.x && t.y === p.y).blocked));
  assert.ok(path.path.slice(0, -1).every(p => !hasLineOfSight(s, p, actor(s).lastKnownEnemy)), 'reassess at the first newly visible search-area tile');
});

test('hidden opponent coordinates and capabilities do not alter the search order', () => {
  const s = remember(field({actor: {x: 7, y: 3, facing: 6}, enemy: {x: 3, y: 3}, changeTiles: tiles => {
    for (const t of tiles.filter(t => t.x === 5 && t.y >= 2 && t.y <= 4)) Object.assign(t, {type: 'wall', blocked: true, blocksSight: true});
  }}), 3, 3);
  const other = structuredClone(s);
  Object.assign(other.units[1], {x: 4, y: 4, weapon: 1813, hp: 80, marksmanship: 100, loaded: 0});
  assert.equal(canSee(s, actor(s), s.units[1]), false);
  assert.equal(canSee(other, actor(other), other.units[1]), false);
  assert.deepEqual(chooseEnemyAction(s, actor(s)), chooseEnemyAction(other, actor(other)));
  const before = structuredClone(s), order = chooseEnemyAction(s, actor(s));
  for (let i = 0; i < 8; i++) assert.deepEqual(chooseEnemyAction(s, actor(s)), order);
  assert.deepEqual(s, before);
});

test('stale or invalid memories do not authorize a search', () => {
  for (const memory of [undefined, {x: 20, y: 3, turn: -3}, {x: 20, y: 3, turn: 2}, {x: 32, y: 3, turn: 1}, {x: 2.5, y: 3, turn: 1}]) {
    const s = field(); actor(s).lastKnownEnemy = memory;
    assert.equal(chooseEnemyAction(s, actor(s)), null);
  }
});

test('ordinary blade approach and melee pay separate legal orders without a charge bonus', () => {
  let s = field({actor: {weapon: 1813, ammo: 0, loaded: 0}, enemy: {x: 6, y: 3, weapon: 1813, ammo: 0, loaded: 0}});
  const move = chooseEnemyAction(s, actor(s)), path = pathFor(s, move), startAP = actor(s).ap;
  assert.equal(move.type, 'move');
  s = actBattle(s, move); assert.equal(s.lastError, null);
  assert.equal(actor(s).ap, startAP - path.cost);
  const strike = chooseEnemyAction(s, actor(s)), meleeAP = actionCosts(s, actor(s)).melee;
  assert.equal(strike.type, 'melee');
  const next = actBattle(s, strike); assert.equal(next.lastError, null);
  assert.equal(actor(next).ap, actor(s).ap - meleeAP);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

test('a visible blade opponent permits at most one approach step during a reaction', () => {
  const s = field({actor: {weapon: 1813, ammo: 0, loaded: 0}, enemy: {x: 8, y: 3, weapon: 1813, ammo: 0, loaded: 0}});
  s.phase = 'interrupt';
  const action = chooseEnemyAction(s, actor(s));
  assert.equal(action.type, 'move');
  assert.equal(pathFor(s, action).path.length, 1);
  assert.ok(actor(s).ap - pathFor(s, action).cost >= actionCosts(s, actor(s)).melee);
});

test('a real hearing interrupt can reserve its AP and resume identically after JSON save', () => {
  const width = 16, height = 10;
  const s = createBattle([{id: 'p', x: 5, y: 2, facing: 0, agility: 100, weapon: 1803}], {width, height,
    tiles: Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0})),
    enemies: [{id: 'e', x: 5, y: 5, facing: 0, loaded: 0, ammo: 2}], seed: 45});
  const paused = endTurn(s); assert.equal(paused.phase, 'interrupt');
  assert.equal(canSee(paused, actor(paused), paused.units[1]), false);
  const action = chooseEnemyAction(paused, actor(paused));
  assert.ok(action === null || action.type === 'look');
  const saved = validateBattleSnapshot(JSON.parse(JSON.stringify(paused)));
  assert.deepEqual(chooseEnemyAction(saved, actor(saved)), action);
  assert.deepEqual(endTurn(saved), endTurn(paused));
});
