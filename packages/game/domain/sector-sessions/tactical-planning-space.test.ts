import assert from 'node:assert/strict';
import test from 'node:test';
import { atHand, moveOrder, planningPoint } from './tactical-planning-space.ts';

void test('a flat point stays flat', () => {
  assert.deepEqual(planningPoint({ x: 3, y: 4 }), { x: 3, y: 4 });
});

void test('an elevated point names its ground level', () => {
  assert.deepEqual(planningPoint({ x: 3, y: 4 }, true), { x: 3, y: 4, tacticalLevel: 0 });
});

void test('a point that already carries a level keeps it', () => {
  assert.deepEqual(planningPoint({ x: 3, y: 4, tacticalLevel: 2 }), {
    x: 3,
    y: 4,
    tacticalLevel: 2,
  });
  assert.deepEqual(planningPoint({ x: 3, y: 4, tacticalLevel: 2 }, true), {
    x: 3,
    y: 4,
    tacticalLevel: 2,
  });
});

void test('the order a plan produces names the destination and the combatant', () => {
  assert.deepEqual(moveOrder({}, { id: 'u1' }, { x: 3, y: 4 }), {
    type: 'move',
    unitId: 'u1',
    x: 3,
    y: 4,
  });
  assert.deepEqual(moveOrder({ upperSurfaces: [{}] }, { id: 'u1' }, { x: 3, y: 4 }), {
    type: 'move',
    unitId: 'u1',
    x: 3,
    y: 4,
    tacticalLevel: 0,
  });
  assert.deepEqual(
    moveOrder({}, { id: 7 }, { x: 1.5, y: -2 }, { movement: 'run', conversationTargetId: 'c9' }),
    {
      type: 'move',
      unitId: 7,
      x: 1.5,
      y: -2,
      movement: 'run',
      conversationTargetId: 'c9',
    },
  );
});

void test('a hand reaches only within range on the same ground level', () => {
  assert.equal(atHand({ x: 0, y: 0 }, { x: 0.6, y: 0.8 }), true);
  assert.equal(atHand({ x: 0, y: 0 }, { x: 2, y: 2 }), false);
  assert.equal(atHand({ x: 0, y: 0 }, { x: 0.6, y: 0.8, tacticalLevel: 1 }), false);
  assert.equal(
    atHand({ x: 0, y: 0, tacticalLevel: 1 }, { x: 0.6, y: 0.8, tacticalLevel: 1 }),
    true,
  );
});
