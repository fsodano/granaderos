import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey, JourneyPurpose, JourneyStatus } from '../packages/game/domain/journeys/journey.ts';
import {
  ArrivalDecision,
  ArrivalDecisionStatus,
} from '../packages/game/domain/journeys/arrival-decision.ts';
import { WithdrawOnArrivalUseCase } from '../packages/game/application/journeys/withdraw-on-arrival/withdraw-on-arrival.use-case.ts';
import { FightOnArrivalUseCase } from '../packages/game/application/journeys/fight-on-arrival/fight-on-arrival.use-case.ts';
import { RedirectJourneyUseCase } from '../packages/game/application/journeys/redirect-journey/redirect-journey.use-case.ts';

const legSeconds = 7200;
const approach = () =>
  Journey.begin({
    id: 'squad-1:journey:1',
    route: ['headquarters', 'hostile-sector'],
    mode: 'march',
    purpose: JourneyPurpose.HostileApproach,
    startedAtSeconds: 0,
    legDurationSeconds: legSeconds,
  });
const reachHostileBoundary = () => {
  const journey = approach();
  journey.markLegPaid();
  journey.advance(legSeconds, legSeconds);
  return journey;
};
const refusal = (code) => (error) => error.code === code;

class JourneyRepositoryFixture {
  snapshot;
  revision = 0;
  nowSeconds = legSeconds;
  commits = 0;
  conflict = false;
  constructor(journey) {
    this.snapshot = journey.snapshot();
  }
  loadJourney() {
    return {
      journey: Journey.restore(this.snapshot),
      revision: this.revision,
      nowSeconds: this.nowSeconds,
    };
  }
  commitJourney(squadId, journey, revision) {
    if (this.conflict || revision !== this.revision) throw Error('revision-conflict');
    this.snapshot = journey.snapshot();
    this.revision++;
    this.commits++;
  }
  planRoute(journey, destination) {
    return { through: destination, route: [destination], purpose: JourneyPurpose.HostileApproach };
  }
}

test('ArrivalDecision resolves once and refuses stale identity without changing its status', () => {
  const decision = ArrivalDecision.create('arrival-1', 'sector', 7200);
  assert.throws(() => decision.chooseFight('arrival-0'), refusal('arrival-decision-mismatch'));
  assert.equal(decision.pending, true);
  decision.chooseWithdrawal('arrival-1');
  assert.equal(decision.snapshot().status, ArrivalDecisionStatus.Withdrawal);
  assert.throws(
    () => decision.chooseFight('arrival-1'),
    refusal('arrival-decision-already-resolved'),
  );
});

test('hostile arrival stops at the actual boundary and records its exact game time', () => {
  const journey = approach();
  const result = journey.advance(legSeconds + 60, legSeconds + 60);
  assert.equal(result.acceptedSeconds, legSeconds);
  assert.equal(result.reachedBoundary, true);
  assert.equal(journey.status, JourneyStatus.AwaitingArrivalDecision);
  assert.equal(journey.arrivalDecision.arrivedAtSeconds, legSeconds);
  assert.throws(() => journey.advance(1, legSeconds + 1), refusal('journey-not-travelling'));
});

test('zero-time withdrawal and redirection retain position and create a fresh decision', () => {
  const journey = reachHostileBoundary();
  const original = journey.snapshot();
  const firstDecision = journey.arrivalDecision;
  journey.chooseWithdrawal(firstDecision.id);
  assert.equal(journey.status, JourneyStatus.Travelling);
  assert.equal(journey.purpose, JourneyPurpose.Withdrawal);
  assert.equal(journey.positionSeconds, original.positionSeconds);
  journey.redirect(
    {
      through: 'hostile-sector',
      route: ['hostile-sector'],
      purpose: JourneyPurpose.HostileApproach,
    },
    legSeconds,
  );
  assert.equal(journey.status, JourneyStatus.AwaitingArrivalDecision);
  assert.equal(journey.positionSeconds, original.positionSeconds);
  assert.equal(journey.travelledSeconds, original.travelledSeconds);
  assert.equal(journey.workSeconds, original.workSeconds);
  assert.equal(journey.legPaid, original.legPaid);
  assert.notEqual(journey.arrivalDecision.id, firstDecision.id);
  assert.throws(() => journey.chooseFight(firstDecision.id), refusal('arrival-decision-mismatch'));
});

test('one-minute withdrawal requires exactly one minute back without refunding travelled work', () => {
  const journey = reachHostileBoundary();
  journey.chooseWithdrawal(journey.arrivalDecision.id);
  journey.advance(60, legSeconds + 60);
  const beforeRedirection = journey.snapshot();
  journey.redirect(
    {
      through: 'hostile-sector',
      route: ['hostile-sector'],
      purpose: JourneyPurpose.HostileApproach,
    },
    legSeconds + 60,
  );
  assert.equal(journey.positionSeconds, legSeconds - 60);
  assert.equal(journey.travelledSeconds, beforeRedirection.travelledSeconds);
  assert.equal(journey.workSeconds, beforeRedirection.workSeconds);
  assert.equal(journey.remainingLegSeconds, 60);
  journey.advance(59, legSeconds + 119);
  assert.equal(journey.status, JourneyStatus.Travelling);
  journey.advance(1, legSeconds + 120);
  assert.equal(journey.status, JourneyStatus.AwaitingArrivalDecision);
  assert.equal(journey.travelledSeconds, legSeconds + 120);
  assert.equal(journey.workSeconds, 120);
  assert.equal(journey.arrivalDecision.arrivedAtSeconds, legSeconds + 120);
});

