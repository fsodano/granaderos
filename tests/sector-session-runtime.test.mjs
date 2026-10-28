import { DomainRefusal, DomainRefusalCode } from '../game/domain/shared/domain-refusal.ts';
import { SectorOperationTransaction } from '../game/infrastructure/sector-sessions/sector-operation-repositories.js';
import { validateBattleSnapshot } from '../game/validate-battle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  actBattle,
  endTurn,
  resumeSectorOperation,
  presentedActBattle,
} from '../game/tactical.js';
import { runBattleJob } from '../game/battle-job.js';
import { admitSectorReinforcements } from '../game/battle-handoff.js';
import { movementStep } from '../game/movement-step.js';
import { groupMovementStep } from '../game/group-movement.js';
const flat = (width = 10, height = 8) =>
  Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
const peaceful = () =>
  createBattle([{ id: 1, x: 1, y: 2 }], {
    id: 'visit-1',
    sector: 'buenos_aires',
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [],
    exploration: true,
    hour: 12,
  });
const bound = (state, seconds) => ({
  ...state,
  worldTimeLimitSecond: state.startSeconds + state.elapsedSeconds + seconds,
});
test('hostile-arrival cutoff retains completed movement cells and excludes unaccepted presentation', () => {
  const source = bound(peaceful(), 7),
    before = structuredClone(source);
  const { state, frames } = presentedActBattle(source, { type: 'move', unitId: 1, x: 5, y: 2 });
  assert.equal(state.elapsedSeconds, 7);
  assert.equal(state.units[0].x, 3);
  assert.equal(state.units[0].ap, source.units[0].ap);
  assert.ok(frames.length);
  assert.ok(frames.every((frame) => frame.state.units[0].x <= 3));
  assert.equal(state.pendingSectorOperation.order.x, 5);
  assert.deepEqual(source, before);
  const completed = resumeSectorOperation(bound(state, 100));
  assert.equal(completed.units[0].x, 5);
  assert.equal(completed.elapsedSeconds, 13);
  assert.equal(completed.pendingSectorOperation, undefined);
});
test('an atomic combat action cannot spend AP, charge ammunition, change random seed or wound a target past cutoff', () => {
  const state = createBattle([{ id: 1, x: 1, y: 1 }], {
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'enemy', x: 5, y: 1, overwatch: false }],
    hour: 12,
    seed: 45,
  });
  const limited = bound(state, 3),
    before = structuredClone(limited),
    next = actBattle(limited, { type: 'fire', unitId: 1, targetId: 'enemy' });
  assert.equal(next.elapsedSeconds, 3);
  assert.equal(next.seed, before.seed);
  assert.equal(next.units[0].ap, before.units[0].ap);
  assert.equal(next.units[0].loaded, before.units[0].loaded);
  assert.equal(next.units[1].hp, before.units[1].hp);
  assert.deepEqual(limited, before);
  const repeated = actBattle(next, { type: 'fire', unitId: 1, targetId: 'enemy' });
  assert.deepEqual(repeated, next);
});
test('rest preserves partial duration through save-shaped copies and resumes exactly once', () => {
  const state = bound(peaceful(), 7);
  state.units[0].energy = 20;
  const interrupted = endTurn(state);
  assert.equal(interrupted.elapsedSeconds, 7);
  assert.equal(interrupted.pendingSectorOperation.remainingRestSeconds, 593);
  const resumed = resumeSectorOperation(bound(JSON.parse(JSON.stringify(interrupted)), 1000));
  assert.equal(resumed.elapsedSeconds, 600);
  assert.equal(resumed.pendingSectorOperation, undefined);
  const uninterrupted = endTurn({ ...state, worldTimeLimitSecond: state.startSeconds + 1000 });
  assert.equal(resumed.units[0].energy, uninterrupted.units[0].energy);
});
test('movement jobs retain their route and group formation while campaign time is paused', () => {
  const source = bound(peaceful(), 1),
    order = { type: 'move', unitId: 1, x: 4, y: 2 };
  const result = movementStep(source, order);
  assert.equal(result.status, 'interrupted');
  assert.equal(result.state.units[0].x, 1);
  assert.equal(result.continuation.at(-1).x, 4);
  assert.equal(result.state.pendingSectorOperation.order.x, 4);
  const group = createBattle(
    [
      { id: 1, x: 1, y: 2 },
      { id: 2, x: 1, y: 3 },
    ],
    { width: 10, height: 8, tiles: flat(), enemies: [], exploration: true, hour: 12 },
  );
  const request = { unitIds: [1, 2], anchorId: 1, x: 4, y: 2 };
  const paused = groupMovementStep(bound(group, 1), request);
  assert.equal(paused.status, 'interrupted');
  assert.equal(paused.continuation.index, 0);
  assert.equal(paused.state.pendingSectorOperation.kind, 'groupMovement');
  const next = runBattleJob({ battle: bound(paused.state, 100), kind: 'resume' });
  assert.equal(next.units[0].x, 4);
  assert.equal(next.units[1].x, 4);
  assert.equal(next.pendingSectorOperation, undefined);
});
test('reinforcements join the same visit and current combat without refreshing existing turn budgets', () => {
  const state = createBattle([{ id: 1, x: 2, y: 2 }], {
    id: 'visit-1',
    sector: 'buenos_aires',
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'enemy', x: 7, y: 2 }],
    hour: 12,
  });
  state.units[0].ap = 17;
  state.units[1].ap = 23;
  state.turn = 4;
  state.roundTimeCharged = true;
  const before = structuredClone(state),
    request = {
      sector: 'buenos_aires',
      squad: [
        { id: 2, entryReason: 'arrival', entryEdge: 'W', entryAnchor: { x: 0, y: 2 }, health: 100 },
      ],
    };
  const next = admitSectorReinforcements(state, request);
  assert.equal(next.sectorSession.id, before.sectorSession.id);
  assert.equal(next.sectorSession.combat.id, before.sectorSession.combat.id);
  assert.equal(next.turn, 4);
  assert.equal(next.phase, before.phase);
  assert.equal(next.units[0].ap, 17);
  assert.equal(next.units[1].ap, 23);
  assert.equal(next.units[2].ap, 100);
  assert.equal(next.elapsedSeconds, before.elapsedSeconds);
  assert.deepEqual(state, before);
  assert.throws(() => admitSectorReinforcements(next, request));
  const blocked = structuredClone(state);
  for (const cell of blocked.tiles) if (cell.x === 0) cell.blocked = true;
  const blockedBefore = structuredClone(blocked);
  assert.throws(() => admitSectorReinforcements(blocked, request));
  assert.deepEqual(blocked, blockedBefore);
});

