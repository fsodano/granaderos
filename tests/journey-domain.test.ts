import { jsonRoundTrip } from './json-round-trip.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Journey,
  JourneyPurpose,
  JourneyStatus,
} from '../packages/game/domain/journeys/journey.ts';
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
const refusal = (code: string) => (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === code;

class JourneyRepositoryFixture {
  snapshot;
  revision = 0;
  nowSeconds = legSeconds;
  commits = 0;
  conflict = false;
  constructor(journey: Journey) {
    this.snapshot = journey.snapshot();
  }
  loadJourney() {
    return {
      journey: Journey.restore(this.snapshot),
      revision: this.revision,
      nowSeconds: this.nowSeconds,
    };
  }
  commitJourney(_squadId: string, journey: Journey, revision: number) {
    if (this.conflict || revision !== this.revision) {
      throw Error('revision-conflict');
    }
    this.snapshot = journey.snapshot();
    this.revision++;
    this.commits++;
  }
  planRoute(_journey: Journey, destination: string) {
    return { through: destination, route: [destination], purpose: JourneyPurpose.HostileApproach };
  }
}

void test('ArrivalDecision resolves once and refuses stale identity without changing its status', () => {
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

void test('hostile arrival stops at the actual boundary and records its exact game time', () => {
  const journey = approach();
  const result = journey.advance(legSeconds + 60, legSeconds + 60);
  assert.equal(result.acceptedSeconds, legSeconds);
  assert.equal(result.reachedBoundary, true);
  assert.equal(journey.status, JourneyStatus.AwaitingArrivalDecision);
  assert.equal(present(journey.arrivalDecision).arrivedAtSeconds, legSeconds);
  assert.throws(() => journey.advance(1, legSeconds + 1), refusal('journey-not-travelling'));
});

void test('zero-time withdrawal and redirection retain position and create a fresh decision', () => {
  const journey = reachHostileBoundary();
  const original = journey.snapshot();
  const firstDecision = journey.arrivalDecision;
  journey.chooseWithdrawal(present(firstDecision).id);
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
  assert.notEqual(present(journey.arrivalDecision).id, present(firstDecision).id);
  assert.throws(
    () => journey.chooseFight(present(firstDecision).id),
    refusal('arrival-decision-mismatch'),
  );
});

void test('one-minute withdrawal requires exactly one minute back without refunding travelled work', () => {
  const journey = reachHostileBoundary();
  journey.chooseWithdrawal(present(journey.arrivalDecision).id);
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
  assert.equal(present(journey.arrivalDecision).arrivedAtSeconds, legSeconds + 120);
});

void test('withdrawal redirection to another safe destination completes the physical return first', () => {
  const journey = reachHostileBoundary();
  journey.chooseWithdrawal(present(journey.arrivalDecision).id);
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

void test('journey restoration preserves resolved decisions, fractional costs and future identity', () => {
  const journey = reachHostileBoundary();
  const firstDecision = journey.arrivalDecision;
  journey.chooseWithdrawal(present(firstDecision).id);
  journey.advance(60, legSeconds + 60);
  const restored = Journey.restore(jsonRoundTrip(journey.snapshot()));
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
  assert.notEqual(present(restored.arrivalDecision).id, present(firstDecision).id);
  assert.throws(
    () => restored.chooseWithdrawal(present(firstDecision).id),
    refusal('arrival-decision-mismatch'),
  );
  restored.chooseFight(present(restored.arrivalDecision).id);
  assert.equal(restored.status, JourneyStatus.Completed);
});

void test('small and large travel steps produce identical boundary state and cost', () => {
  const combined = approach();
  const split = approach();
  combined.advance(legSeconds, legSeconds);
  for (let now = 60; now <= legSeconds; now += 60) {
    split.advance(60, now);
  }
  assert.deepEqual(split.snapshot(), combined.snapshot());
});

void test('journey snapshots cannot expose mutable route or decision authority', () => {
  const journey = reachHostileBoundary();
  const snapshot = journey.snapshot();
  Reflect.set(snapshot.route, 0, 'elsewhere');
  Reflect.set(present(snapshot.arrivalDecision), 'status', ArrivalDecisionStatus.Fight);
  assert.equal(journey.origin, 'headquarters');
  assert.equal(present(journey.arrivalDecision).status, ArrivalDecisionStatus.Pending);
  assert.throws(
    () => Journey.restore({ ...journey.snapshot(), positionSeconds: legSeconds - 1 }),
    refusal('invalid-journey-arrival'),
  );
});

void test('use cases commit domain behavior once and refuse stale decisions without publishing changes', () => {
  const repository = new JourneyRepositoryFixture(reachHostileBoundary());
  const originalDecisionId = present(repository.snapshot.arrivalDecision).id;
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
  assert.notEqual(present(result.arrivalDecision).id, originalDecisionId);
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
        decisionId: present(result.arrivalDecision).id,
      }),
    /revision-conflict/,
  );
  assert.deepEqual(repository.snapshot, beforeRefusal);
  assert.equal(repository.commits, 2);
});
