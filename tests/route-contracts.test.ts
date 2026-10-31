import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { pendingArrivalDecisions } from '../packages/game/squad-travel.js';
import { fundedRouteContent } from './funded-route-fixture.ts';
import { bookRouteHires, finishRouteHireArrivals } from './paid-route-hiring.ts';
import { prepareFreshCoastalHires } from './fresh-coastal-fixture.ts';
import { assertImmediateRecruitment } from './immediate-recruitment-fixture.ts';
import {
  fightOnArrival,
  fightOnArrivalOrder,
  completeQueuedAssault,
  stageAssaultDeparture,
} from './assault-fixture.ts';

const seconds = (campaign: CampaignSnapshot) => campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const order = (campaign: CampaignSnapshot, request: CampaignAction) => {
  const accepted = dispatchCampaign(campaign, request);
  assert.equal(accepted.lastError, null);
  return accepted;
};

function recruitableCampaign() {
  const content = fundedRouteContent();
  present(content.characters.find((character) => character.id === 'person-110')).arrivalHours = 12;
  return order(initialCampaign(1812, content), { type: 'advanceStrategicTime', seconds: 17 });
}

void test('paid route recruitment uses the accepted instant and spends only requested readiness time', () => {
  const start = recruitableCampaign();
  const booked = bookRouteHires(start, [110], { term: 'week' });
  const hire = booked.hires[0];
  assert.equal(seconds(booked.campaign), seconds(start));
  assert.equal(present(hire).arrival.travelHours, 0);
  assertImmediateRecruitment(booked.campaign, present(hire).arrival, present(hire).quote);
  const ready = finishRouteHireArrivals(booked.campaign, booked.hires, { minimumWaitHours: 1 });
  assert.equal(seconds(ready), seconds(start) + 3600);
  assert.equal(ready.resources.treasury, start.resources.treasury - present(hire).quote.total);
  assertImmediateRecruitment(ready, present(hire).arrival, present(hire).quote);
});

void test('coastal preparation grants control immediately and preserves exact service start through readiness', () => {
  const start = recruitableCampaign();
  const prepared = prepareFreshCoastalHires(start, [110], { minimumWaitHours: 1 });
  const hire = prepared.hires[0];
  assert.deepEqual(
    prepared.orders.map((request) => request.type),
    ['recruitCombatant', 'wait'],
  );
  assert.equal(prepared.waitHours, 1);
  assert.equal(present(hire).arrival.bookedSecond, 17);
  assert.equal(present(hire).arrival.travelHours, 0);
  assertImmediateRecruitment(prepared.campaign, present(hire).arrival, present(hire).quote);
  assert.equal(
    prepared.campaign.resources.treasury,
    start.resources.treasury - present(hire).quote.total,
  );
});

void test('assault fixture admits a sector only after a real journey and a matching arrival decision', () => {
  const recruited = bookRouteHires(recruitableCampaign(), [110]).campaign;
  assert.throws(() => fightOnArrivalOrder(recruited), /explicit hostile arrival decision/);
  const travelling = order(recruited, { type: 'attack', sector: 'buenos_aires', queue: true });
  assert.equal(pendingArrivalDecisions(travelling).length, 0);
  assert.throws(() => fightOnArrivalOrder(travelling), /explicit hostile arrival decision/);
  const arrived = order(travelling, { type: 'wait', hours: 24 });
  const [decision] = pendingArrivalDecisions(arrived);
  assert.ok(decision);
  assert.equal(arrived.pendingBattle, null);
  assert.ok(seconds(arrived) > seconds(recruited));
  const admitted = fightOnArrival(arrived);
  assert.equal(seconds(admitted), seconds(arrived));
  assert.equal(present(admitted.pendingBattle).sector, decision.sectorId);
  assert.equal(pendingArrivalDecisions(admitted).length, 0);
});

function queuedColumns(staggerSeconds: number) {
  let campaign = bookRouteHires(recruitableCampaign(), [110, 107]).campaign;
  const first = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Second column', ids: [107] });
  const second = campaign.activeSquadId;
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  if (staggerSeconds) {
    campaign = order(campaign, { type: 'advanceStrategicTime', seconds: staggerSeconds });
  }
  campaign = order(campaign, { type: 'selectSquad', id: first });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  return { campaign, groups: [first, second] };
}

for (const staggerSeconds of [0, 10]) {
  void test(`queued assault admits each column through one visit with ${staggerSeconds} seconds between arrivals`, () => {
    const { campaign, groups } = queuedColumns(staggerSeconds);
    const acceptedOrders: CampaignAction[] = [];
    let current = campaign;
    const result = completeQueuedAssault(campaign, groups, 'buenos_aires', {
      maximumOperations: 30,
      execute: (request) => {
        current = order(current, request);
        return current;
      },
      report: (event) => acceptedOrders.push(event.request),
    });
    assert.equal(pendingArrivalDecisions(result).length, 0);
    assert.equal(present(present(result.pendingBattle).assaultSquads).length, 2);
    assert.deepEqual(
      new Set(present(result.pendingBattle).squad.map((person) => person.id)),
      new Set([110, 107]),
    );
    assert.equal(acceptedOrders.filter((request) => request.type === 'fightOnArrival').length, 2);
    const snapshot = present(result.pendingBattle).resumeSnapshot;
    assert.ok(snapshot);
    assert.equal(snapshot.battleId, present(result.pendingBattle).id);
    const incoming = acceptedOrders.filter((request) => request.type === 'fightOnArrival').at(-1);
    assert.ok(incoming && incoming.type === 'fightOnArrival');
    for (const participant of present(incoming.sectorState).units) {
      assert.deepEqual(
        snapshot.units.find((unit: BattleUnit) => unit.id === participant.id),
        participant,
      );
    }
    if (staggerSeconds) {
      assert.ok(snapshot.elapsedSeconds >= staggerSeconds);
    }
  });
}

void test('daylight preparation waits at the friendly origin before any hostile approach', () => {
  const recruited = bookRouteHires(recruitableCampaign(), [110]).campaign;
  const staged = stageAssaultDeparture(
    recruited,
    [{ id: recruited.activeSquadId }],
    'buenos_aires',
  );
  assert.equal(staged.location, 'retiro');
  assert.equal(staged.hour, 4);
  assert.equal(pendingArrivalDecisions(staged).length, 0);
  assert.ok(staged.squads.every((group) => !group.journey));
  const arrived = order(staged, { type: 'attack', sector: 'buenos_aires' });
  assert.equal(arrived.hour, 6);
  assert.equal(pendingArrivalDecisions(arrived).length, 1);
});
