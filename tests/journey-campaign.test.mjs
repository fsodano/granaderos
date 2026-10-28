import { DomainRefusal, DomainRefusalCode } from '../packages/game/domain/shared/domain-refusal.ts';
import { CampaignJourneyTransaction } from '../packages/game/infrastructure/journeys/campaign-journey-repositories.js';
import { advanceSquadTravel, withdrawOnArrival } from '../packages/game/squad-travel.js';
import { rosterFor } from '../packages/game/campaign.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { pendingArrivalDecisions, squadTravelStatus } from '../packages/game/squad-travel.js';
import { strategicClockInterrupt } from '../packages/game/strategic-clock.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { encodeSave, decodeSave } from '../packages/game/save.js';

const seconds = (campaign) => campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const order = (campaign, command) => {
  const result = dispatchCampaign(campaign, command);
  assert.equal(result.lastError, null, `${command.type}: ${result.lastError}`);
  return result;
};
const restore = (campaign) => decodeSave(encodeSave(campaign)).campaign;
const currentJourney = (campaign) =>
  campaign.squads.find((squad) => squad.id === campaign.activeSquadId).journey;
const currentDecision = (campaign) => pendingArrivalDecisions(campaign)[0];

function hostileArrival() {
  let campaign = initialCampaign();
  campaign.sectors.buenos_aires.owner = 'royalist';
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'wait', hours: 24 });
  assert.equal(seconds(campaign), 7200);
  assert.equal(currentJourney(campaign).status, 'ready');
  return campaign;
}

function withdraw(campaign) {
  const decision = currentDecision(campaign);
  return order(campaign, {
    type: 'withdrawOnArrival',
    squadId: decision.squadId,
    decisionId: decision.id,
  });
}

function redirectToHostileSector(campaign) {
  return order(campaign, { type: 'redirectJourney', sector: 'buenos_aires' });
}

test('a hostile arrival pauses strategic time and refuses commands that bypass the decision', () => {
  const campaign = hostileArrival();
  assert.match(strategicClockInterrupt(campaign, campaign), /combatir o retirarte/);
  for (const command of [
    { type: 'wait', hours: 1 },
    { type: 'advanceStrategicTime', seconds: 60 },
    { type: 'cancelTravel', choice: 'return' },
    { type: 'redirectJourney', sector: 'retiro' },
    { type: 'fortify', sector: 'retiro' },
  ]) {
    const refused = dispatchCampaign(campaign, command);
    assert.ok(refused.lastError, command.type);
    assert.deepEqual({ ...refused, lastError: null }, campaign, command.type);
  }
});

test('campaign zero-time withdrawal reversal creates a fresh paused decision across save/load', () => {
  let campaign = restore(hostileArrival());
  const firstDecision = currentDecision(campaign);
  const resources = structuredClone(campaign.resources);
  const people = structuredClone(campaign.operativeState);
  campaign = restore(withdraw(campaign));
  assert.equal(currentJourney(campaign).returning, true);
  assert.equal(currentJourney(campaign).purpose, 'withdrawal');
  const preview = previewStrategicRoute(campaign, campaign.activeSquadId, 'buenos_aires');
  assert.equal(preview.valid, true, preview.reason);
  assert.equal(preview.action.type, 'redirectJourney');
  assert.equal(preview.hours, 0);
  campaign = restore(order(campaign, preview.action));
  assert.equal(seconds(campaign), 7200);
  assert.equal(currentJourney(campaign).elapsed, 2);
  assert.equal(currentJourney(campaign).status, 'ready');
  assert.notEqual(currentDecision(campaign).id, firstDecision.id);
  assert.deepEqual(campaign.resources, resources);
  assert.deepEqual(campaign.operativeState, people);
  const stale = dispatchCampaign(campaign, {
    type: 'fightOnArrival',
    squadId: firstDecision.squadId,
    decisionId: firstDecision.id,
  });
  assert.ok(stale.lastError);
  assert.deepEqual({ ...stale, lastError: null }, campaign);
});

