import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MILITIA_PATROL,
  MILITIA_PATROL_WAYPOINTS,
  canAct,
  militiaPatrolDestination,
  militiaPatrolsThisTurn,
  militiaPatrolWaypoint,
  militiaPatrolWaypointPoint,
  validateCampaignPatrol,
} from './militia-patrol.ts';
import type { MilitiaPatrolRules, PatrolUnit } from './militia-patrol.ts';

const campaignPatrol = Object.freeze({
  enabled: false,
  waypointTicks: 4,
  energyReserve: 40,
  restEnergy: 12,
});

const quickPatrol: MilitiaPatrolRules = Object.freeze({
  ...DEFAULT_MILITIA_PATROL,
  waypointTicks: 4,
});

const campaign = {
  contentCampaign: { package: { militiaPatrol: campaignPatrol } },
};

const arena = Object.freeze({ width: 8, height: 8 });
const field = Object.freeze({ width: 40, height: 30 });

const patrolUnit = (overrides: Partial<PatrolUnit> = {}): PatrolUnit => ({
  hp: 100,
  energy: 100,
  militia: true,
  ap: 100,
  x: 0,
  y: 0,
  ...overrides,
});

void test('the default militia patrol rules keep their values', () => {
  assert.deepEqual(DEFAULT_MILITIA_PATROL, {
    enabled: true,
    waypointTicks: 8,
    energyReserve: 50,
    restEnergy: 10,
  });
});

void test('the default militia patrol rules stay frozen', () => {
  assert.equal(Object.isFrozen(DEFAULT_MILITIA_PATROL), true);
});

void test('a scene whose patrol rules match the campaign is accepted', () => {
  assert.doesNotThrow(() =>
    validateCampaignPatrol(campaign, { militiaPatrol: { ...campaignPatrol } }),
  );
});

void test('a scene whose patrol rules disagree with the campaign is refused', () => {
  assert.throws(
    () =>
      validateCampaignPatrol(campaign, { militiaPatrol: { ...campaignPatrol, restEnergy: 11 } }),
    { message: 'Las reglas de patrulla no coinciden con la campaña.' },
  );
});

void test('a patrol cycles through the six fixed map points every waypoint turns', () => {
  assert.equal(MILITIA_PATROL_WAYPOINTS.length, 6);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 1), [0.55, 0.5]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 8), [0.55, 0.5]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 9), [0.75, 0.25]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 17), [0.85, 0.5]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 25), [0.75, 0.75]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 33), [0.4, 0.75]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 41), [0.4, 0.25]);
  assert.deepEqual(militiaPatrolWaypointPoint(DEFAULT_MILITIA_PATROL, 49), [0.55, 0.5]);
  assert.deepEqual(militiaPatrolWaypointPoint(quickPatrol, 1), [0.55, 0.5]);
  assert.deepEqual(militiaPatrolWaypointPoint(quickPatrol, 5), [0.75, 0.25]);
});

void test('a waypoint names the cell the fixed point falls on for the map size', () => {
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 1, field), { x: 21, y: 14 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 9, field), { x: 29, y: 7 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 17, field), { x: 33, y: 14 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 25, field), { x: 29, y: 21 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 33, field), { x: 15, y: 21 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 41, field), { x: 15, y: 7 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 1, arena), { x: 3, y: 3 });
  assert.deepEqual(militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 1, { width: 1, height: 1 }), {
    x: 0,
    y: 0,
  });
});

void test('a unit can act above the critical health and only while it still fights', () => {
  assert.equal(canAct(patrolUnit()), true);
  // A unit the table never gave an energy figure counts as rested.
  assert.equal(canAct({ hp: 100, ap: 100, x: 0, y: 0 }), true);
  assert.equal(canAct(patrolUnit({ hp: 15 })), true);
  assert.equal(canAct(patrolUnit({ energy: 1 })), true);
  assert.equal(canAct(patrolUnit({ hp: 14 })), false);
  assert.equal(canAct(patrolUnit({ hp: 0 })), false);
  assert.equal(canAct(patrolUnit({ energy: 0 })), false);
  assert.equal(canAct(patrolUnit({ routed: true })), false);
  assert.equal(canAct(patrolUnit({ fled: true })), false);
  assert.equal(canAct(patrolUnit({ surrendered: true })), false);
  assert.equal(canAct(patrolUnit({ departure: {} })), false);
});

void test('a militia that can act and sees no enemy patrols its turn', () => {
  assert.equal(militiaPatrolsThisTurn(DEFAULT_MILITIA_PATROL, patrolUnit(), 1, arena, false), true);
  assert.equal(
    militiaPatrolsThisTurn(DEFAULT_MILITIA_PATROL, patrolUnit({ ap: 25 }), 1, arena, false),
    true,
  );
  assert.equal(
    militiaPatrolsThisTurn(DEFAULT_MILITIA_PATROL, patrolUnit({ x: 0, y: 2 }), 1, arena, false),
    true,
  );
});