test('interrupted reload preserves earned work and consumes exactly one cartridge on completion', () => {
  const state = peaceful();
  state.units[0].loaded = 0;
  const before = structuredClone(state),
    partial = actBattle(bound(state, 1), { type: 'reload', unitId: 1 });
  assert.equal(partial.elapsedSeconds, 1);
  assert.equal(partial.units[0].loaded, 0);
  assert.ok(partial.units[0].reloadProgress > 0);
  assert.equal(partial.units[0].ammo, before.units[0].ammo);
  const complete = resumeSectorOperation(bound(JSON.parse(JSON.stringify(partial)), 100));
  assert.equal(complete.elapsedSeconds, 3);
  assert.equal(complete.units[0].loaded, 1);
  assert.equal(complete.units[0].ammo, before.units[0].ammo - 1);
  assert.equal(complete.pendingSectorOperation, undefined);
  assert.deepEqual(state, before);
});

test('a round at the exact arrival boundary keeps enemy continuation and does not repeat paid player work', () => {
  const state = createBattle([{ id: 1, x: 1, y: 1 }], {
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'enemy', x: 6, y: 1 }],
    hour: 12,
    seed: 45,
  });
  const before = structuredClone(state),
    paused = endTurn(bound(state, 6));
  assert.equal(paused.elapsedSeconds, 6);
  assert.equal(paused.pendingSectorOperation.kind, 'continue');
  assert.ok(paused.enemyTurn);
  assert.equal(paused.units[0].hp, before.units[0].hp);
  assert.equal(paused.units[1].ap, before.units[1].ap);
  const completed = runBattleJob({ battle: bound(paused, 100), kind: 'resume' });
  assert.equal(completed.pendingSectorOperation, undefined);
  assert.equal(completed.elapsedSeconds, 6);
  assert.equal(completed.phase, 'player');
  assert.deepEqual(
    completed.units,
    endTurn({ ...before, worldTimeLimitSecond: before.startSeconds + 100 }).units,
  );
});

test('rest orders preserve their remaining duration through the same continuation as end turn', () => {
  const state = peaceful(),
    partial = actBattle(bound(state, 1), { type: 'rest' });
  assert.equal(partial.pendingSectorOperation.remainingRestSeconds, 599);
  const complete = resumeSectorOperation(bound(partial, 1000));
  assert.equal(complete.elapsedSeconds, 600);
});

