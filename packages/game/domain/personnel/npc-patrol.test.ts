import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CIVILIAN_PATROL_DIRECTIONS,
  civilianPatrolAim,
  civilianPatrolDirection,
  civilianPatrolDestination,
  civilianPatrolsThisTurn,
} from './npc-patrol.ts';
import type { CivilianPatrolReachableCell, CivilianPatrolUnit } from './npc-patrol.ts';

const origin = Object.freeze({ x: 10, y: 10 });

const civilian = (overrides: Partial<CivilianPatrolUnit> = {}): CivilianPatrolUnit => ({
  id: 'c1',
  hp: 100,
  patrolOrigin: origin,
  x: 10,
  y: 10,
  ...overrides,
});

const cell = (x: number, y: number, cost: number, steps = 1): CivilianPatrolReachableCell => ({
  x,
  y,
  cost,
  path: Array.from({ length: steps }, () => ({})),
});

void test('the civilian patrol cycles through four fixed directions of one bound', () => {
  assert.equal(CIVILIAN_PATROL_DIRECTIONS.length, 4);
  assert.deepEqual(CIVILIAN_PATROL_DIRECTIONS, [
    [0, -4],
    [4, 0],
    [0, 4],
    [-4, 0],
  ]);
});

void test('the direction follows the turn and the identity of the civilian', () => {
  // The identifiers sum their character codes: "c1" adds 148 and "c2" adds 149,
  // so their directions run one step apart on every turn.
  assert.deepEqual(civilianPatrolDirection(civilian(), 1), [4, 0]);
  assert.deepEqual(civilianPatrolDirection(civilian(), 2), [0, 4]);
  assert.deepEqual(civilianPatrolDirection(civilian(), 3), [-4, 0]);
  assert.deepEqual(civilianPatrolDirection(civilian(), 4), [0, -4]);
  assert.deepEqual(civilianPatrolDirection(civilian(), 5), [4, 0]);
  assert.deepEqual(civilianPatrolDirection(civilian({ id: 'c2' }), 1), [0, 4]);
  assert.deepEqual(civilianPatrolDirection(civilian({ id: 'c2' }), 2), [-4, 0]);
  assert.deepEqual(civilianPatrolDirection(civilian({ id: 'c2' }), 3), [0, -4]);
  assert.deepEqual(civilianPatrolDirection(civilian({ id: 7 }), 1), [0, -4]);
  assert.deepEqual(civilianPatrolDirection(civilian({ id: 7 }), 2), [4, 0]);
});

void test('two civilians with different identities do not always aim the same way', () => {
  assert.notDeepEqual(
    civilianPatrolDirection(civilian({ id: 'c1' }), 1),
    civilianPatrolDirection(civilian({ id: 'c2' }), 1),
  );
  assert.notDeepEqual(
    civilianPatrolDirection(civilian({ id: 'miliciano' }), 2),
    civilianPatrolDirection(civilian({ id: 42 }), 2),
  );
});

void test('the aim is one bound from the patrol origin in the direction of the turn', () => {
  assert.deepEqual(civilianPatrolAim(civilian(), 1), { x: 14, y: 10 });
  assert.deepEqual(civilianPatrolAim(civilian(), 2), { x: 10, y: 14 });
  assert.deepEqual(civilianPatrolAim(civilian({ id: 'c2' }), 1), { x: 10, y: 14 });
  assert.deepEqual(civilianPatrolAim(civilian({ patrolOrigin: { x: 4, y: 6 } }), 4), {
    x: 4,
    y: 2,
  });
});

void test('a civilian posted and able patrols its turn', () => {
  assert.equal(civilianPatrolsThisTurn(civilian(), 1), true);
  assert.equal(civilianPatrolsThisTurn(civilian({ id: 42, x: 4, y: 6 }), 3), true);
  // A patrol order that already ran on another turn still patrols this one.
  assert.equal(civilianPatrolsThisTurn(civilian({ patrolTurn: 2 }), 1), true);
});

void test('a civilian does not patrol without a post, an order, or its footing', () => {
  const patrols = (unit: CivilianPatrolUnit, turn = 1) => civilianPatrolsThisTurn(unit, turn);

  assert.equal(patrols(civilian({ patrolOrigin: undefined })), false);
  assert.equal(patrols(civilian({ patrolOrigin: null })), false);
  assert.equal(patrols(civilian({ patrol: false })), false);
  assert.equal(patrols(civilian({ patrolTurn: 1 })), false);
  assert.equal(patrols(civilian({ patrolTurn: 1 }), 2), true);
  assert.equal(patrols(civilian({ hp: 0 })), false);
  assert.equal(patrols(civilian({ hp: -3 })), false);
  assert.equal(patrols(civilian({ unconscious: true })), false);
  assert.equal(patrols(civilian({ routed: true })), false);
  assert.equal(patrols(civilian({ departure: {} })), false);
  assert.equal(patrols(civilian({ knockedDown: true })), false);
  assert.equal(patrols(civilian({ entangled: true })), false);
});

void test('the patrol takes the reachable cell closest to its aim', () => {
  // The turn 1 aim of "c1" is (14, 10), four cells right of its origin.
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(11, 10, 8), cell(13, 10, 12, 2)]),
    cell(13, 10, 12, 2),
  );
});

void test('the patrol breaks aim-distance ties by cost, then row, then column', () => {
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(13, 9, 9, 2), cell(13, 11, 5, 2)]),
    cell(13, 11, 5, 2),
  );
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(12, 11, 5, 2), cell(12, 9, 5, 2)]),
    cell(12, 9, 5, 2),
  );
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(16, 10, 5, 2), cell(12, 10, 5, 2)]),
    cell(12, 10, 5, 2),
  );
});

void test('the patrol ignores cells it cannot afford, reach or leave its post for', () => {
  const reachable = [
    cell(13, 10, 0),
    cell(13, 10, 25),
    cell(13, 10, 5, 4),
    cell(17, 10, 5, 2),
    cell(16, 10, 5, 2),
  ];
  assert.deepEqual(civilianPatrolDestination(civilian(), 1, reachable), cell(16, 10, 5, 2));
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(13, 10, 24), cell(12, 10, 3)]),
    cell(13, 10, 24),
  );
  assert.deepEqual(
    civilianPatrolDestination(civilian(), 1, [cell(13, 10, 5, 3), cell(12, 10, 5, 2)]),
    cell(13, 10, 5, 3),
  );
});

void test('the patrol stays put when no reachable cell brings it closer to the aim', () => {
  assert.equal(
    civilianPatrolDestination(civilian(), 1, [cell(9, 10, 2), cell(10, 7, 2)]),
    undefined,
  );
  assert.equal(civilianPatrolDestination(civilian(), 1, []), undefined);
});
