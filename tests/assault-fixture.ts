import { present } from './assert-present.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { battleFromRequest } from '../packages/game/battle-handoff.js';
import { actBattle, endTurn } from '../packages/game/tactical.js';
import { runBattleJob } from '../packages/game/battle-job.ts';
import { syncBattleTime } from '../packages/game/time.js';
import { travelLegHours } from '../packages/game/squad-travel.js';
import { pendingArrivalDecisions } from '../packages/game/squad-travel.js';

interface AssaultOptions {
  maximumHours?: number;
  maximumOperations?: number;
  execute?: (action: CampaignAction) => CampaignSnapshot;
  resolveEncounter?: (campaign: CampaignSnapshot) => CampaignSnapshot;
  report?: (receipt: {
    event: 'queuedAssaultOrder';
    request: CampaignAction;
    campaign: CampaignSnapshot;
  }) => void;
  earliestHour?: number;
  latestHour?: number;
}

export function fightOnArrivalOrder(campaign: CampaignSnapshot): CampaignAction {
  const decision = pendingArrivalDecisions(campaign).find(
    (choice) => choice.squadId === campaign.activeSquadId,
  );
  assert.ok(decision, 'The attacking squad must have an explicit hostile arrival decision.');
  return { type: 'fightOnArrival', squadId: decision.squadId, decisionId: decision.id };
}

export function fightOnArrival(campaign: CampaignSnapshot) {
  assert.equal(campaign.lastError, null);
  const accepted = dispatchCampaign(campaign, fightOnArrivalOrder(campaign));
  assert.equal(accepted.lastError, null);
  assert.ok(accepted.pendingBattle);
  return accepted;
}

export function enterAssault(campaign: CampaignSnapshot, sector: string) {
  return fightOnArrival(dispatchCampaign(campaign, { type: 'attack', sector }));
}

export function completeQueuedAssault(
  start: CampaignSnapshot,
  squadIds: string[],
  sector: string,
  options: AssaultOptions = {},
) {
  const selected = new Set(squadIds);
  assert.equal(selected.size, squadIds.length);
  assert.ok(selected.size > 0);
  let campaign = start;
  let battle: BattleSnapshot | null = null;
  let sessionId: string | null = null;
  const deadline = gameSecond(start) + (options.maximumHours ?? 72) * 3600;
  const issue = (request: CampaignAction) => {
    campaign = options.execute ? options.execute(request) : dispatchCampaign(campaign, request);
    assert.equal(campaign.lastError, null, `${request.type}: ${campaign.lastError}`);
    options.report?.({ event: 'queuedAssaultOrder', request, campaign });
  };
  const admitted = () => {
    const manifest = campaign.pendingBattle?.assaultSquads ?? [];
    return squadIds.every((id) => manifest.some((group) => group.id === id));
  };
  const synchronize = (snapshot: BattleSnapshot) => {
    const synchronized = syncBattleTime(campaign, snapshot);
    assert.equal(synchronized.error, null, synchronized.error ?? undefined);
    issue({
      type: 'syncTacticalTime',
      battleId: present(campaign.pendingBattle).id,
      elapsedSeconds: snapshot.elapsedSeconds ?? 0,
      sectorState: snapshot,
    });
    return synchronized.battle;
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
      sessionId ??= present(campaign.pendingBattle).id;
      assert.equal(
        present(campaign.pendingBattle).id,
        sessionId,
        'Every reinforcement must join the same sector visit.',
      );
      if (admitted()) {
        return campaign;
      }
      battle = synchronize(battleFromRequest(campaign.pendingBattle, campaign));
      continue;
    }
    assert.equal(
      decisions.length,
      0,
      'An unrelated hostile arrival needs its own explicit decision.',
    );
    if (admitted()) {
      return campaign;
    }
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
    const next: BattleSnapshot = battle.pendingSectorOperation
      ? resumeBattleJob(battle)
      : battle.status === 'victory'
        ? actBattle(battle, { type: 'explore' })
        : endTurn(battle);
    assert.equal(next.lastError, null, next.lastError ?? undefined);
    battle = synchronize(next);
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

const gameSecond = (campaign: CampaignSnapshot) =>
  campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const resumeBattleJob = (battle: BattleSnapshot) =>
  runBattleJob({ battle, kind: 'resume', action: null });

export function stageAssaultDeparture(
  start: CampaignSnapshot,
  approaches: { id: string; mode?: string }[],
  sector: string,
  options: AssaultOptions = {},
) {
  let campaign = start;
  const earliest = options.earliestHour ?? 6;
  const latest = options.latestHour ?? 10;
  for (let wait = 0; wait <= 24; wait++) {
    const arrivals = approaches.map(({ id, mode = 'march' }) => {
      const squad = campaign.squads.find((group) => group.id === id);
      assert.ok(squad && !squad.journey);
      return (campaign.hour + travelLegHours(squad.location, sector, mode, campaign)) % 24;
    });
    if (arrivals.every((hour) => hour >= earliest && hour <= latest)) {
      return campaign;
    }
    assert.ok(wait < 24, 'The planned approach durations need a feasible daylight arrival window.');
    const request: CampaignAction = { type: 'wait', hours: 1 };
    campaign = options.execute ? options.execute(request) : dispatchCampaign(campaign, request);
    assert.equal(campaign.lastError, null, campaign.lastError ?? undefined);
    if (campaign.pendingEncounter && options.resolveEncounter) {
      campaign = options.resolveEncounter(campaign);
    }
    assert.equal(
      campaign.pendingEncounter,
      null,
      'Resolve the actual staging encounter before departure.',
    );
  }
  assert.fail('The staged assault has no feasible departure.');
}
