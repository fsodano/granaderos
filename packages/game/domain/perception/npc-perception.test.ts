import assert from 'node:assert/strict';
import test from 'node:test';
import { approximateHeardPosition, directionTo } from './npc-perception.ts';

function refuses(message: string, run: () => unknown): void {
  assert.throws(run, { name: 'RangeError', message });
}

void test('a point with a non-finite coordinate is refused', () => {
  refuses('X coordinate is invalid.', () => directionTo({ x: Number.NaN, y: 0 }, { x: 0, y: 0 }));
  refuses('Y coordinate is invalid.', () => directionTo({ x: 0, y: 0 }, { x: 0, y: Infinity }));
  refuses('X coordinate is invalid.', () =>
    approximateHeardPosition({ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { radius: 8 }),
  );
});

void test('a facing outside the eight compass steps is refused', () => {
  refuses('Facing must be an integer from 0 to 7.', () =>
    directionTo({ x: 0, y: 0 }, { x: 1, y: 0 }, 8),
  );
  refuses('Facing must be an integer from 0 to 7.', () =>
    directionTo({ x: 0, y: 0, facing: 1.5 }, { x: 1, y: 0 }),
  );
});

void test('a listener on its own cell keeps the supplied or current facing', () => {
  assert.equal(directionTo({ x: 3, y: 3, facing: 5 }, { x: 3, y: 3 }), 5);
  assert.equal(directionTo({ x: 3, y: 3 }, { x: 3, y: 3 }), 0);
  assert.equal(directionTo({ x: 3, y: 3, side: 'player' }, { x: 3, y: 3 }), 2);
  assert.equal(directionTo({ x: 3, y: 3, side: 'enemy' }, { x: 3, y: 3 }), 6);
  assert.equal(directionTo({ x: 3, y: 3, facing: 1 }, { x: 3, y: 3 }, 6), 6);
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

void test('invalid sound report options are refused', () => {
  const listener = { x: 0, y: 0 };
  const source = { x: 1, y: 0 };
  refuses('Unknown noise kind: sparkle', () =>
    approximateHeardPosition(listener, source, { kind: 'sparkle', radius: 8 }),
  );
  refuses('Noise radius is invalid.', () =>
    approximateHeardPosition(listener, source, { radius: -1 }),
  );
  refuses('Sound obstructions is invalid.', () =>
    approximateHeardPosition(listener, source, { radius: 8, obstructions: -1 }),
  );
  refuses('Sound turn must be a nonnegative integer.', () =>
    approximateHeardPosition(listener, source, { radius: 8, turn: 1.5 }),
  );
  refuses('Map dimensions must be positive integers.', () =>
    approximateHeardPosition(listener, source, { radius: 8, width: 0 }),
  );
  refuses('Map dimensions must be positive integers.', () =>
    approximateHeardPosition(listener, source, { radius: 8, height: 2.5 }),
  );
});

void test('a dead or unconscious listener is not told about the sound', () => {
  const source = { x: 1, y: 0 };
  assert.equal(approximateHeardPosition({ x: 0, y: 0, hp: 0 }, source, { radius: 8 }), null);
  assert.equal(approximateHeardPosition({ x: 0, y: 0, hp: -5 }, source, { radius: 8 }), null);
  assert.equal(
    approximateHeardPosition({ x: 0, y: 0, unconscious: true }, source, { radius: 8 }),
    null,
  );
  assert.deepEqual(approximateHeardPosition({ x: 0, y: 0, hp: 1 }, source, { radius: 8 }), {
    x: 1,
    y: 1,
    turn: 0,
    kind: 'move',
    uncertainty: 2,
  });
});

void test('night vision and running change the radius that reaches the sound', () => {
  const source = { x: 9, y: 0 };
  assert.equal(
    approximateHeardPosition({ x: 0, y: 0, traits: ['night_vision'] }, source, {
      radius: 8,
      night: false,
    }),
    null,
  );
  assert.deepEqual(
    approximateHeardPosition({ x: 0, y: 0, traits: ['night_vision'] }, source, {
      radius: 8,
      night: true,
    }),
    { x: 10, y: 1, turn: 0, kind: 'move', uncertainty: 2 },
  );
  assert.deepEqual(
    approximateHeardPosition({ x: 0, y: 0, traits: ['night_vision_basic'] }, source, {
      radius: 8,
      night: true,
    }),
    { x: 10, y: 1, turn: 0, kind: 'move', uncertainty: 2 },
  );
  assert.equal(
    approximateHeardPosition({ x: 0, y: 0, movementMode: 'run' }, source, { radius: 10 }),
    null,
  );
  assert.deepEqual(
    approximateHeardPosition({ x: 0, y: 0, movementMode: 'walk' }, source, { radius: 10 }),
    { x: 7, y: 2, turn: 0, kind: 'move', uncertainty: 3 },
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

void test('the reported position is clamped to the map bounds when they are given', () => {
  const listener = { x: 14, y: 14 };
  assert.deepEqual(
    approximateHeardPosition(listener, listener, {
      kind: 'alarm',
      radius: 8,
      turn: 3,
      width: 5,
      height: 5,
    }),
    { x: 4, y: 4, turn: 3, kind: 'alarm', uncertainty: 2 },
  );
  assert.deepEqual(
    approximateHeardPosition(listener, listener, { kind: 'alarm', radius: 8, turn: 3 }),
    {
      x: 13,
      y: 13,
      turn: 3,
      kind: 'alarm',
      uncertainty: 2,
    },
  );
});

void test('sound report options default to a move at turn zero with no bounds', () => {
  assert.deepEqual(approximateHeardPosition({ x: 10, y: 10 }, { x: 10, y: 10 }, { radius: 8 }), {
    x: 10,
    y: 10,
    turn: 0,
    kind: 'move',
    uncertainty: 2,
  });
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
