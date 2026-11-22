import assert from 'node:assert/strict';
import test from 'node:test';
import { approximateHeardPosition, directionTo } from './npc-perception.ts';

void test('a listener looking at its own cell keeps its current facing', () => {
  assert.equal(directionTo({ x: 3, y: 3, facing: 5 }, { x: 3, y: 3 }), 5);
  assert.equal(directionTo({ x: 3, y: 3 }, { x: 3, y: 3 }), 0);
});

void test('the direction to a point follows the eight compass steps', () => {
  const origin = { x: 10, y: 10 };
  const steps = [
    ['north', { x: 10, y: 5 }, 0],
    ['north-east', { x: 15, y: 5 }, 1],
    ['east', { x: 15, y: 10 }, 2],
    ['south-east', { x: 15, y: 15 }, 3],
    ['south', { x: 10, y: 15 }, 4],
    ['south-west', { x: 5, y: 15 }, 5],
    ['west', { x: 5, y: 10 }, 6],
    ['north-west', { x: 5, y: 5 }, 7],
  ] as const;
  for (const [label, point, expected] of steps) {
    assert.equal(directionTo(origin, point), expected, label);
  }
});

void test('a sound inside the radius produces an approximate position', () => {
  assert.deepEqual(
    approximateHeardPosition(
      { x: 10, y: 10 },
      { x: 14, y: 14 },
      { kind: 'fire', radius: 8, turn: 4, width: 30, height: 30 },
    ),
    { x: 13, y: 13, turn: 4, kind: 'fire', uncertainty: 2 },
  );
});

void test('a sound beyond the radius produces no report', () => {
  assert.equal(
    approximateHeardPosition(
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { kind: 'fire', radius: 8, turn: 4, width: 30, height: 30 },
    ),
    null,
  );
  assert.equal(
    approximateHeardPosition(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { kind: 'fire', radius: 0, turn: 4, width: 30, height: 30 },
    ),
    null,
  );
});

void test('obstructions shrink the radius so a previously heard sound is lost', () => {
  const listener = { x: 0, y: 0 };
  const source = { x: 10, y: 0 };
  const options = { kind: 'explosion', radius: 12, turn: 7, width: 30, height: 30 };
  assert.deepEqual(approximateHeardPosition(listener, source, options), {
    x: 12,
    y: 2,
    turn: 7,
    kind: 'explosion',
    uncertainty: 3,
  });
  assert.equal(approximateHeardPosition(listener, source, { ...options, obstructions: 1 }), null);
});

void test('the approximate position stays inside the map bounds', () => {
  const report = approximateHeardPosition(
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { kind: 'alarm', radius: 12, turn: 0, width: 2, height: 2 },
  );
  assert.deepEqual(report, { x: 1, y: 1, turn: 0, kind: 'alarm', uncertainty: 3 });
  assert.ok(report);
  assert.ok(report.x >= 0 && report.x < 2 && report.y >= 0 && report.y < 2);
});

void test('the report carries no shooter identity', () => {
  const listener = { id: 'listener-1', x: 10, y: 10 };
  const source = { id: 'shooter-42', x: 14, y: 14 };
  const report = approximateHeardPosition(listener, source, {
    kind: 'fire',
    radius: 8,
    turn: 4,
    width: 30,
    height: 30,
  });
  assert.ok(report);
  assert.deepEqual(Object.keys(report), ['x', 'y', 'turn', 'kind', 'uncertainty']);
  assert.equal('id' in report, false);
  assert.equal('shooterId' in report, false);
});