test('one-minute campaign withdrawal returns in one minute and preserves cost through save/load', () => {
  let campaign = withdraw(hostileArrival());
  const firstDecisionId = currentJourney(campaign).arrivalDecision.id;
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  assert.equal(currentJourney(campaign).elapsed, 1);
  assert.equal(currentJourney(campaign).elapsedSecond, 3540);
  const beforeRedirection = restore(campaign);
  campaign = restore(redirectToHostileSector(beforeRedirection));
  assert.equal(seconds(campaign), seconds(beforeRedirection));
  assert.equal(currentJourney(campaign).elapsedSecond, 3540);
  assert.equal(currentJourney(campaign).pendingSeconds, 60);
  assert.deepEqual(campaign.operativeState, beforeRedirection.operativeState);
  assert.deepEqual(campaign.resources, beforeRedirection.resources);
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 59 });
  assert.equal(currentJourney(campaign).status, 'moving');
  assert.equal(currentJourney(campaign).elapsedSecond, 3599);
  campaign = restore(order(campaign, { type: 'advanceStrategicTime', seconds: 3600 }));
  assert.equal(seconds(campaign), 7320);
  assert.equal(currentJourney(campaign).status, 'ready');
  assert.equal(currentJourney(campaign).pendingSeconds, 120);
  assert.equal(currentJourney(campaign).travelledSeconds, 7320);
  assert.notEqual(currentDecision(campaign).id, firstDecisionId);
  assert.equal(currentDecision(campaign).arrivedAtSeconds, 7320);
});

test('withdrawal can redirect to a different safe sector while retaining the return distance', () => {
  let campaign = withdraw(hostileArrival());
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  const before = structuredClone(campaign);
  campaign = restore(order(campaign, { type: 'redirectJourney', sector: 'cell-26-27' }));
  const status = squadTravelStatus(campaign.squads[0], campaign);
  assert.equal(seconds(campaign), seconds(before));
  assert.equal(status.returning, true);
  assert.equal(status.destination, 'cell-26-27');
  assert.equal(status.elapsedSeconds, 7140);
  assert.deepEqual(campaign.resources, before.resources);
  for (let turn = 0; turn < 30 && currentJourney(campaign); turn++) {
    campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  }
  assert.equal(currentJourney(campaign), undefined);
  assert.equal(campaign.location, 'cell-26-27');
  assert.equal(seconds(campaign), 43200);
});

test('fight resolves the selected decision and prepares the same squad at its physical entry', () => {
  const campaign = hostileArrival();
  const decision = currentDecision(campaign);
  const result = order(campaign, {
    type: 'fightOnArrival',
    squadId: decision.squadId,
    decisionId: decision.id,
  });
  assert.equal(seconds(result), seconds(campaign));
  assert.equal(result.location, decision.sectorId);
  assert.equal(result.pendingBattle.sector, decision.sectorId);
  assert.deepEqual(
    result.pendingBattle.squad.map((person) => person.id),
    decision.members,
  );
  assert.equal(currentJourney(result), undefined);
  assert.equal(pendingArrivalDecisions(result).length, 0);
  assert.ok(
    dispatchCampaign(result, {
      type: 'fightOnArrival',
      squadId: decision.squadId,
      decisionId: decision.id,
    }).lastError,
  );
});

test('old saved arrival records restore deterministic decision identities without movement', () => {
  const campaign = hostileArrival();
  const legacy = structuredClone(campaign);
  const record = currentJourney(legacy);
  for (const key of [
    'id',
    'purpose',
    'travelledSeconds',
    'legPaid',
    'arrivalSequence',
    'arrivalDecision',
  ])
    delete record[key];
  const first = currentDecision(restore(legacy));
  const second = currentDecision(restore(legacy));
  assert.equal(first.id, second.id);
  assert.equal(first.arrivedAtSeconds, 7200);
  const reversed = redirectToHostileSector(withdraw(restore(legacy)));
  assert.notEqual(currentDecision(reversed).id, first.id);
  assert.equal(seconds(reversed), 7200);
});

