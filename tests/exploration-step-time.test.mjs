import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, endTurn, getReachable, canSee} from '../game/tactical.js';
import {COMBAT_ROUND_SECONDS, advanceBattleClock} from '../game/time.js';
import {CRITICAL_HEALTH} from '../game/tactical-condition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const tiles = () => Array.from({length: 28 * 12}, (_, i) => ({x: i % 28, y: Math.floor(i / 28), type: 'grass', blocked: false, cover: 0}));
const field = (unit = {}, extra = {}, allies = []) => createBattle([
  {id: 'p', x: 1, y: 1, facing: 2, morale: 100, ...unit}, ...allies,
], {width: 28, height: 12, tiles: tiles(), seed: 45, exploration: true, enemies: [], ...extra});
const person = (s, id = 'p') => s.units.find(u => u.id === id);
const order = (s, action) => {
  const n = actBattle(s, {unitId: 'p', ...action});
  assert.equal(n.lastError, null, n.lastError);
  return n;
};
const move = (s, x, y, extra = {}) => order(s, {type: 'move', x, y, ...extra});
const singleStepSeconds = (unit = {}, extra = {}) => {
  const s = field(unit);
  return move(s, 2, 1, extra).elapsedSeconds - s.elapsedSeconds;
};
function clockMatches(actual, initial, seconds) {
  const expected = structuredClone(initial);
  advanceBattleClock(expected, seconds);
  assert.equal(actual.elapsedSeconds, expected.elapsedSeconds);
  assert.equal(actual.night, expected.night);
  assert.deepEqual(actual.lights, expected.lights);
  assert.equal(Object.hasOwn(actual, 'actionDurationSeconds'), false);
  assert.equal(Object.hasOwn(actual, 'actionTimeAppliedSeconds'), false);
}

test('a bleeding mover collapses on the first completed step that reaches critical health', () => {
  const hp = CRITICAL_HEALTH + 5, bleeding = 3, secondsPerStep = singleStepSeconds();
  const s = field({hp, bleeding}, {lights: [{id: 'torch', x: 2, y: 8, type: 'torch', radius: 3, turns: 1, remainingSeconds: 60}]}, [
    {id: 'ally', x: 1, y: 9, hp: 70, bleeding: 2},
    {id: 'critical', x: 3, y: 9, hp: 10, bleeding: 1},
  ]);
  const route = getReachable(s, 'p').find(p => p.x === 13 && p.y === 1).path;
  const ticksToCollapse = Math.floor((hp - CRITICAL_HEALTH) / bleeding) + 1;
  const stepsToCollapse = Math.ceil(ticksToCollapse * COMBAT_ROUND_SECONDS / secondsPerStep);
  assert.ok(stepsToCollapse < route.length);
  const seconds = stepsToCollapse * secondsPerStep, ticks = Math.floor(seconds / COMBAT_ROUND_SECONDS);
  const n = move(s, 13, 1);
  assert.deepEqual({x: person(n).x, y: person(n).y}, route[stepsToCollapse - 1]);
  assert.equal(person(n).hp, hp - bleeding * ticks);
  assert.equal(person(n).unconscious, true);
  assert.equal(person(n).ap, 0);
  assert.equal(person(n, 'ally').hp, 70 - 2 * ticks);
  assert.equal(person(n, 'critical').hp, 10 - ticks);
  assert.equal(person(n, 'critical').unconscious, true);
  assert.equal(n.bleedSeconds, seconds % COMBAT_ROUND_SECONDS);
  assert.equal(n.status, 'active');
  clockMatches(n, s, seconds);
  assert.doesNotThrow(() => validateBattleSnapshot(n));
});

