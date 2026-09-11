import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, canSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function unseenEnemy(extra = {}) {
  const tiles = Array.from({length: 160}, (_, i) => ({x: i % 20, y: Math.floor(i / 20), type: 'grass', blocked: false, cover: 0}));
  return createBattle([{id: 'p', x: 1, y: 3, agility: 70, experienceLevel: 4}], {width: 20, height: 8, tiles, seed: 45,
    enemies: [{id: 'e', patrol:false, x: 18, y: 3, weapon: 1813, agility: 100, experienceLevel: 10, ...extra}]});
}

test('a sentry blade enemy retains general interrupt readiness after its ordinary turn', () => {
  const before = endTurn(unseenEnemy());
  assert.equal(before.turn, 2); assert.equal(before.units[1].ap, 100); assert.equal(before.units[1].overwatch, true);
  const next = actBattle(before, {type: 'move', unitId: 'p', x: 10, y: 3});
  assert.equal(next.lastError, null); assert.equal(next.units[1].reactionTurn, 2);
  assert.ok(next.units[1].ap < before.units[1].ap); assert.equal(next.turn, 2);
  assert.ok(next.units[1].x < before.units[1].x); assert.equal(next.elapsedSeconds, before.elapsedSeconds + 6);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

test('an unloaded enemy with no spare cartridges can still interrupt through other legal actions', () => {
  const before = endTurn(unseenEnemy({weapon: 1800, loaded: 0, ammo: 0}));
  assert.equal(before.units[1].loaded, 0); assert.equal(before.units[1].ammo, 0); assert.equal(before.units[1].overwatch, true);
  const next = actBattle(before, {type: 'move', unitId: 'p', x: 10, y: 3});
  assert.equal(next.lastError, null); assert.equal(next.units[1].reactionTurn, 2);
  assert.ok(next.units[1].ap < before.units[1].ap); assert.equal(next.turn, 2);
  assert.equal(next.units[1].loaded, 0); assert.equal(next.units[1].ammo, 0);
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

test('a reaction with three remaining AP cannot refill its budget to pursue a distant target', () => {
  const before = endTurn(unseenEnemy()); before.units[1].ap = 3;
  const next = actBattle(before, {type: 'move', unitId: 'p', x: 10, y: 3});
  assert.equal(next.lastError, null); assert.equal(next.units[1].reactionTurn, 2);
  assert.equal(next.units[1].ap, 3); assert.equal(next.units[1].x, 18); assert.equal(next.units[0].hp, 100);
  assert.equal(next.turn, 2); assert.equal(next.phase, 'player');
  assert.doesNotThrow(() => validateBattleSnapshot(next));
});

test('a stationary charge grants the same new-sound reaction as an ordinary adjacent melee attack', () => {
  const tiles = Array.from({length: 160}, (_, i) => ({x: i % 16, y: Math.floor(i / 16), type: 'grass', blocked: false, cover: 0}));
  const before = createBattle([{id: 'p', x: 4, y: 3, weapon: 1809, agility: 30, experienceLevel: 1}], {width: 16, height: 10, tiles, seed: 45,
    enemies: [{id: 'target', x: 5, y: 3, agility: 1, experienceLevel: 1, overwatch: false}, {id: 'observer', x: 4, y: 7, facing: 4, agility: 100, experienceLevel: 10}]});
  assert.equal(canSee(before, before.units[2], before.units[0]), false);
  for (const type of ['melee', 'charge']) {
    const next = actBattle(before, {type, unitId: 'p', targetId: 'target'}), observer = next.units.find(u => u.id === 'observer');
    assert.equal(next.lastError, null); assert.equal(observer.lastHeardNoise.kind, 'melee');
    assert.equal(observer.reactionTurn, 1, `${type} must permit the unseen listener to react.`);
    assert.ok(observer.ap < 100); assert.equal(next.turn, 1); assert.equal(next.elapsedSeconds, 6);
    assert.doesNotThrow(() => validateBattleSnapshot(next));
  }
});
