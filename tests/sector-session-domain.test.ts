import { present } from './assert-present.ts';
import { EnterSectorUseCase } from '../packages/game/application/sector-sessions/enter-sector/enter-sector.use-case.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SectorSession } from '../packages/game/domain/sector-sessions/sector-session.ts';
import {
  CombatSession,
  CombatPhase,
  CombatOutcome,
} from '../packages/game/domain/combat/combat-session.ts';
import {
  ActionPoints,
  ActionPointPolicy,
  CombatRefusalCode,
} from '../packages/game/domain/combat/action-points.ts';
import { SectorParticipant } from '../packages/game/domain/sector-sessions/sector-participant.ts';
import {
  SectorDeployment,
  DeploymentRefusalCode,
} from '../packages/game/domain/sector-sessions/sector-deployment.ts';
import { SectorTimeBudget } from '../packages/game/domain/sector-sessions/sector-time-budget.ts';
import { SectorTimeLimitReached } from '../packages/game/domain/sector-sessions/sector-time-limit-reached.ts';
import {
  SectorOperationRunner,
  type SectorOperationState,
} from '../packages/game/application/sector-sessions/sector-operation-runner.ts';
import { ExecuteSectorOrderUseCase } from '../packages/game/application/sector-sessions/execute-sector-order/execute-sector-order.use-case.ts';

const clear = { visualContact: false, automaticActionsPending: false, routedParticipants: false };
void test('one sector visit owns several bounded combat episodes with stable identities', () => {
  const session = SectorSession.enter('visit-1', 'buenos_aires', true);
  assert.throws(() => session.startCombat('player', 1), {
    code: CombatRefusalCode.InvalidCombatPhase,
  });
  session.confirmDeployment();
  session.admitParticipants(['person-1']);
  const first = session.startCombat('player', 1);
  first.finish(CombatOutcome.Victory);
  session.resumeExploration(clear);
  const second = session.startCombat('enemy', 4);
  assert.equal(second.id, 'visit-1:combat:2');
  assert.equal(session.id, 'visit-1');
  assert.deepEqual(session.snapshot().completedCombatSessions, [
    { id: 'visit-1:combat:1', outcome: CombatOutcome.Victory, completedAtRound: 1 },
  ]);
  const saved = structuredClone(session.snapshot());
  assert.deepEqual(SectorSession.restore(saved).snapshot(), saved);
  Reflect.set(present(saved.participantIds), saved.participantIds?.length ?? 0, 'outside');
  assert.deepEqual(session.snapshot().participantIds, ['person-1']);
  assert.throws(() => session.admitParticipants(['person-1']), {
    code: CombatRefusalCode.InvalidParticipant,
  });
});
void test('combat quiet rounds, authority, result and clock charging belong to CombatSession', () => {
  const combat = CombatSession.begin('combat-1', 1, 'player');
  assert.equal(combat.chargeRoundTime(), true);
  assert.equal(combat.chargeRoundTime(), false);
  combat.beginEnemyPhase();
  assert.equal(combat.phase, CombatPhase.Enemy);
  combat.finishRound(false);
  assert.equal(combat.allowsExploration(clear), false);
  combat.finishRound(false);
  assert.equal(combat.allowsExploration(clear), false);
  combat.finishRound(false);
  assert.equal(combat.allowsExploration(clear), true);
  for (const key of Object.keys(clear)) {
    assert.equal(combat.allowsExploration({ ...clear, [key]: true }), false);
  }
  combat.recordVisualContact();
  assert.equal(combat.allowsExploration(clear), false);
  combat.finish(CombatOutcome.Defeat);
  assert.throws(() => combat.beginEnemyPhase(), { code: CombatRefusalCode.CombatAlreadyCompleted });
});
void test('participant action points refuse overspending and carry only the bounded unused budget', () => {
  const participant = SectorParticipant.restore({
    characterId: 'person-1',
    actionPoints: 41,
    maximumActionPoints: 100,
    carriedActionPoints: 0,
  });
  participant.spend(10);
  assert.equal(participant.actionPoints, 31);
  assert.throws(() => participant.spend(32), { code: CombatRefusalCode.InsufficientActionPoints });
  participant.beginTurn(65);
  assert.equal(participant.actionPoints, 85);
  participant.lose(80);
  participant.beginTurn(65);
  assert.equal(participant.actionPoints, 70);
  participant.becomeUnableToAct();
  assert.equal(participant.actionPoints, 0);
  assert.throws(() => ActionPoints.of(-1), { code: CombatRefusalCode.InvalidActionPoints });
});
void test('condition policy derives turn capacity from health, energy, altitude and protection', () => {
  const policy = new ActionPointPolicy({ woundMaximumPenalty: 50, energyPenaltyPerPoint: 0.2 });
  const healthy = {
    health: 100,
    maximumHealth: 100,
    bandagedWounds: 0,
    energy: 100,
    fatigue: 0,
    agility: 75,
    dexterity: 75,
    experienceLevel: 4,
    departed: false,
    surrendered: false,
    routed: false,
    adaptedToFatigue: false,
    protectedFromWeather: true,
  };
  assert.equal(policy.maximum(healthy, { highAltitude: false, raining: false }), 100);
  assert.equal(
    policy.maximum({ ...healthy, health: 14 }, { highAltitude: false, raining: false }),
    0,
  );
  assert.equal(policy.maximum(healthy, { highAltitude: true, raining: false }), 85);
  assert.equal(
    policy.maximum(
      { ...healthy, protectedFromWeather: false },
      { highAltitude: true, raining: false },
    ),
    75,
  );
  assert.ok(
    policy.maximum(
      { ...healthy, health: 50, bandagedWounds: 50 },
      { highAltitude: false, raining: false },
    ) > policy.maximum({ ...healthy, health: 50 }, { highAltitude: false, raining: false }),
  );
});
const cells = {
  N: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  E: [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
  S: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  W: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ],
};
void test('deployment placement is atomic, exclusive and constrained to each arrival edge', () => {
  const deployment = SectorDeployment.restore(
    {
      participants: [
        { characterId: 'one', entryEdge: 'N' },
        { characterId: 'two', entryEdge: 'N' },
      ],
      placements: {},
    },
    cells,
  );
  deployment.place(['one', 'two'], { x: 0, y: 0 });
  assert.equal(deployment.ready, true);
  const before = deployment.snapshot();
  assert.throws(() => deployment.place(['one'], { x: 0, y: 1 }), {
    code: DeploymentRefusalCode.InvalidEntryPoint,
  });
  assert.deepEqual(deployment.snapshot(), before);
  assert.throws(() => deployment.confirm(cells.N), { code: DeploymentRefusalCode.EntryBlocked });
  assert.deepEqual(deployment.snapshot(), before);
  deployment.clear(['two']);
  assert.throws(() => deployment.confirm([]), { code: DeploymentRefusalCode.Incomplete });
  deployment.spread();
  assert.equal(deployment.ready, true);
  assert.equal(
    new Set(Object.values(deployment.confirm([])).map((point) => `${point.x},${point.y}`)).size,
    2,
  );
});
void test('a sector operation restores only accepted progress and rolls back transient effects', () => {
  const state: SectorOperationState & { work: number; elapsedSeconds: number } = {
    startSeconds: 0,
    elapsedSeconds: 0,
    worldTimeLimitSecond: 7,
    work: 0,
  };
  let effects = 0;
  const runner = new SectorOperationRunner(
    state,
    { kind: 'order', order: { type: 'work' } },
    {
      checkpoint: () => effects,
      restore: (value) => {
        assert.ok(typeof value === 'number');
        effects = value;
      },
    },
  );
  const result = runner.execute(
    (next) => {
      next.elapsedSeconds = 3;
      next.work = 1;
      effects = 1;
      runner.checkpoint(next);
      next.work = 2;
      effects = 2;
      SectorTimeBudget.restore(next).assertCanAdvance(5);
      return next;
    },
    (next, seconds) => {
      next.elapsedSeconds += seconds;
    },
  );
  assert.equal(result.work, 1);
  assert.equal(result.elapsedSeconds, 7);
  assert.equal(effects, 1);
  assert.equal(present(present(result.pendingSectorOperation).order).type, 'work');
  assert.deepEqual(state, { startSeconds: 0, elapsedSeconds: 0, worldTimeLimitSecond: 7, work: 0 });
  assert.throws(
    () => SectorTimeBudget.restore(result).assertCanStartOperation(),
    SectorTimeLimitReached,
  );
});
void test('execute-sector-order loads through its own repository and refuses stale commits', () => {
  const stored = { startSeconds: 0, elapsedSeconds: 0, work: 2 };
  const committed: (typeof stored)[] = [];
  const repository = {
    loadSectorOrder: () => ({ snapshot: stored, revision: 4 }),
    commitSectorOrder: (snapshot: typeof stored, revision: number) => {
      assert.equal(revision, 4);
      committed.push(snapshot);
    },
  };
  const makeRunner = (snapshot: typeof stored) =>
    new SectorOperationRunner(
      snapshot,
      { kind: 'order', order: { type: 'work' } },
      { checkpoint: () => null, restore: () => {} },
    );
  const useCase = new ExecuteSectorOrderUseCase(
    repository,
    makeRunner,
    (snapshot) => ({ ...snapshot, work: snapshot.work + 1 }),
    () => {},
  );
  assert.equal(useCase.execute({ order: { type: 'work' } }).work, 3);
  assert.equal(present(committed[0]).work, 3);
  assert.equal(stored.work, 2);
  repository.commitSectorOrder = () => {
    throw Error('stale-sector-operation');
  };
  assert.throws(() => useCase.execute({ order: { type: 'work' } }), /stale-sector-operation/);
});