test('withdrawal redirection to another safe destination completes the physical return first', () => {
  const journey = reachHostileBoundary();
  journey.chooseWithdrawal(journey.arrivalDecision.id);
  journey.advance(60, legSeconds + 60);
  journey.redirect(
    {
      through: 'headquarters',
      route: ['headquarters', 'safe-sector'],
      purpose: JourneyPurpose.Travel,
    },
    legSeconds + 60,
  );
  assert.equal(journey.destination, 'safe-sector');
  assert.equal(journey.remainingLegSeconds, legSeconds - 60);
  journey.advance(legSeconds - 60, 2 * legSeconds);
  const arrival = journey.finishLeg(3600);
  assert.deepEqual(arrival, { from: 'headquarters', to: 'headquarters', complete: false });
  assert.equal(journey.nextSector, 'safe-sector');
  assert.equal(journey.positionSeconds, 0);
  assert.equal(journey.travelledSeconds, 2 * legSeconds);
  assert.equal(journey.legPaid, false);
});

test('journey restoration preserves resolved decisions, fractional costs and future identity', () => {
  const journey = reachHostileBoundary();
  const firstDecision = journey.arrivalDecision;
  journey.chooseWithdrawal(firstDecision.id);
  journey.advance(60, legSeconds + 60);
  const restored = Journey.restore(JSON.parse(JSON.stringify(journey.snapshot())));
  assert.deepEqual(restored.snapshot(), journey.snapshot());
  restored.redirect(
    {
      through: 'hostile-sector',
      route: ['hostile-sector'],
      purpose: JourneyPurpose.HostileApproach,
    },
    legSeconds + 60,
  );
  restored.advance(60, legSeconds + 120);
  assert.notEqual(restored.arrivalDecision.id, firstDecision.id);
  assert.throws(
    () => restored.chooseWithdrawal(firstDecision.id),
    refusal('arrival-decision-mismatch'),
  );
  restored.chooseFight(restored.arrivalDecision.id);
  assert.equal(restored.status, JourneyStatus.Completed);
});

test('small and large travel steps produce identical boundary state and cost', () => {
  const combined = approach();
  const split = approach();
  combined.advance(legSeconds, legSeconds);
  for (let now = 60; now <= legSeconds; now += 60) split.advance(60, now);
  assert.deepEqual(split.snapshot(), combined.snapshot());
});

test('journey snapshots cannot expose mutable route or decision authority', () => {
  const journey = reachHostileBoundary();
  const snapshot = journey.snapshot();
  snapshot.route[0] = 'elsewhere';
  snapshot.arrivalDecision.status = ArrivalDecisionStatus.Fight;
  assert.equal(journey.origin, 'headquarters');
  assert.equal(journey.arrivalDecision.status, ArrivalDecisionStatus.Pending);
  assert.throws(
    () => Journey.restore({ ...journey.snapshot(), positionSeconds: legSeconds - 1 }),
    refusal('invalid-journey-arrival'),
  );
});

test('use cases commit domain behavior once and refuse stale decisions without publishing changes', () => {
  const repository = new JourneyRepositoryFixture(reachHostileBoundary());
  const originalDecisionId = repository.snapshot.arrivalDecision.id;
  new WithdrawOnArrivalUseCase(repository).execute({
    squadId: 'squad-1',
    decisionId: originalDecisionId,
  });
  assert.equal(repository.commits, 1);
  const result = new RedirectJourneyUseCase(repository).execute({
    squadId: 'squad-1',
    destination: 'hostile-sector',
  });
  assert.equal(repository.commits, 2);
  assert.notEqual(result.arrivalDecision.id, originalDecisionId);
  const beforeRefusal = structuredClone(repository.snapshot);
  assert.throws(
    () =>
      new FightOnArrivalUseCase(repository).execute({
        squadId: 'squad-1',
        decisionId: originalDecisionId,
      }),
    refusal('arrival-decision-mismatch'),
  );
  assert.deepEqual(repository.snapshot, beforeRefusal);
  assert.equal(repository.commits, 2);
  repository.conflict = true;
  assert.throws(
    () =>
      new FightOnArrivalUseCase(repository).execute({
        squadId: 'squad-1',
        decisionId: result.arrivalDecision.id,
      }),
    /revision-conflict/,
  );
  assert.deepEqual(repository.snapshot, beforeRefusal);
  assert.equal(repository.commits, 2);
});