test('all wounds use one global elapsed clock through a diagonal route', () => {
  const s = field({hp: 85, bleeding: 1}, {}, [{id: 'ally', x: 1, y: 10, hp: 80, bleeding: 2}]);
  s.bleedSeconds = COMBAT_ROUND_SECONDS - 1;
  const route = getReachable(s, 'p').find(p => p.x === 5 && p.y === 5).path;
  assert.ok(route.every((p, i) => p.x !== (i ? route[i - 1].x : 1) && p.y !== (i ? route[i - 1].y : 1)));
  const n = move(s, 5, 5);
  let separate = s;
  for (const p of route) separate = move(separate, p.x, p.y);
  assert.equal(n.elapsedSeconds, separate.elapsedSeconds);
  assert.equal(n.bleedSeconds, separate.bleedSeconds);
  const ticks = Math.floor((s.bleedSeconds + n.elapsedSeconds) / COMBAT_ROUND_SECONDS);
  for (const id of ['p', 'ally']) {
    assert.equal(person(n, id).hp, person(s, id).hp - person(s, id).bleeding * ticks);
    for (const key of ['hp', 'bleeding', 'bandaged', 'unconscious', 'energy']) assert.equal(person(n, id)[key], person(separate, id)[key]);
  }
  clockMatches(n, s, separate.elapsedSeconds);
});

test('dawn starts contact at the first newly visible paid step without charging the rest of the route', () => {
  const stepSeconds = singleStepSeconds();
  const s = field({}, {hour: 5, secondOfHour: 3600 - stepSeconds - 1, enemies: [{id: 'e', x: 14, y: 1, facing: 6, overwatch: false}]});
  assert.equal(s.mode, 'exploration');
  assert.equal(s.night, true);
  const path = getReachable(s, 'p').find(p => p.x === 10 && p.y === 1).path;
  const n = move(s, 10, 1);
  assert.deepEqual({x: person(n).x, y: person(n).y}, path[1]);
  assert.equal(n.mode, 'combat');
  assert.equal(n.phase, 'player');
  assert.equal(canSee(n, person(n), person(n, 'e')), true);
  assert.equal(n.roundTimeCharged, false);
  clockMatches(n, s, stepSeconds * 2);
  assert.equal(n.bleedSeconds, stepSeconds * 2 % COMBAT_ROUND_SECONDS);
  const afterLook = order(n, {type: 'look', x: person(n).x, y: person(n).y + 1});
  assert.equal(afterLook.elapsedSeconds, n.elapsedSeconds + COMBAT_ROUND_SECONDS);
  assert.equal(afterLook.roundTimeCharged, true);
  assert.doesNotThrow(() => validateBattleSnapshot(n));
});

function torchField(remainingSeconds) {
  const ground = tiles();
  Object.assign(ground.find(t => t.x === 2 && t.y === 1), {type: 'wall', blocked: true, blocksSight: true});
  return field({}, {night: true, tiles: ground, enemies: [{id: 'e', x: 10, y: 1, facing: 6, overwatch: false}], lights: [
    {id: 'short-torch', type: 'torch', x: 10, y: 1, radius: 4, turns: 1, remainingSeconds},
  ]});
}

test('a torch that expires during a step cannot reveal an enemy after that step', () => {
  const options = {movementIntent: 'preserveFacing'}, stepSeconds = singleStepSeconds({}, options);
  const expired = torchField(stepSeconds), stillLit = torchField(stepSeconds + 1);
  assert.equal(expired.mode, 'exploration');
  assert.equal(stillLit.mode, 'exploration');
  const n = move(expired, 1, 5, options), lit = move(stillLit, 1, 5, options);
  assert.deepEqual({x: person(n).x, y: person(n).y}, {x: 1, y: 5});
  assert.equal(n.mode, 'exploration');
  assert.equal(canSee(n, person(n), person(n, 'e')), false);
  assert.equal(n.lights.length, 0);
  assert.deepEqual({x: person(lit).x, y: person(lit).y}, {x: 1, y: 2});
  assert.equal(lit.mode, 'combat');
  assert.equal(canSee(lit, person(lit), person(lit, 'e')), true);
  clockMatches(lit, stillLit, stepSeconds);
  clockMatches(n, expired, stepSeconds * 4);
  assert.doesNotThrow(() => validateBattleSnapshot(lit));
});