void test('sector entry admits one visit with unique participants and resumes without another creation', () => {
  const committed: SectorSession[] = [];
  const request = {
    sessionId: 'visit-entry',
    sectorId: 'sector-one',
    participantIds: ['one', 'two'],
    deploymentRequired: true,
  };
  const repository = {
    loadSectorEntry: () => ({ request, revision: 3 }),
    commitSectorEntry: (session: SectorSession, revision: number) => {
      assert.equal(revision, 3);
      committed.push(session);
      return session.snapshot();
    },
  };
  const created = new EnterSectorUseCase(repository).execute();
  assert.equal(created.resumed, false);
  assert.equal(present(committed[0]).mode, 'deployment');
  assert.deepEqual(created.snapshot.participantIds, ['one', 'two']);
  present(committed[0]).confirmDeployment();
  present(committed[0]).startCombat('player', 1);
  const resumed = new EnterSectorUseCase({
    ...repository,
    loadSectorEntry: () => ({ request, resumedSession: present(committed[0]), revision: 3 }),
  }).execute();
  assert.equal(resumed.resumed, true);
  assert.equal(present(resumed.snapshot.combat).id, 'visit-entry:combat:1');
  assert.deepEqual(resumed.snapshot.participantIds, ['one', 'two']);
  let published = false;
  assert.throws(() =>
    new EnterSectorUseCase({
      ...repository,
      loadSectorEntry: () => ({
        request: { ...request, participantIds: ['one', 'one'] },
        revision: 3,
      }),
      commitSectorEntry: () => {
        published = true;
      },
    }).execute(),
  );
  assert.equal(published, false);
});
