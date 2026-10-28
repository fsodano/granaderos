import assert from 'node:assert/strict';
import { dispatchCampaign } from '../game/campaign.js';
import { battleFromRequest } from '../game/battle-handoff.js';
import { actBattle, endTurn } from '../game/tactical.js';
import { runBattleJob } from '../game/battle-job.js';
import { syncBattleTime } from '../game/time.js';
import { travelLegHours } from '../game/squad-travel.js';
import { pendingArrivalDecisions } from '../game/squad-travel.js';

export function fightOnArrivalOrder(campaign) {
  const decision = pendingArrivalDecisions(campaign).find(
    (choice) => choice.squadId === campaign.activeSquadId,
  );
  assert.ok(decision, 'The attacking squad must have an explicit hostile arrival decision.');
  return { type: 'fightOnArrival', squadId: decision.squadId, decisionId: decision.id };
}

export function fightOnArrival(campaign) {
  assert.equal(campaign.lastError, null);
  const accepted = dispatchCampaign(campaign, fightOnArrivalOrder(campaign));
  assert.equal(accepted.lastError, null);
  assert.ok(accepted.pendingBattle);
  return accepted;
}

export function enterAssault(campaign, sector) {
  return fightOnArrival(dispatchCampaign(campaign, { type: 'attack', sector }));
}

export function completeQueuedAssault(start, squadIds, sector, options = {}) {
  const selected = new Set(squadIds);
  assert.equal(selected.size, squadIds.length);
  assert.ok(selected.size > 0);
  let campaign = start;
  let battle = null;
  let sessionId = null;
  const deadline = gameSecond(start) + (options.maximumHours ?? 72) * 3600;
  const issue = (request) => {
    campaign = options.execute ? options.execute(request) : dispatchCampaign(campaign, request);
    assert.equal(campaign.lastError, null, `${request.type}: ${campaign.lastError}`);
    options.report?.({ event: 'queuedAssaultOrder', request, campaign });
  };
  const admitted = () => {
    const manifest = campaign.pendingBattle?.assaultSquads ?? [];
    return squadIds.every((id) => manifest.some((group) => group.id === id));
  };
  const synchronize = (snapshot) => {
    const synchronized = syncBattleTime(campaign, snapshot);
    assert.equal(synchronized.error, null, synchronized.error);
    issue({
      type: 'syncTacticalTime',
      battleId: campaign.pendingBattle.id,
      elapsedSeconds: snapshot.elapsedSeconds ?? 0,
      sectorState: snapshot,
    });
    battle = synchronized.battle;
  };
  for (let step = 0; step < (options.maximumOperations ?? 100_000); step++) {
    assert.ok(
      gameSecond(campaign) <= deadline,
      'The actual queued assault exceeded its time budget.',
    );
    if (campaign.pendingEncounter && !pendingArrivalDecisions(campaign).length) {
      assert.ok(
        !battle && options.resolveEncounter,
        'The queued assault needs its actual encounter resolved.',
      );
      campaign = options.resolveEncounter(campaign);
      assert.equal(campaign.pendingEncounter, null);
      continue;
    }
    const decisions = pendingArrivalDecisions(campaign);
    const decision = decisions.find((choice) => selected.has(choice.squadId));
    if (decision) {
      assert.equal(decision.sectorId, sector);
      issue({
        type: 'fightOnArrival',
        squadId: decision.squadId,
        decisionId: decision.id,
        ...(battle ? { sectorState: battle } : {}),
      });
      assert.equal(campaign.pendingBattle?.sector, sector);
      sessionId ??= campaign.pendingBattle.id;
      assert.equal(
        campaign.pendingBattle.id,
        sessionId,
        'Every reinforcement must join the same sector visit.',
      );
      if (admitted()) return campaign;
      synchronize(battleFromRequest(campaign.pendingBattle, campaign));
      continue;
    }
    assert.equal(
      decisions.length,
      0,
      'An unrelated hostile arrival needs its own explicit decision.',
    );
    if (admitted()) return campaign;
    if (!battle) {
      issue({ type: 'wait', hours: 1 });
      continue;
    }
    assert.ok(
      !['defeat', 'retreat'].includes(battle.status),
      'The first column must survive until its reinforcements arrive.',
    );
    const previous = battle;
    const previousSecond = gameSecond(campaign);
    const next = battle.pendingSectorOperation
      ? resumeBattleJob(battle)
      : battle.status === 'victory'
        ? actBattle(battle, { type: 'explore' })
        : endTurn(battle);
    assert.equal(next.lastError, null, next.lastError);
    synchronize(next);
    assert.ok(
      gameSecond(campaign) > previousSecond ||
        next.elapsedSeconds > previous.elapsedSeconds ||
        next.mode !== previous.mode ||
        JSON.stringify(next.pendingSectorOperation) !==
          JSON.stringify(previous.pendingSectorOperation),
      'The queued assault must make time or operation progress.',
    );
  }
  assert.fail('The queued assault exceeded its bounded operation count.');
}

const gameSecond = (campaign) => campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const resumeBattleJob = (battle) => runBattleJob({ battle, kind: 'resume', action: null });

export function stageAssaultDeparture(start, approaches, sector, options = {}) {
  let campaign = start;
  const earliest = options.earliestHour ?? 6;
  const latest = options.latestHour ?? 10;
  for (let wait = 0; wait <= 24; wait++) {
    const arrivals = approaches.map(({ id, mode = 'march' }) => {
      const squad = campaign.squads.find((group) => group.id === id);
      assert.ok(squad && !squad.journey);
      return (campaign.hour + travelLegHours(squad.location, sector, mode, campaign)) % 24;
    });
    if (arrivals.every((hour) => hour >= earliest && hour <= latest)) return campaign;
    assert.ok(wait < 24, 'The planned approach durations need a feasible daylight arrival window.');
    const request = { type: 'wait', hours: 1 };
    campaign = options.execute ? options.execute(request) : dispatchCampaign(campaign, request);
    assert.equal(campaign.lastError, null, campaign.lastError);
    if (campaign.pendingEncounter && options.resolveEncounter)
      campaign = options.resolveEncounter(campaign);
    assert.equal(
      campaign.pendingEncounter,
      null,
      'Resolve the actual staging encounter before departure.',
    );
  }
}