test('simultaneous arrivals keep the clock paused until each independent decision is resolved', () => {
  let campaign = initialCampaign();
  campaign.sectors.buenos_aires.owner = 'royalist';
  const firstSquadId = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Segunda escuadra', ids: [10] });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'selectSquad', id: firstSquadId });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = restore(order(campaign, { type: 'wait', hours: 24 }));
  const decisions = pendingArrivalDecisions(campaign);
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].arrivedAtSeconds, 7200);
  assert.equal(decisions[1].arrivedAtSeconds, 7200);
  assert.notEqual(decisions[0].id, decisions[1].id);
  campaign = order(campaign, {
    type: 'withdrawOnArrival',
    squadId: decisions[0].squadId,
    decisionId: decisions[0].id,
  });
  assert.equal(pendingArrivalDecisions(campaign).length, 1);
  const refused = dispatchCampaign(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  assert.ok(refused.lastError);
  assert.deepEqual({ ...refused, lastError: null }, campaign);
  campaign = order(campaign, {
    type: 'withdrawOnArrival',
    squadId: decisions[1].squadId,
    decisionId: decisions[1].id,
  });
  campaign = restore(order(campaign, { type: 'advanceStrategicTime', seconds: 60 }));
  assert.equal(seconds(campaign), 7260);
  assert.equal(pendingArrivalDecisions(campaign).length, 0);
  assert.ok(
    campaign.squads.every(
      (squad) => squad.journey.elapsed === 1 && squad.journey.elapsedSecond === 3540,
    ),
  );
});

test('a wait with whole-hour input stops at the fractional-minute return boundary', () => {
  let campaign = withdraw(hostileArrival());
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  campaign = redirectToHostileSector(campaign);
  campaign = restore(order(campaign, { type: 'wait', hours: 24 }));
  assert.equal(seconds(campaign), 7320);
  assert.equal(currentDecision(campaign).arrivedAtSeconds, 7320);
  assert.equal(currentJourney(campaign).travelledSeconds, 7320);
});

test('a nonqueued attack also requires the arrival decision before deployment', () => {
  const initial = initialCampaign();
  initial.sectors.buenos_aires.owner = 'royalist';
  const campaign = order(initial, { type: 'attack', sector: 'buenos_aires' });
  assert.equal(seconds(campaign), 7200);
  assert.equal(campaign.pendingBattle, null);
  assert.equal(currentJourney(campaign).status, 'ready');
  assert.equal(pendingArrivalDecisions(campaign).length, 1);
});

test('journey revision exhaustion refuses travel time and arrival choices atomically', () => {
  const arriving = hostileArrival();
  const withdrawing = withdraw(arriving);
  const moving = order(initialCampaign(), { type: 'travel', sector: 'buenos_aires', queue: true });
  const cases = [
    [
      arriving,
      {
        type: 'fightOnArrival',
        squadId: currentDecision(arriving).squadId,
        decisionId: currentDecision(arriving).id,
      },
    ],
    [
      arriving,
      {
        type: 'withdrawOnArrival',
        squadId: currentDecision(arriving).squadId,
        decisionId: currentDecision(arriving).id,
      },
    ],
    [withdrawing, { type: 'redirectJourney', sector: 'buenos_aires' }],
    [moving, { type: 'advanceStrategicTime', seconds: 60 }],
  ];
  for (const [source, request] of cases) {
    const campaign = structuredClone(source);
    campaign.squads.find((squad) => squad.id === campaign.activeSquadId).journeyRevision =
      Number.MAX_SAFE_INTEGER;
    const before = structuredClone(campaign);
    const rejected = dispatchCampaign(campaign, request);
    assert.ok(rejected.lastError);
    assert.deepEqual({ ...rejected, lastError: null }, { ...before, lastError: null });
    assert.deepEqual(campaign, before);
  }
});