void test('a militia does not patrol when its rules, condition or sight forbid it', () => {
  const patrols = (unit: PatrolUnit, enemyInSight = false) =>
    militiaPatrolsThisTurn(DEFAULT_MILITIA_PATROL, unit, 1, arena, enemyInSight);

  assert.equal(
    militiaPatrolsThisTurn(
      { ...DEFAULT_MILITIA_PATROL, enabled: false },
      patrolUnit(),
      1,
      arena,
      false,
    ),
    false,
  );
  assert.equal(patrols(patrolUnit({ militia: false })), false);
  assert.equal(patrols(patrolUnit({ hp: 14 })), false);
  assert.equal(patrols(patrolUnit({ hp: 0 })), false);
  assert.equal(patrols(patrolUnit({ energy: 0 })), false);
  assert.equal(patrols(patrolUnit({ routed: true })), false);
  assert.equal(patrols(patrolUnit({ fled: true })), false);
  assert.equal(patrols(patrolUnit({ surrendered: true })), false);
  assert.equal(patrols(patrolUnit({ departure: {} })), false);
  assert.equal(patrols(patrolUnit({ knockedDown: true })), false);
  assert.equal(patrols(patrolUnit({ entangled: true })), false);
  assert.equal(patrols(patrolUnit({ patrol: false })), false);
  assert.equal(patrols(patrolUnit({ ap: 24 })), false);
  assert.equal(patrols(patrolUnit(), true), false);
  assert.equal(patrols(patrolUnit({ x: 3, y: 3 })), false);
  assert.equal(patrols(patrolUnit({ x: 3, y: 1 })), false);
  assert.equal(patrols(patrolUnit({ x: 3, y: 0 })), false);
});

void test('the patrol takes the reachable cell closest to its waypoint', () => {
  const unit = patrolUnit({ x: 0, y: 10 });
  const waypoint = { x: 10, y: 10 };
  assert.deepEqual(
    militiaPatrolDestination(unit, waypoint, [
      { x: 9, y: 10, cost: 30 },
      { x: 5, y: 10, cost: 2 },
    ]),
    { x: 9, y: 10, cost: 30 },
  );
});

void test('the patrol breaks distance ties by cost, then row, then column', () => {
  const unit = patrolUnit({ x: 0, y: 10 });
  const waypoint = { x: 10, y: 10 };
  assert.deepEqual(
    militiaPatrolDestination(unit, waypoint, [
      { x: 9, y: 10, cost: 30 },
      { x: 10, y: 9, cost: 2 },
    ]),
    { x: 10, y: 9, cost: 2 },
  );
  assert.deepEqual(
    militiaPatrolDestination(unit, waypoint, [
      { x: 7, y: 11, cost: 5 },
      { x: 7, y: 9, cost: 5 },
    ]),
    { x: 7, y: 9, cost: 5 },
  );
  assert.deepEqual(
    militiaPatrolDestination(unit, waypoint, [
      { x: 13, y: 9, cost: 5 },
      { x: 7, y: 9, cost: 5 },
    ]),
    { x: 7, y: 9, cost: 5 },
  );
});

void test('the patrol ignores cells it cannot afford or that do not bring it closer', () => {
  const unit = patrolUnit({ x: 0, y: 10 });
  const waypoint = { x: 10, y: 10 };
  assert.deepEqual(
    militiaPatrolDestination(unit, waypoint, [
      { x: 9, y: 10, cost: 0 },
      { x: 8, y: 10, cost: 33 },
      { x: 20, y: 10, cost: 10 },
      { x: 11, y: 10, cost: 12 },
    ]),
    { x: 11, y: 10, cost: 12 },
  );
  assert.equal(
    militiaPatrolDestination(patrolUnit({ x: 0, y: 10, ap: 40 }), waypoint, [
      { x: 11, y: 10, cost: 21 },
    ]),
    undefined,
  );
});

void test('a patrol on the eight by eight arena steps to the row the tie favours', () => {
  const waypoint = militiaPatrolWaypoint(DEFAULT_MILITIA_PATROL, 1, arena);
  assert.deepEqual(waypoint, { x: 3, y: 3 });
  assert.deepEqual(
    militiaPatrolDestination(patrolUnit(), waypoint, [
      { x: 3, y: 2, cost: 32 },
      { x: 2, y: 3, cost: 32 },
    ]),
    { x: 3, y: 2, cost: 32 },
  );
});
