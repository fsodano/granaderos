import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { pendingArrivalDecisions } from '../packages/game/squad-travel.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { endTurn } from '../packages/game/tactical.js';
import { syncBattleTime } from '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';

function order(campaign: CampaignSnapshot, action: CampaignAction) {
  const result = dispatchCampaign(campaign, action);
  assert.equal(result.lastError, null, `${action.type}: ${result.lastError}`);
  return result;
}

function visitingWhileOtherSquadArrives() {
  let campaign = initialCampaign();
  present(campaign.sectors['buenos_aires']).owner = 'royalist';
  const visitingSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Segunda escuadra', ids: [10] });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'selectSquad', id: visitingSquad });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3590 });
  campaign = order(campaign, { type: 'visitSector' });
  const prepared = prepareCampaignBattle(campaign);
  assert.equal(prepared.error, null);
  const pair = syncBattleTime(prepared.campaign, endTurn(present(prepared.battle)));
  assert.equal(pair.error, null);
  assert.equal(pair.campaign.hour * 3600 + present(pair.campaign.secondOfHour), 7200);
  assert.equal(pendingArrivalDecisions(pair.campaign).length, 1);
  return pair;
}

void test('fighting on another arrival preserves the current visit and allows exact resumption', () => {
  const original = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(original.campaign)[0];
  const campaign = order(original.campaign, {
    type: 'fightOnArrival',
    squadId: present(decision).squadId,
    decisionId: present(decision).id,
    sectorState: original.battle,
  });
  assert.equal(present(campaign.suspendedSectorSessions).length, 1);
  assert.deepEqual(present(present(campaign.suspendedSectorSessions)[0]).snapshot, original.battle);
  assert.equal(present(campaign.pendingBattle).sector, present(decision).sectorId);
  const active = prepareCampaignBattle(campaign, { placement: true });
  assert.equal(active.error, null);
  const restored = decodeSave(encodeSave(active.campaign, active.battle));
  const resumed = order(restored.campaign, {
    type: 'resumeSectorSession',
    sectorSessionId: present(original.campaign.pendingBattle).id,
    sectorState: present(restored.battle),
  });
  const pair = prepareCampaignBattle(resumed);
  assert.equal(pair.error, null);
  assert.equal(present(pair.battle).battleId, present(original.battle).battleId);
  assert.deepEqual(present(pair.battle).units, present(original.battle).units);
  assert.equal(present(pair.battle).turn, present(original.battle).turn);
  assert.deepEqual(
    present(pair.battle).pendingSectorOperation,
    present(original.battle).pendingSectorOperation,
  );
  assert.equal(present(pair.campaign.suspendedSectorSessions).length, 1);
  assert.equal(
    present(present(pair.campaign.suspendedSectorSessions)[0]).request.sector,
    present(decision).sectorId,
  );
});

void test('an arrival choice preserves the active visit when the arriving squad withdraws', () => {
  const pair = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(pair.campaign)[0];
  const campaign = order(pair.campaign, {
    type: 'withdrawOnArrival',
    squadId: present(decision).squadId,
    decisionId: present(decision).id,
  });
  assert.equal(present(campaign.pendingBattle).id, present(pair.campaign.pendingBattle).id);
  assert.equal(campaign.suspendedSectorSessions, undefined);
  assert.equal(campaign.hour * 3600 + present(campaign.secondOfHour), 7200);
});

void test('save restoration refuses duplicate participants and altered clocks in suspended visits', () => {
  const pair = visitingWhileOtherSquadArrives();
  const decision = pendingArrivalDecisions(pair.campaign)[0];
  const campaign = order(pair.campaign, {
    type: 'fightOnArrival',
    squadId: present(decision).squadId,
    decisionId: present(decision).id,
    sectorState: pair.battle,
  });
  const active = prepareCampaignBattle(campaign, { placement: true });
  const encoded = decodeSave(encodeSave(active.campaign, active.battle));
  const duplicate = structuredClone(encoded);
  present(present(present(duplicate.campaign.suspendedSectorSessions)[0]).request.squad[0]).id =
    present(present(active.campaign.pendingBattle).squad[0]).id;
  assert.throws(
    () => decodeSave(JSON.stringify(duplicate)),
    /duplicate-sector|inválid|corresponde/,
  );
  const clock = structuredClone(encoded);
  present(present(clock.campaign.suspendedSectorSessions)[0]).snapshot.elapsedSeconds++;
  assert.throws(() => decodeSave(JSON.stringify(clock)), /reloj/);
  const actor = structuredClone(encoded);
  present(present(present(actor.campaign.suspendedSectorSessions)[0]).snapshot.units[0]).hp = -1;
  assert.throws(() => decodeSave(JSON.stringify(actor)), /inválid|salud/);
});

void test('simultaneous arrivals at the same sector join one visit without resetting existing participants', () => {
  let campaign = initialCampaign();
  present(campaign.sectors['buenos_aires']).owner = 'royalist';
  const firstSquad = campaign.activeSquadId;
  campaign = order(campaign, { type: 'createSquad', name: 'Segunda escuadra', ids: [10] });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'selectSquad', id: firstSquad });
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'wait', hours: 24 });
  const decisions = pendingArrivalDecisions(campaign);
  campaign = order(campaign, {
    type: 'fightOnArrival',
    squadId: present(decisions[0]).squadId,
    decisionId: present(decisions[0]).id,
  });
  const first = prepareCampaignBattle(campaign, { placement: true });
  assert.equal(first.error, null);
  const oldParticipants = structuredClone(present(first.battle).units);
  const reinforced = order(first.campaign, {
    type: 'fightOnArrival',
    squadId: present(decisions[1]).squadId,
    decisionId: present(decisions[1]).id,
    sectorState: first.battle,
  });
  assert.equal(present(reinforced.pendingBattle).id, present(first.campaign.pendingBattle).id);
  assert.equal(reinforced.suspendedSectorSessions, undefined);
  const pair = prepareCampaignBattle(reinforced, { placement: true });
  assert.equal(pair.error, null);
  assert.equal(
    present(present(pair.battle).sectorSession).id,
    present(present(first.battle).sectorSession).id,
  );
  for (const participant of oldParticipants) {
    assert.deepEqual(
      present(pair.battle).units.find((unit) => unit.id === participant.id),
      participant,
    );
  }
  assert.equal(present(pair.battle).units.filter((unit) => unit.side === 'player').length, 3);
  assert.equal(pendingArrivalDecisions(pair.campaign).length, 0);
  decodeSave(encodeSave(pair.campaign, pair.battle));
});
