import type { BattleSnapshot, MoveAction } from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import { DomainRefusal, DomainRefusalCode } from '../packages/game/domain/shared/domain-refusal.ts';
import { SectorOperationTransaction } from '../packages/game/infrastructure/sector-sessions/sector-operation-repositories.js';
import { validateBattleSnapshot } from '../packages/game/validate-battle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  actBattle,
  endTurn,
  resumeSectorOperation,
  presentedActBattle,
} from '../packages/game/tactical.js';
import { runBattleJob } from '../packages/game/battle-job.ts';
import { admitSectorReinforcements } from '../packages/game/battle-handoff.js';
import { movementStep } from '../packages/game/movement-step.ts';
import { groupMovementStep } from '../packages/game/group-movement.ts';
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
const bound = (state: BattleSnapshot, seconds: number) => ({
  ...state,
  worldTimeLimitSecond: state.startSeconds + state.elapsedSeconds + seconds,
});
void test('hostile-arrival cutoff retains completed movement cells and excludes unaccepted presentation', () => {
  const source = bound(peaceful(), 7),
    before = structuredClone(source);
  const { state, frames } = presentedActBattle(source, { type: 'move', unitId: 1, x: 5, y: 2 });
  assert.equal(state.elapsedSeconds, 7);
  assert.equal(present(state.units[0]).x, 3);
  assert.equal(present(state.units[0]).ap, present(source.units[0]).ap);
  assert.ok(frames.length);
  assert.ok(frames.every((frame) => present(frame.state.units[0]).x <= 3));
  const pending = present(state.pendingSectorOperation);
  assert.equal(pending.kind, 'order');
  const order = present(pending.order);
  assert.equal(order.type, 'move');
  assert.equal(order.x, 5);
  assert.deepEqual(source, before);
  const completed = resumeSectorOperation(bound(state, 100));
  assert.equal(present(completed.units[0]).x, 5);
  assert.equal(completed.elapsedSeconds, 13);
  assert.equal(completed.pendingSectorOperation, undefined);
});
void test('an atomic combat action cannot spend AP, charge ammunition, change random seed or wound a target past cutoff', () => {
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
  assert.equal(present(next.units[0]).ap, present(before.units[0]).ap);
  assert.equal(present(next.units[0]).loaded, present(before.units[0]).loaded);
  assert.equal(present(next.units[1]).hp, present(before.units[1]).hp);
  assert.deepEqual(limited, before);
  const repeated = actBattle(next, { type: 'fire', unitId: 1, targetId: 'enemy' });
  assert.deepEqual(repeated, next);
});
void test('rest preserves partial duration through save-shaped copies and resumes exactly once', () => {
  const state = bound(peaceful(), 7);
  present(state.units[0]).energy = 20;
  const interrupted = endTurn(state);
  assert.equal(interrupted.elapsedSeconds, 7);
  const pending = present(interrupted.pendingSectorOperation);
  assert.equal(pending.kind, 'endTurn');
  assert.equal(pending.remainingRestSeconds, 593);
  const resumed = resumeSectorOperation(bound(structuredClone(interrupted), 1000));
  assert.equal(resumed.elapsedSeconds, 600);
  assert.equal(resumed.pendingSectorOperation, undefined);
  const uninterrupted = endTurn({ ...state, worldTimeLimitSecond: state.startSeconds + 1000 });
  assert.equal(present(resumed.units[0]).energy, present(uninterrupted.units[0]).energy);
});
void test('movement jobs retain their route and group formation while campaign time is paused', () => {
  const source = bound(peaceful(), 1),
    order: MoveAction = { type: 'move', unitId: 1, x: 4, y: 2 };
  const result = movementStep(source, order);
  assert.equal(result.status, 'interrupted');
  assert.equal(present(result.state.units[0]).x, 1);
  assert.equal(present(present(result.continuation).at(-1)).x, 4);
  const pending = present(result.state.pendingSectorOperation);
  assert.equal(pending.kind, 'order');
  const pendingOrder = present(pending.order);
  assert.equal(pendingOrder.type, 'move');
  assert.equal(pendingOrder.x, 4);
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
  assert.equal(present(paused.continuation).index, 0);
  assert.equal(present(paused.state.pendingSectorOperation).kind, 'groupMovement');
  const next = runBattleJob({ battle: bound(paused.state, 100), kind: 'resume' });
  assert.equal(present(next.units[0]).x, 4);
  assert.equal(present(next.units[1]).x, 4);
  assert.equal(next.pendingSectorOperation, undefined);
});
void test('reinforcements join the same visit and current combat without refreshing existing turn budgets', () => {
  const state = createBattle([{ id: 1, x: 2, y: 2 }], {
    id: 'visit-1',
    sector: 'buenos_aires',
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'enemy', x: 7, y: 2 }],
    hour: 12,
  });
  present(state.units[0]).ap = 17;
  present(state.units[1]).ap = 23;
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
  assert.equal(present(next.sectorSession).id, present(before.sectorSession).id);
  assert.equal(
    present(present(next.sectorSession).combat).id,
    present(present(before.sectorSession).combat).id,
  );
  assert.equal(next.turn, 4);
  assert.equal(next.phase, before.phase);
  assert.equal(present(next.units[0]).ap, 17);
  assert.equal(present(next.units[1]).ap, 23);
  assert.equal(present(next.units[2]).ap, 100);
  assert.equal(next.elapsedSeconds, before.elapsedSeconds);
  assert.deepEqual(state, before);
  assert.throws(() => admitSectorReinforcements(next, request));
  const blocked = structuredClone(state);
  for (const cell of blocked.tiles) {
    if (cell.x === 0) {
      cell.blocked = true;
    }
  }
  const blockedBefore = structuredClone(blocked);
  assert.throws(() => admitSectorReinforcements(blocked, request));
  assert.deepEqual(blocked, blockedBefore);
});