test('save validation restores unfinished orders and refuses malformed revision or continuation authority', () => {
  const paused = endTurn(bound(peaceful(), 1));
  assert.doesNotThrow(() => validateBattleSnapshot(JSON.parse(JSON.stringify(paused))));
  for (const change of [
    (state) => (state.sectorRevision = -1),
    (state) => (state.pendingSectorOperation.remainingRestSeconds = 601),
    (state) => (state.pendingSectorOperation.interruptedAtSecond = state.startSeconds + 100),
  ]) {
    const malformed = structuredClone(paused);
    change(malformed);
    assert.throws(() => validateBattleSnapshot(malformed));
  }
  const group = createBattle(
    [
      { id: 1, x: 1, y: 2 },
      { id: 2, x: 1, y: 3 },
    ],
    { width: 10, height: 8, tiles: flat(), enemies: [], exploration: true, hour: 12 },
  );
  const pending = groupMovementStep(bound(group, 1), {
    unitIds: [1, 2],
    anchorId: 1,
    x: 4,
    y: 2,
  }).state;
  assert.doesNotThrow(() => validateBattleSnapshot(pending));
  const malformed = structuredClone(pending);
  malformed.pendingSectorOperation.continuation.members[1].unitId = 'missing';
  assert.throws(() => validateBattleSnapshot(malformed));
});

const revisionConflict = (error) =>
  error instanceof DomainRefusal && error.code === DomainRefusalCode.RevisionConflict;

test('sector revision exhaustion refuses actual orders, turns and continuations without changing their input', () => {
  const partialOrder = actBattle(bound(peaceful(), 1), { type: 'move', unitId: 1, x: 5, y: 2 });
  const partialRest = endTurn(bound(peaceful(), 1));
  const combat = createBattle([{ id: 1, x: 1, y: 1 }], {
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'enemy', x: 6, y: 1 }],
    hour: 12,
    seed: 45,
  });
  const partialTurn = endTurn(bound(combat, 6));
  assert.equal(partialTurn.pendingSectorOperation.kind, 'continue');
  const cases = [
    [peaceful(), (state) => actBattle(state, { type: 'move', unitId: 1, x: 5, y: 2 })],
    [peaceful(), (state) => presentedActBattle(state, { type: 'move', unitId: 1, x: 5, y: 2 })],
    [peaceful(), (state) => endTurn(state)],
    [partialOrder, (state) => resumeSectorOperation(state)],
    [partialRest, (state) => resumeSectorOperation(state)],
    [partialTurn, (state) => runBattleJob({ battle: state, kind: 'resume' })],
  ];
  for (const [original, execute] of cases) {
    const source = { ...bound(original, 1000), sectorRevision: Number.MAX_SAFE_INTEGER };
    const before = structuredClone(source);
    assert.doesNotThrow(() => validateBattleSnapshot(source));
    assert.throws(() => execute(source), revisionConflict);
    assert.deepEqual(source, before);
  }
});

test('the final safe sector revision can commit once and cannot publish further movement', () => {
  const source = { ...peaceful(), sectorRevision: Number.MAX_SAFE_INTEGER - 1 };
  const accepted = actBattle(source, { type: 'move', unitId: 1, x: 2, y: 2 });
  assert.equal(accepted.units[0].x, 2);
  assert.equal(accepted.sectorRevision, Number.MAX_SAFE_INTEGER);
  assert.doesNotThrow(() => validateBattleSnapshot(accepted));
  const before = structuredClone(accepted);
  assert.throws(
    () => actBattle(accepted, { type: 'move', unitId: 1, x: 3, y: 2 }),
    revisionConflict,
  );
  assert.deepEqual(accepted, before);
});

test('reinforcement admission refuses exhausted sector revisions before admitting any actor', () => {
  const source = { ...peaceful(), sectorRevision: Number.MAX_SAFE_INTEGER };
  const request = {
    sector: 'buenos_aires',
    squad: [
      { id: 2, entryReason: 'arrival', entryEdge: 'W', entryAnchor: { x: 0, y: 2 }, health: 100 },
    ],
  };
  const before = structuredClone(source);
  assert.throws(() => admitSectorReinforcements(source, request), revisionConflict);
  assert.deepEqual(source, before);
  const accepted = admitSectorReinforcements(
    { ...source, sectorRevision: Number.MAX_SAFE_INTEGER - 1 },
    request,
  );
  assert.equal(accepted.sectorRevision, Number.MAX_SAFE_INTEGER);
  assert.equal(accepted.units.length, source.units.length + 1);
  assert.doesNotThrow(() => validateBattleSnapshot(accepted));
});

test('sector transaction commit independently rejects exhausted and stale revision authority', () => {
  const exhausted = { ...peaceful(), sectorRevision: Number.MAX_SAFE_INTEGER };
  const candidate = structuredClone(exhausted);
  candidate.units[0].x++;
  const before = structuredClone(candidate);
  assert.throws(
    () => new SectorOperationTransaction(exhausted).commit(candidate, exhausted.sectorRevision),
    revisionConflict,
  );
  assert.deepEqual(candidate, before);
  const valid = new SectorOperationTransaction(peaceful());
  assert.throws(() => valid.commit(candidate, 99), revisionConflict);
});
