import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../game/campaign.js';
import { pendingArrivalDecisions } from '../game/squad-travel.js';
import { prepareCampaignBattle } from '../game/battle-handoff.js';
import { endTurn } from '../game/tactical.js';
import { syncBattleTime } from '../game/time.js';
import { encodeSave, decodeSave } from '../game/save.js';

function order(campaign, action) {
  const result = dispatchCampaign(campaign, action);
  assert.equal(result.lastError, null, `${action.type}: ${result.lastError}`);
  return result;
}

function visitingWhileOtherSquadArrives() {
  let campaign = initialCampaign();
  campaign.sectors.buenos_aires.owner = 'royalist';
  const visitingSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Segunda escuadra', ids: [10] });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'selectSquad', id: visitingSquad });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3590 });
  campaign = order(campaign, { type: 'visitSector' });
  let pair = prepareCampaignBattle(campaign);
  assert.equal(pair.error, null);
  pair = syncBattleTime(pair.campaign, endTurn(pair.battle));
  assert.equal(pair.error, null);
  assert.equal(pair.campaign.hour * 3600 + pair.campaign.secondOfHour, 7200);
  assert.equal(pendingArrivalDecisions(pair.campaign).length, 1);
  return pair;
}

test('fighting on another arrival preserves the current visit and allows exact resumption', () => {
  const original = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(original.campaign)[0];
  const campaign = order(original.campaign, {
    type: 'fightOnArrival',
    squadId: decision.squadId,
    decisionId: decision.id,
    sectorState: original.battle,
  });
  assert.equal(campaign.suspendedSectorSessions.length, 1);
  assert.deepEqual(campaign.suspendedSectorSessions[0].snapshot, original.battle);
  assert.equal(campaign.pendingBattle.sector, decision.sectorId);
  const active = prepareCampaignBattle(campaign, { placement: true });
  assert.equal(active.error, null);
  const restored = decodeSave(encodeSave(active.campaign, active.battle));
  const resumed = order(restored.campaign, {
    type: 'resumeSectorSession',
    sectorSessionId: original.campaign.pendingBattle.id,
    sectorState: restored.battle,
  });
  const pair = prepareCampaignBattle(resumed);
  assert.equal(pair.error, null);
  assert.equal(pair.battle.battleId, original.battle.battleId);
  assert.deepEqual(pair.battle.units, original.battle.units);
  assert.equal(pair.battle.turn, original.battle.turn);
  assert.deepEqual(pair.battle.pendingSectorOperation, original.battle.pendingSectorOperation);
  assert.equal(pair.campaign.suspendedSectorSessions.length, 1);
  assert.equal(pair.campaign.suspendedSectorSessions[0].request.sector, decision.sectorId);
});

test('an arrival choice preserves the active visit when the arriving squad withdraws', () => {
  const pair = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(pair.campaign)[0];
  const campaign = order(pair.campaign, {
    type: 'withdrawOnArrival',
    squadId: decision.squadId,
    decisionId: decision.id,
  });
  assert.equal(campaign.pendingBattle.id, pair.campaign.pendingBattle.id);
  assert.equal(campaign.suspendedSectorSessions, undefined);
  assert.equal(campaign.hour * 3600 + campaign.secondOfHour, 7200);
});

test('save restoration refuses duplicate participants and altered clocks in suspended visits', () => {
  const pair = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(pair.campaign)[0];
  const campaign = order(pair.campaign, {
    type: 'fightOnArrival',
    squadId: decision.squadId,
    decisionId: decision.id,
    sectorState: pair.battle,
  });
  const active = prepareCampaignBattle(campaign, { placement: true });
  const encoded = JSON.parse(encodeSave(active.campaign, active.battle));
  const duplicate = structuredClone(encoded);
  duplicate.campaign.suspendedSectorSessions[0].request.squad[0].id =
    active.campaign.pendingBattle.squad[0].id;
  assert.throws(
    () => decodeSave(JSON.stringify(duplicate)),
    /duplicate-sector|inválid|corresponde/,
  );
  const clock = structuredClone(encoded);
  clock.campaign.suspendedSectorSessions[0].snapshot.elapsedSeconds++;
  assert.throws(() => decodeSave(JSON.stringify(clock)), /reloj/);
  const actor = structuredClone(encoded);
  actor.campaign.suspendedSectorSessions[0].snapshot.units[0].hp = -1;
  assert.throws(() => decodeSave(JSON.stringify(actor)), /inválid|salud/);
});

test('simultaneous arrivals at the same sector join one visit without resetting existing participants', () => {
  let campaign = initialCampaign();
  campaign.sectors.buenos_aires.owner = 'royalist';
  const firstSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Segunda escuadra', ids: [10] });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'selectSquad', id: firstSquad });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'wait', hours: 24 });
  const decisions = pendingArrivalDecisions(campaign);
  campaign = order(campaign, {
    type: 'fightOnArrival',
    squadId: decisions[0].squadId,
    decisionId: decisions[0].id,
  });
  const first = prepareCampaignBattle(campaign, { placement: true });
  assert.equal(first.error, null);
  const oldParticipants = structuredClone(first.battle.units);
  const reinforced = order(first.campaign, {
    type: 'fightOnArrival',
    squadId: decisions[1].squadId,
    decisionId: decisions[1].id,
    sectorState: first.battle,
  });
  assert.equal(reinforced.pendingBattle.id, first.campaign.pendingBattle.id);
  assert.equal(reinforced.suspendedSectorSessions, undefined);
  const pair = prepareCampaignBattle(reinforced, { placement: true });
  assert.equal(pair.error, null);
  assert.equal(pair.battle.sectorSession.id, first.battle.sectorSession.id);
  for (const participant of oldParticipants) {
    assert.deepEqual(
      pair.battle.units.find((unit) => unit.id === participant.id),
      participant,
    );
  }
  assert.equal(pair.battle.units.filter((unit) => unit.side === 'player').length, 3);
  assert.equal(pendingArrivalDecisions(pair.campaign).length, 0);
  decodeSave(encodeSave(pair.campaign, pair.battle));
});