void test('interrupted reload preserves earned work and consumes exactly one cartridge on completion', () => {
  const state = peaceful();
  present(state.units[0]).loaded = 0;
  const before = structuredClone(state),
    partial = actBattle(bound(state, 1), { type: 'reload', unitId: 1 });
  assert.equal(partial.elapsedSeconds, 1);
  assert.equal(present(partial.units[0]).loaded, 0);
  assert.ok(present(present(partial.units[0]).reloadProgress) > 0);
  assert.equal(present(partial.units[0]).ammo, present(before.units[0]).ammo);
  const complete = resumeSectorOperation(bound(structuredClone(partial), 100));
  assert.equal(complete.elapsedSeconds, 3);
  assert.equal(present(complete.units[0]).loaded, 1);
  assert.equal(present(complete.units[0]).ammo, present(present(before.units[0]).ammo) - 1);
  assert.equal(complete.pendingSectorOperation, undefined);
  assert.deepEqual(state, before);
});

void test('a round at the exact arrival boundary keeps enemy continuation and does not repeat paid player work', () => {
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
  assert.equal(present(paused.pendingSectorOperation).kind, 'continue');
  assert.ok(paused.enemyTurn);
  assert.equal(present(paused.units[0]).hp, present(before.units[0]).hp);
  assert.equal(present(paused.units[1]).ap, present(before.units[1]).ap);
  const completed = runBattleJob({ battle: bound(paused, 100), kind: 'resume' });
  assert.equal(completed.pendingSectorOperation, undefined);
  assert.equal(completed.elapsedSeconds, 6);
  assert.equal(completed.phase, 'player');
  assert.deepEqual(
    completed.units,
    endTurn({ ...before, worldTimeLimitSecond: before.startSeconds + 100 }).units,
  );
});

void test('rest orders preserve their remaining duration through the same continuation as end turn', () => {
  const state = peaceful(),
    partial = actBattle(bound(state, 1), { type: 'rest' });
  const pending = present(partial.pendingSectorOperation);
  assert.equal(pending.kind, 'endTurn');
  assert.equal(pending.remainingRestSeconds, 599);
  const complete = resumeSectorOperation(bound(partial, 1000));
  assert.equal(complete.elapsedSeconds, 600);
});

void test('save validation restores unfinished orders and refuses malformed revision or continuation authority', () => {
  const paused = endTurn(bound(peaceful(), 1));
  assert.doesNotThrow(() => validateBattleSnapshot(structuredClone(paused)));
  const changes: ((state: BattleSnapshot) => void)[] = [
    (state) => (state.sectorRevision = -1),
    (state) => {
      const pending = present(state.pendingSectorOperation);
      assert.equal(pending.kind, 'endTurn');
      pending.remainingRestSeconds = 601;
    },
    (state) =>
      (present(state.pendingSectorOperation).interruptedAtSecond = state.startSeconds + 100),
  ];
  for (const change of changes) {
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
  const pendingGroup = present(malformed.pendingSectorOperation);
  assert.equal(pendingGroup.kind, 'groupMovement');
  present(pendingGroup.continuation.members[1]).unitId = 'missing';
  assert.throws(() => validateBattleSnapshot(malformed));
});

const revisionConflict = (error: Error) =>
  error instanceof DomainRefusal && error.code === DomainRefusalCode.RevisionConflict;

void test('sector revision exhaustion refuses actual orders, turns and continuations without changing their input', () => {
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
  assert.equal(present(partialTurn.pendingSectorOperation).kind, 'continue');
  const cases: [BattleSnapshot, (state: BattleSnapshot) => void][] = [
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

void test('the final safe sector revision can commit once and cannot publish further movement', () => {
  const source = { ...peaceful(), sectorRevision: Number.MAX_SAFE_INTEGER - 1 };
  const accepted = actBattle(source, { type: 'move', unitId: 1, x: 2, y: 2 });
  assert.equal(present(accepted.units[0]).x, 2);
  assert.equal(accepted.sectorRevision, Number.MAX_SAFE_INTEGER);
  assert.doesNotThrow(() => validateBattleSnapshot(accepted));
  const before = structuredClone(accepted);
  assert.throws(
    () => actBattle(accepted, { type: 'move', unitId: 1, x: 3, y: 2 }),
    revisionConflict,
  );
  assert.deepEqual(accepted, before);
});

void test('reinforcement admission refuses exhausted sector revisions before admitting any actor', () => {
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

void test('sector transaction commit independently rejects exhausted and stale revision authority', () => {
  const exhausted = { ...peaceful(), sectorRevision: Number.MAX_SAFE_INTEGER };
  const candidate = structuredClone(exhausted);
  present(candidate.units[0]).x++;
  const before = structuredClone(candidate);
  assert.throws(
    () => new SectorOperationTransaction(exhausted).commit(candidate, exhausted.sectorRevision),
    revisionConflict,
  );
  assert.deepEqual(candidate, before);
  const valid = new SectorOperationTransaction(peaceful());
  assert.throws(() => valid.commit(candidate, 99), revisionConflict);
});
