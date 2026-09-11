import test from 'node:test';
import assert from 'node:assert/strict';
import {FACING_LABELS, NOISE_KINDS, directionTo, facingAllowsSight, turnAPCost, stealthAPMultiplier, noiseRadius, approximateHeardPosition} from '../game/tactical-awareness.js';

test('grid directions cover all eight compass points and coincident points retain facing', () => {
  const origin = {x: 5, y: 5, facing: 3};
  const offsets = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  assert.deepEqual(FACING_LABELS, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  offsets.forEach(([x, y], index) => assert.equal(directionTo(origin, {x: 5 + x, y: 5 + y}), index));
  assert.equal(directionTo(origin, origin), 3);
  assert.equal(directionTo(origin, origin, 7), 7);
  assert.equal(directionTo({...origin, facing: undefined, side: 'player'}, origin), 2);
  assert.equal(directionTo({...origin, facing: undefined, side: 'enemy'}, origin), 6);
});

test('vision uses a real forward half-plane plus close peripheral awareness', () => {
  const north = {x: 5, y: 5, facing: 0};
  assert.equal(facingAllowsSight(north, {x: 5, y: 0}), true);
  assert.equal(facingAllowsSight(north, {x: 0, y: 5}), true);
  assert.equal(facingAllowsSight(north, {x: 10, y: 5}), true);
  assert.equal(facingAllowsSight(north, {x: 10, y: 6}), false);
  assert.equal(facingAllowsSight(north, {x: 5, y: 8}), false);
  assert.equal(facingAllowsSight(north, {x: 5, y: 7}), true);
  assert.equal(facingAllowsSight(north, {x: 6, y: 6}), true);
  assert.equal(facingAllowsSight(north, north), true);
  assert.equal(facingAllowsSight(north, {x: 5, y: 6}, {peripheralRange: 0}), false);
});

test('diagonal facing, optional narrower cones, and legacy deployment defaults are consistent', () => {
  const northeast = {x: 5, y: 5, facing: 1};
  assert.equal(facingAllowsSight(northeast, {x: 9, y: 9}), true);
  assert.equal(facingAllowsSight(northeast, {x: 1, y: 1}), true);
  assert.equal(facingAllowsSight(northeast, {x: 1, y: 2}), false);
  assert.equal(facingAllowsSight(northeast, {x: 9, y: 9}, {halfArc: 1}), false);
  assert.equal(facingAllowsSight({x: 0, y: 3, side: 'player'}, {x: 4, y: 3}), true);
  assert.equal(facingAllowsSight({x: 8, y: 3, side: 'enemy'}, {x: 4, y: 3}), true);
});

test('paid facing uses the shortest rotation and costs more while prone', () => {
  assert.equal(turnAPCost({facing: 7}, 0), 2);
  assert.equal(turnAPCost({facing: 0}, 7), 2);
  assert.equal(turnAPCost({facing: 0}, 4), 8);
  assert.equal(turnAPCost({facing: 6, stance: 'prone'}, 2), 16);
  assert.equal(turnAPCost({facing: 3, stance: 'crouched'}, 3), 0);
  assert.equal(turnAPCost({side: 'player'}, 2), 0);
});

test('stealth is separate from posture and trades movement AP for quieter steps', () => {
  const walking = {movementMode: 'walk', stealth: 50};
  assert.equal(stealthAPMultiplier(walking), 1);
  assert.equal(stealthAPMultiplier({...walking, stance: 'prone'}), 1);
  assert.equal(stealthAPMultiplier({...walking, stealthMode: true}), 1.25);
  assert.equal(noiseRadius('move', walking), 4);
  assert.equal(noiseRadius('move', {...walking, stealthMode: true}), 2);
  assert.ok(noiseRadius('move', {...walking, movementMode: 'run'}) > noiseRadius('move', walking));
  assert.ok(noiseRadius('move', {...walking, movementMode: 'prone'}) < noiseRadius('move', walking));
  assert.ok(noiseRadius('move', {...walking, stealth: 0, stealthMode: true}) > noiseRadius('move', {...walking, stealth: 100, stealthMode: true}));
});

test('terrain and mounts stay audible, while stealth never silences gunfire', () => {
  assert.equal(noiseRadius('move', {}, {type: 'stone'}), 6);
  assert.equal(noiseRadius('move', {mounted: true}), 8);
  assert.equal(noiseRadius('move', {mounted: true, stealthMode: true, stealth: 100}), 8);
  assert.equal(stealthAPMultiplier({mounted: true, stealthMode: true}), 1);
  assert.equal(noiseRadius('fire', {stealthMode: true, stealth: 100}), 18);
  assert.equal(noiseRadius('explosion'), 28);
  for (const kind of NOISE_KINDS) assert.ok(noiseRadius(kind) > 0);
});

test('carried load makes steps louder according to strength, inventory, rounds, and held weapons', () => {
  const base = {strength: 50, weapon: 1800, movementMode: 'walk'};
  assert.ok(noiseRadius('move', {...base, weight: 50}) > noiseRadius('move', base));
  assert.equal(noiseRadius('move', {...base, weight: 50}), noiseRadius('move', {...base, carryWeight: 50}));
  assert.ok(noiseRadius('move', {...base, inventory: {tools: {count: 2, weight: 20}}}) > noiseRadius('move', base));
  assert.ok(noiseRadius('move', {...base, ammo: 800}) > noiseRadius('move', base));
  assert.ok(noiseRadius('move', {...base, weight: 35, strength: 80}) < noiseRadius('move', {...base, weight: 35, strength: 20}));
  assert.ok(noiseRadius('move', {...base, weight: 24}) > noiseRadius('move', {...base, weight: 24, weaponDropped: true}));
  assert.ok(noiseRadius('move', {...base, weight: 50, stealthMode: true, stealth: 100}) < noiseRadius('move', {...base, weight: 50}));
});

test('facón attacks are quieter than a bayonet or sabre clash without suppressing firearm sound', () => {
  assert.equal(noiseRadius('melee', {weapon: 1813}), 3);
  assert.equal(noiseRadius('melee', {weapon: 1800, activeSlot: 'blade', blade: 1813}), 3);
  assert.equal(noiseRadius('melee', {weapon: 1800, activeSlot: 'primary', blade: 1813}), 7);
  assert.equal(noiseRadius('melee', {weapon: 1809}), 7);
  assert.equal(noiseRadius('melee', {weapon: 1813, activeSlot: 'tool', activeTool: 'inventory:crowbar'}), 7);
  assert.equal(noiseRadius('melee', {weapon: 1813, activeSlot: 'unarmed'}), 7);
  assert.equal(noiseRadius('melee', {weapon: 1813, weaponDropped: true}), 7);
  assert.equal(noiseRadius('melee', {weapon: 1813, activeSlot: 'medical'}), 7);
  assert.equal(noiseRadius('fire', {weapon: 1800, blade: 1813, stealthMode: true}), 18);
});

test('sound reaches a nearby listener behind them without revealing source identity or exact metadata', () => {
  const listener = {x: 1, y: 1, facing: 6};
  const source = {x: 4, y: 1, id: 'secret', side: 'enemy', hp: 72, weapon: 1800};
  assert.equal(facingAllowsSight(listener, source), false);
  const heard = approximateHeardPosition(listener, source, {kind: 'fire', radius: 18, turn: 3, width: 20, height: 10});
  assert.deepEqual(heard, {x: 2, y: 2, turn: 3, kind: 'fire', uncertainty: 3});
  assert.deepEqual(Object.keys(heard).sort(), ['kind', 'turn', 'uncertainty', 'x', 'y']);
  assert.ok(Math.hypot(source.x - heard.x, source.y - heard.y) <= heard.uncertainty);
});

test('distant, muffled, or unheard sounds create no report; walls attenuate without requiring sight', () => {
  const listener = {x: 0, y: 0}, source = {x: 6, y: 0};
  assert.equal(approximateHeardPosition(listener, source, {radius: 5}), null);
  assert.equal(approximateHeardPosition(listener, source, {radius: 8, obstructions: 1}), null);
  assert.ok(approximateHeardPosition(listener, source, {radius: 10, obstructions: 1}));
  assert.equal(approximateHeardPosition(listener, listener, {radius: 0}), null);
  assert.equal(approximateHeardPosition({...listener, hp: 0}, source, {radius: 20}), null);
  assert.equal(approximateHeardPosition({...listener, unconscious: true}, source, {radius: 20}), null);
});

test('night skill improves hearing and running reduces a listener’s perception', () => {
  const listener = {x: 0, y: 0}, source = {x: 6, y: 0};
  assert.equal(approximateHeardPosition(listener, source, {radius: 5, night: true}), null);
  assert.ok(approximateHeardPosition({...listener, traits: ['night_vision']}, source, {radius: 5, night: true}));
  assert.equal(approximateHeardPosition({...listener, traits: ['night_vision']}, source, {radius: 5}), null);
  assert.equal(approximateHeardPosition({...listener, movementMode: 'run'}, source, {radius: 7}), null);
});

test('heard positions remain bounded, deterministic, anonymous, and stable across nearby listeners', () => {
  const source = Object.freeze({x: 9, y: 7, id: 'hidden'}), listener = Object.freeze({x: 1, y: 1});
  const options = Object.freeze({kind: 'fire', radius: 18, turn: 1, width: 10, height: 8});
  const first = approximateHeardPosition(listener, source, options);
  assert.ok(first.x >= 0 && first.x < 10 && first.y >= 0 && first.y < 8);
  assert.deepEqual(approximateHeardPosition(listener, source, options), first);
  assert.deepEqual(approximateHeardPosition({x: 8, y: 7}, source, options), first);
  assert.deepEqual(source, {x: 9, y: 7, id: 'hidden'});
});

test('invalid direction, cost, noise kind, radius, and report input fail without mutating anything', () => {
  for (const invalid of [-1, 8, 1.5, NaN, '2', null]) assert.throws(() => turnAPCost({facing: 0}, invalid), RangeError);
  for (const invalid of ['gunshot', '__proto__', undefined, null]) assert.throws(() => noiseRadius(invalid), RangeError);
  assert.throws(() => directionTo({x: NaN, y: 0}, {x: 0, y: 0}), RangeError);
  assert.throws(() => facingAllowsSight({x: 0, y: 0}, {x: 1, y: 1}, {halfArc: 5}), RangeError);
  assert.throws(() => approximateHeardPosition({x: 0, y: 0}, {x: 1, y: 1}, {kind: 'secret-id', radius: 5}), RangeError);
  for (const extra of [{radius: NaN}, {radius: -1}, {turn: 1.5}, {width: 0}, {obstructions: -1}]) {
    assert.throws(() => approximateHeardPosition({x: 0, y: 0}, {x: 1, y: 1}, {radius: 5, ...extra}), RangeError);
  }
});
