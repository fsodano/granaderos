import { present } from './assert-present.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import assert from 'node:assert/strict';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { rosterFor, dispatchCampaign } from '../packages/game/campaign.js';
import { careAssignmentReason } from '../packages/game/medical-care.js';
import { operativeLocation } from '../packages/game/squads.js';
import { queueSquadTravel, travelLegHours } from '../packages/game/squad-travel.js';
import { captureRouteStrategicInput, recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';

export interface RecaptureVictory {
  sector: string;
  startSeconds: number;
  elapsedSeconds: number;
  status: string;
  turns: number;
  actions: number;
  units: Pick<BattleUnit, 'id' | 'hp' | 'side'>[];
}
export type FreshRouteOrderEvent =
  | { event: 'freshRouteStopped'; reason: string; campaign: CampaignSnapshot }
  | { event: 'freshRouteRenewal'; action: CampaignAction; id: number; price: number; hour: number; second: number; campaign: CampaignSnapshot }
  | { event: 'freshRouteOrder'; action: CampaignAction; hour: number; second: number; treasury: number; campaign: CampaignSnapshot }
  | { event: 'freshRouteCheckpoint'; stage: string; campaign: CampaignSnapshot }
  | { event: 'freshRouteRecaptureCasualties'; casualties: number[]; victories: Omit<RecaptureVictory, 'units'>[]; campaign: CampaignSnapshot };
export interface FreshRouteActionRefusal {
  campaign: CampaignSnapshot;
  action: CampaignAction;
  returnedCampaign: CampaignSnapshot;
  preDispatchInputIndependentlyCloned: boolean;
}
export interface FreshRouteOrderOptions {
  report?: (event: FreshRouteOrderEvent) => void;
  handledEncounters?: string[];
  onActionRefusal?: (detail: FreshRouteActionRefusal) => void;
}

export const freshRouteServingIds = (s: CampaignSnapshot) =>
  s.recruited.filter((id) => s.operativeState[id]?.alive && !s.operativeState[id].captured);
export const routeClock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0);

