import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../game/campaign.js';
import { pendingArrivalDecisions } from '../game/squad-travel.js';
import { fundedRouteContent } from './funded-route-fixture.mjs';
import { bookRouteHires, finishRouteHireArrivals } from './paid-route-hiring.mjs';
import { prepareFreshCoastalHires } from './fresh-coastal-fixture.mjs';
import { assertImmediateRecruitment } from './immediate-recruitment-fixture.mjs';
import {
  fightOnArrival,
  fightOnArrivalOrder,
  completeQueuedAssault,
  stageAssaultDeparture,
} from './assault-fixture.mjs';

const seconds = (campaign) => campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const order = (campaign, request) => {
  const accepted = dispatchCampaign(campaign, request);
  assert.equal(accepted.lastError, null);
  return accepted;
};

function recruitableCampaign() {
  const content = fundedRouteContent();
  content.characters.find((character) => character.id === 'person-110').arrivalHours = 12;
  return order(initialCampaign(1812, content), { type: 'advanceStrategicTime', seconds: 17 });
}

test('paid route recruitment uses the accepted instant and spends only requested readiness time', () => {
  const start = recruitableCampaign();
  const booked = bookRouteHires(start, [110], { term: 'week' });
  const hire = booked.hires[0];
  assert.equal(seconds(booked.campaign), seconds(start));
  assert.equal(hire.arrival.travelHours, 0);
  assertImmediateRecruitment(booked.campaign, hire.arrival, hire.quote);
  const ready = finishRouteHireArrivals(booked.campaign, booked.hires, { minimumWaitHours: 1 });
  assert.equal(seconds(ready), seconds(start) + 3600);
  assert.equal(ready.resources.treasury, start.resources.treasury - hire.quote.total);
  assertImmediateRecruitment(ready, hire.arrival, hire.quote);
});

test('coastal preparation grants control immediately and preserves exact service start through readiness', () => {
  const start = recruitableCampaign();
  const prepared = prepareFreshCoastalHires(start, [110], { minimumWaitHours: 1 });
  const hire = prepared.hires[0];
  assert.deepEqual(
    prepared.orders.map((request) => request.type),
    ['recruitCombatant', 'wait'],
  );
  assert.equal(prepared.waitHours, 1);
  assert.equal(hire.arrival.bookedSecond, 17);
  assert.equal(hire.arrival.travelHours, 0);
  assertImmediateRecruitment(prepared.campaign, hire.arrival, hire.quote);
  assert.equal(prepared.campaign.resources.treasury, start.resources.treasury - hire.quote.total);
});

test('assault fixture admits a sector only after a real journey and a matching arrival decision', () => {
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
  assert.equal(admitted.pendingBattle.sector, decision.sectorId);
  assert.equal(pendingArrivalDecisions(admitted).length, 0);
});

function queuedColumns(staggerSeconds) {
  let campaign = bookRouteHires(recruitableCampaign(), [110, 107]).campaign;
  const first = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Second column', ids: [107] });
  const second = campaign.activeSquadId;
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  if (staggerSeconds)
    campaign = order(campaign, { type: 'advanceStrategicTime', seconds: staggerSeconds });
  campaign = order(campaign, { type: 'selectSquad', id: first });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  return { campaign, groups: [first, second] };
}

for (const staggerSeconds of [0, 10]) {
  test(`queued assault admits each column through one visit with ${staggerSeconds} seconds between arrivals`, () => {
    const { campaign, groups } = queuedColumns(staggerSeconds);
    const acceptedOrders = [];
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
    assert.equal(result.pendingBattle.assaultSquads.length, 2);
    assert.deepEqual(
      new Set(result.pendingBattle.squad.map((person) => person.id)),
      new Set([110, 107]),
    );
    assert.equal(acceptedOrders.filter((request) => request.type === 'fightOnArrival').length, 2);
    const snapshot = result.pendingBattle.resumeSnapshot;
    assert.ok(snapshot);
    assert.equal(snapshot.battleId, result.pendingBattle.id);
    const incoming = acceptedOrders.filter((request) => request.type === 'fightOnArrival').at(-1);
    for (const participant of incoming.sectorState.units) {
      assert.deepEqual(
        snapshot.units.find((unit) => unit.id === participant.id),
        participant,
      );
    }
    if (staggerSeconds) assert.ok(snapshot.elapsedSeconds >= staggerSeconds);
  });
}

test('daylight preparation waits at the friendly origin before any hostile approach', () => {
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