test('bundled posture setup costs the same time as its separate action and is paid once', () => {
  for (const [movement, stance] of [['crouch', 'crouched'], ['prone', 'prone']]) {
    const s = field({hp: 90, bleeding: 2});
    const setup = order(s, {type: 'stance', stance});
    const separate = move(setup, 5, 1), bundled = move(s, 5, 1, {movement});
    assert.ok(setup.elapsedSeconds > 0);
    assert.equal(bundled.elapsedSeconds, separate.elapsedSeconds);
    assert.equal(bundled.bleedSeconds, separate.bleedSeconds);
    assert.equal(person(bundled).hp, person(separate).hp);
    assert.equal(person(bundled).energy, person(separate).energy);
    const alreadyPrepared = field({movementMode: movement, stance});
    assert.equal(bundled.elapsedSeconds, setup.elapsedSeconds + move(alreadyPrepared, 5, 1, {movement}).elapsedSeconds);
    clockMatches(bundled, s, separate.elapsedSeconds);
  }
});

test('bleeding during paid posture setup stops the order before the first movement step', () => {
  const s = field({hp: CRITICAL_HEALTH, bleeding: 1}, {}, [{id: 'ally', x: 1, y: 10}]);
  s.bleedSeconds = COMBAT_ROUND_SECONDS - 1;
  const setup = order(s, {type: 'stance', stance: 'prone'});
  const n = move(s, 10, 1, {movement: 'prone'});
  assert.deepEqual({x: person(n).x, y: person(n).y}, {x: 1, y: 1});
  assert.equal(person(n).stance, 'prone');
  assert.equal(person(n).unconscious, true);
  assert.equal(person(n).hp, setup.units[0].hp);
  assert.equal(person(n).energy, person(s).energy);
  assert.equal(n.bleedSeconds, setup.bleedSeconds);
  clockMatches(n, s, setup.elapsedSeconds);
  assert.doesNotThrow(() => validateBattleSnapshot(n));
});

test('dawn during paid posture setup grants contact before any movement', () => {
  const setupSeconds = order(field(), {type: 'stance', stance: 'prone'}).elapsedSeconds;
  const s = field({}, {hour: 5, secondOfHour: 3600 - setupSeconds, enemies: [{id: 'e', x: 10, y: 1, facing: 6, overwatch: false}]});
  assert.equal(s.mode, 'exploration');
  const n = move(s, 7, 1, {movement: 'prone'});
  assert.equal(n.mode, 'combat');
  assert.equal(person(n).stance, 'prone');
  assert.deepEqual({x: person(n).x, y: person(n).y}, {x: 1, y: 1});
  assert.equal(person(n).energy, person(s).energy-2);
  assert.equal(person(n).fatigue,2); // The paid setup crosses the hourly fatigue tick.
  clockMatches(n, s, setupSeconds);
});

test('saved fractional wound and light clocks resume the same next move and rest', () => {
  let s = field({hp: 60, bleeding: 2}, {lights: [{id: 'torch', type: 'torch', x: 2, y: 8, radius: 3, turns: 1, remainingSeconds: 60}]}, [{id: 'ally', x: 1, y: 10}]);
  s = move(s, 2, 1);
  assert.ok(s.bleedSeconds > 0 && s.bleedSeconds < COMBAT_ROUND_SECONDS);
  const saved = validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
  const original = move(s, 7, 1), resumed = move(saved, 7, 1);
  assert.deepEqual(resumed, original);
  assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(original)))), endTurn(original));
  assert.doesNotThrow(() => validateBattleSnapshot(resumed));
});

test('invalid destinations and invalid bundled orders do not advance clock, wounds, or lights', () => {
  const s = field({hp: 30, bleeding: 2}, {lights: [{id: 'torch', type: 'torch', x: 2, y: 8, radius: 3, turns: 1, remainingSeconds: 1}]});
  s.bleedSeconds = COMBAT_ROUND_SECONDS - 1;
  Object.assign(s.tiles.find(t => t.x === 2 && t.y === 1), {type: 'wall', blocked: true});
  for (const action of [
    {x: -1, y: 1}, {x: 2, y: 1, movement: 'prone'}, {x: 1, y: 1, movement: 'crouch'},
    {x: 5, y: 1, movement: 'prone', movementIntent: 'invalid'},
  ]) {
    const n = actBattle(s, {type: 'move', unitId: 'p', ...action});
    assert.ok(n.lastError);
    assert.deepEqual(n.units, s.units);
    assert.equal(n.bleedSeconds, s.bleedSeconds);
    assert.equal(n.mode, s.mode);
    clockMatches(n, s, 0);
  }
});