// Test-route protection only: every intended serving survivor keeps an actual
// paid term. Explicit dismissals still return equipment through normal orders.
// Report an accepted action before checking its resulting loss/interruption.
export function createFreshRouteOrders(
  read: () => CampaignSnapshot,
  write: (campaign: CampaignSnapshot) => void,
  { report = () => {}, handledEncounters = [], onActionRefusal }: FreshRouteOrderOptions = {},
) {
  const intended = new Set(freshRouteServingIds(read())),
    battleDeaths = new Map<number, number>();
  const fail = (message: string): never => {
    const campaign = read();
    recordRouteStrategicEvidence({
      helper: 'createFreshRouteOrders',
      stage: 'route-stopped',
      campaign,
      error: message,
    });
    report({ event: 'freshRouteStopped', reason: message, campaign });
    throw Error(message);
  };
  const check = () => {
    const s = read();
    for (const [id, minute] of battleDeaths) {
      const r = s.operativeState[id];
      assert.ok(
        r && !r.alive && r.hp === 0 && r.deathMinute === minute,
        `The actual recapture casualty ${id} must remain final.`,
      );
    }
    for (const id of intended) {
      const r = s.operativeState[id],
        expiry = contractExpiresSeconds(s.contracts[id]);
      if (
        !r?.alive ||
        r.captured ||
        !s.recruited.includes(id) ||
        !s.contracts[id] ||
        (expiry !== null && expiry <= routeClock(s))
      ) {
        fail(`The intended serving survivor ${id} is no longer available.`);
      }
    }
    for (const id of freshRouteServingIds(s)) {
      intended.add(id);
    }
  };
  const retain = (seconds = 3600) => {
    check();
    let s = read();
    for (const id of intended) {
      let contract = s.contracts[id],
        expiry = contractExpiresSeconds(contract);
      while (expiry !== null && expiry <= routeClock(s) + seconds) {
        const quote = contractQuote(
          s,
          rosterFor(s).find((op) => op.id === id),
          'day',
        );
        if (!quote.available || s.resources.treasury < quote.price) {
          fail(
            `The actual renewal for ${id} is unavailable: ${quote.reason ?? 'insufficient treasury'}.`,
          );
        }
        const action: CampaignAction = {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: present(present(contract).expiresAt),
            expectedExpiresSecond: present(contract).expiresSecond ?? 0,
          },
          cash = s.resources.treasury;
        const diagnosticBefore = onActionRefusal ? captureRouteStrategicInput(s) : null;
        const next = dispatchCampaign(s, action);
        if (next.lastError) {
          onActionRefusal?.({
            campaign: diagnosticBefore ?? s,
            action,
            returnedCampaign: next,
            preDispatchInputIndependentlyCloned: diagnosticBefore !== null,
          });
          fail(next.lastError);
        }
        write(next);
        s = next;
        assert.equal(s.resources.treasury, cash - quote.price);
        report({
          event: 'freshRouteRenewal',
          action,
          id,
          price: quote.price,
          hour: s.hour,
          second: s.secondOfHour ?? 0,
          campaign: s,
        });
        contract = s.contracts[id];
        expiry = contractExpiresSeconds(contract);
      }
    }
    return s;
  };
  const medicalHour = () => {
    const s = read(),
      roster = rosterFor(s),
      patients = roster
        .filter(
          (op) =>
            intended.has(op.id) &&
            present(s.operativeState[op.id]).assignment === 'patient' &&
            !careAssignmentReason(s, op, 'patient'),
        )
        .sort(
          (a, b) =>
            Number(present(s.operativeState[b.id]).bleeding > 0) -
              Number(present(s.operativeState[a.id]).bleeding > 0) ||
            present(s.operativeState[a.id]).hp / present(s.operativeState[a.id]).maxHp -
              present(s.operativeState[b.id]).hp / present(s.operativeState[b.id]).maxHp ||
            a.id - b.id,
        );
    const treated = new Set<number>();
    for (const doctor of roster.filter(
      (op) =>
        intended.has(op.id) &&
        present(s.operativeState[op.id]).assignment === 'doctor' &&
        !careAssignmentReason(s, op, 'doctor'),
    )) {
      const patient = patients.find(
        (op) =>
          op.id !== doctor.id &&
          !treated.has(op.id) &&
          operativeLocation(s, op.id) === operativeLocation(s, doctor.id) &&
          (present(s.operativeState[op.id]).bleeding > 0 ||
            present(s.operativeState[op.id]).hp < present(s.operativeState[op.id]).maxHp),
      );
      if (patient) {
        treated.add(patient.id);
      }
    }
    return treated;
  };
  const order = (action: CampaignAction) => {
    check();
    const before = read();
    if (before.pendingBattle) {
      fail('Return the actual tactical report before route preparation.');
    }
    if (before.pendingEncounter && action.type !== 'respondToEncounter') {
      fail('Resolve the actual encounter before route preparation.');
    }
    let seconds = action.type === 'wait' ? present(action.hours) * 3600 : 0;
    if (action.type === 'travel' && !action.queue) {
      const preview = structuredClone(before),
        q = preview.squads.find((q) => q.id === preview.activeSquadId);
      const journey = queueSquadTravel(preview, q, action);
      seconds = journey.path
        .slice(1)
        .reduce((sum, to, i) => sum + travelLegHours(journey.path[i], to, journey.mode) * 3600, 0);
    }
    if (seconds) {
      const treated = action.type === 'wait' && action.hours === 1 ? medicalHour() : new Set();
      for (const id of intended) {
        const r = before.operativeState[id];
        if ((present(r).hp < 15 || present(r).bleeding > 0) && !treated.has(id)) {
          fail(`Actual acute survivor ${id} needs finite care before this route clock advances.`);
        }
      }
    }
    retain(Math.max(3600, seconds + 1));
    const next = dispatchCampaign(read(), action);
    if (next.lastError) {
      fail(`${JSON.stringify(action)}: ${next.lastError}`);
    }
    write(next);
    report({
      event: 'freshRouteOrder',
      action,
      hour: next.hour,
      second: next.secondOfHour ?? 0,
      treasury: next.resources.treasury,
      campaign: next,
    });
    if (action.type === 'dismiss') {
      intended.delete(action.id);
    }
    check();
    if (next.pendingEncounter && !handledEncounters.includes(present(next.pendingEncounter.sector))) {
      fail(`The actual encounter at ${next.pendingEncounter.sector} interrupts preparation.`);
    }
    return next;
  };
  const adopt = (next: CampaignSnapshot, stage: string) => {
    write(next);
    report({ event: 'freshRouteCheckpoint', stage, campaign: next });
    check();
    if (next.pendingEncounter && !handledEncounters.includes(present(next.pendingEncounter.sector))) {
      fail(`The actual encounter at ${next.pendingEncounter.sector} interrupts ${stage}.`);
    }
    return next;
  };
  // Only completed Native recapture victories may retire actual deaths from
  // this service ledger. Every other intended survivor keeps the old checks.
  const adoptAfterRecapture = (next: CampaignSnapshot, victories: RecaptureVictory[]) => {
    check();
    const previous = read(),
      casualties = [];
    assert.ok(
      Array.isArray(victories) &&
        victories.every(
          (b) =>
            b.status === 'victory' &&
            Number.isFinite(b.startSeconds) &&
            b.startSeconds >= routeClock(previous) &&
            Number.isFinite(b.elapsedSeconds) &&
            b.elapsedSeconds >= 0 &&
            b.startSeconds + b.elapsedSeconds <= routeClock(next) &&
            Array.isArray(b.units),
        ),
      'Recapture casualties require completed in-interval Native victory reports.',
    );
    for (const id of intended) {
      const old = previous.operativeState[id],
        record = next.operativeState[id];
      assert.ok(record, `The intended serving survivor ${id} is missing.`);
      if (present(old).alive && !record.alive) {
        assert.ok(
          record.hp === 0 &&
            !record.captured &&
            Number.isSafeInteger(record.deathMinute) &&
            victories.some((b) =>
              b.units.some((u) => u.side === 'player' && u.id === String(id) && u.hp === 0),
            ),
          `The lost serving survivor ${id} needs an actual Native recapture death report.`,
        );
        casualties.push(id);
      }
    }
    for (const [id, record] of Object.entries(previous.operativeState)) {
      if (!record.alive) {
        assert.equal(next.operativeState[Number(id)]?.alive, false, 'Earlier casualties stay final.');
      }
    }
    for (const id of casualties) {
      intended.delete(id);
      battleDeaths.set(id, present(present(next.operativeState[id]).deathMinute));
    }
    write(next);
    check();
    if (casualties.length) {
      report({
        event: 'freshRouteRecaptureCasualties',
        casualties,
        victories: victories.map(
          ({ sector, startSeconds, elapsedSeconds, status, turns, actions }) => ({
            sector,
            startSeconds,
            elapsedSeconds,
            status,
            turns,
            actions,
          }),
        ),
        campaign: next,
      });
    }
    return next;
  };
  return { order, retain, adopt, adoptAfterRecapture, check, keepIds: () => [...intended] };
}

