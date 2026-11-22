import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_TACTICAL_LEVEL,
  sameCell,
  sameSurface,
  spaceKey,
  spacePoint,
  tacticalLevel,
  validTacticalLevel,
} from './tactical-space.ts';

void test('a point with no level is on level zero and a point with a level keeps it', () => {
  assert.equal(tacticalLevel({ x: 3, y: 4 }), 0);
  assert.equal(tacticalLevel({ x: 3, y: 4, tacticalLevel: 2 }), 2);
});

void test('a legal level is an integer from zero to eight', () => {
  assert.equal(MAX_TACTICAL_LEVEL, 8);
  assert.equal(validTacticalLevel(0), true);
  assert.equal(validTacticalLevel(8), true);
  assert.equal(validTacticalLevel(-1), false);
  assert.equal(validTacticalLevel(1.5), false);
  assert.equal(validTacticalLevel(9), false);
});

void test('the key of a cell names its level and its coordinates', () => {
  assert.equal(spaceKey({ x: 3, y: 4 }), '0:3,4');
  assert.equal(spaceKey({ x: 3, y: 4, tacticalLevel: 2 }), '2:3,4');
});

void test('two points on the same level and coordinates are the same cell', () => {
  assert.equal(
    sameSurface({ x: 3, y: 4, tacticalLevel: 2 }, { x: 9, y: 9, tacticalLevel: 2 }),
    true,
  );
  assert.equal(sameCell({ x: 3, y: 4 }, { x: 3, y: 4 }), true);
  assert.equal(sameCell({ x: 3, y: 4, tacticalLevel: 2 }, { x: 3, y: 4, tacticalLevel: 2 }), true);
});

void test('points on different levels are not the same cell even with the same coordinates', () => {
  assert.equal(
    sameSurface({ x: 3, y: 4, tacticalLevel: 2 }, { x: 9, y: 9, tacticalLevel: 1 }),
    false,
  );
  assert.equal(sameCell({ x: 3, y: 4 }, { x: 3, y: 4, tacticalLevel: 1 }), false);
});

void test('the space point of a record keeps its coordinates and its level', () => {
  assert.deepEqual(spacePoint({ x: 3, y: 4, tacticalLevel: 2 }), {
    x: 3,
    y: 4,
    tacticalLevel: 2,
  });
  assert.deepEqual(spacePoint({ x: 3, y: 4 }), { x: 3, y: 4, tacticalLevel: 0 });
});