test('journey adapters reject exhausted revisions before changing movement, cost or notices', () => {
  const campaign = order(initialCampaign(), {
    type: 'travel',
    sector: 'buenos_aires',
    queue: true,
  });
  campaign.squads[0].journeyRevision = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(campaign);
  const conflict = (error) =>
    error instanceof DomainRefusal && error.code === DomainRefusalCode.RevisionConflict;
  assert.throws(
    () =>
      advanceSquadTravel(campaign, rosterFor(campaign), {
        seconds: 60,
        note() {
          assert.fail('No notice may be published.');
        },
        releaseAtArrival() {},
      }),
    conflict,
  );
  assert.deepEqual(campaign, before);
  const arrival = hostileArrival();
  arrival.squads[0].journeyRevision = Number.MAX_SAFE_INTEGER;
  const untouched = structuredClone(arrival);
  assert.throws(
    () =>
      withdrawOnArrival(arrival, {
        squadId: currentDecision(arrival).squadId,
        decisionId: currentDecision(arrival).id,
      }),
    conflict,
  );
  assert.deepEqual(arrival, untouched);
  assert.throws(
    () =>
      new CampaignJourneyTransaction(arrival).commitJourney(
        arrival.activeSquadId,
        null,
        Number.MAX_SAFE_INTEGER,
      ),
    conflict,
  );
  assert.deepEqual(arrival, untouched);
});

test('the last safe journey revision admits one movement step and then refuses further time', () => {
  const campaign = order(initialCampaign(), {
    type: 'travel',
    sector: 'buenos_aires',
    queue: true,
  });
  campaign.squads[0].journeyRevision = Number.MAX_SAFE_INTEGER - 1;
  const accepted = order(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  assert.equal(accepted.squads[0].journeyRevision, Number.MAX_SAFE_INTEGER);
  assert.equal(seconds(accepted), seconds(campaign) + 60);
  const refused = dispatchCampaign(accepted, { type: 'advanceStrategicTime', seconds: 60 });
  assert.ok(refused.lastError);
  assert.deepEqual({ ...refused, lastError: null }, accepted);
});

test('travel preflights every moving squad before publishing any partial work', () => {
  let campaign = initialCampaign();
  const firstSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Second revision boundary', ids: [10] });
  campaign = order(campaign, { type: 'travel', sector: 'buenos_aires', queue: true });
  const secondSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'selectSquad', id: firstSquad });
  campaign = order(campaign, { type: 'travel', sector: 'buenos_aires', queue: true });
  campaign.squads.find((squad) => squad.id === secondSquad).journeyRevision =
    Number.MAX_SAFE_INTEGER;
  const before = structuredClone(campaign);
  assert.throws(
    () =>
      advanceSquadTravel(campaign, rosterFor(campaign), {
        seconds: 60,
        note() {
          assert.fail('No partial notice may be published.');
        },
        releaseAtArrival() {},
      }),
    (error) => error instanceof DomainRefusal && error.code === DomainRefusalCode.RevisionConflict,
  );
  assert.deepEqual(campaign, before);
});

test('a friendly waypoint uses one safe journey revision for its complete accepted transition', () => {
  let campaign = order(initialCampaign(), {
    type: 'travel',
    sector: 'ensenada',
    waypoints: ['buenos_aires'],
    queue: true,
  });
  const arrivalSecond = seconds(campaign) + currentJourney(campaign).legHours * 3600;
  const firstWaypoint = currentJourney(campaign).path[1];
  while (seconds(campaign) < arrivalSecond - 60) {
    campaign = order(campaign, {
      type: 'advanceStrategicTime',
      seconds: Math.min(3600, arrivalSecond - 60 - seconds(campaign)),
    });
  }
  campaign.squads.find((squad) => squad.id === campaign.activeSquadId).journeyRevision =
    Number.MAX_SAFE_INTEGER - 1;
  const accepted = order(campaign, { type: 'advanceStrategicTime', seconds: 60 });
  assert.equal(
    accepted.squads.find((squad) => squad.id === accepted.activeSquadId).journeyRevision,
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(accepted.location, firstWaypoint);
  assert.equal(seconds(accepted), arrivalSecond);
});
