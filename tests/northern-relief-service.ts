import { present } from './assert-present.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';
import { hireArrivalDueSeconds, pendingHire } from '../packages/game/hiring-arrivals.js';
import { immediateRecruitmentExpectation } from './immediate-recruitment-fixture.ts';
import { payMoraleRewardEligible } from '../packages/game/morale.js';
import {
  operativeLocation,
  operativeInTransit,
  canReassignOperative,
} from '../packages/game/squads.js';
import { routeHiringCeiling } from './funded-route-fixture.ts';

const seconds = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0),
  sector = 'tucuman';
const livingLocal = (c: CampaignSnapshot, id: number) =>
  c.recruited.includes(id) &&
  c.operativeState[id]?.alive &&
  !c.operativeState[id].captured &&
  c.operativeState[id].location === sector;
export const northernReliefFitLocal = (c: CampaignSnapshot) =>
  c.recruited.filter(
    (id) =>
      livingLocal(c, id) &&
      present(c.operativeState[id]).hp === present(c.operativeState[id]).maxHp &&
      !present(c.operativeState[id]).bleeding &&
      present(c.operativeState[id]).morale >= 30,
  );
export const northernReliefReplacements = (c: CampaignSnapshot) =>
  rosterFor(c)
    .filter(
      (op) =>
        op.id >= 100 &&
        op.id < 1000 &&
        !c.recruited.includes(op.id) &&
        !pendingHire(c, op.id) &&
        present(c.operativeState[op.id]).alive &&
        !present(c.operativeState[op.id]).captured &&
        contractQuote(c, op, 'week').available &&
        contractQuote(c, op, 'week').price <= routeHiringCeiling(c, 200),
    )
    .sort((a, b) => b.marksmanship - a.marksmanship || b.strength - a.strength || a.id - b.id);
const ready = (c: CampaignSnapshot) => {
  assert.equal(c.lastError, null, c.lastError);
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
};
const preserveFailure = (error, campaign, receipt) => {
  // These are the actual returned references, for plain diagnostic inspection.
  // Metadata attachment must not replace a Native or callback error.
  if (error && typeof error === 'object') {
    try {
      error.campaign = campaign;
      error.northernReliefService = receipt;
    } catch {}
  }
  return error;
};

// Retain only support needed by the real eight-person column. The existing
// final preparation can take 36 hours; this buys service for that same horizon,
// never a new rest window or repeated payments to manufacture morale.
export function retainNorthernReliefSupport(start: CampaignSnapshot, { report = () => {} } = {}) {
  let c = start;
  const now = seconds(c),
    until = now + 36 * 3600,
    renewals = [],
    receipt = { renewals, current: null };
  try {
    ready(c);
    const missing = () =>
      Math.max(0, 8 - northernReliefFitLocal(c).length - northernReliefReplacements(c).length);
    const candidates = rosterFor(c)
      .flatMap((op) => {
        const id = op.id,
          r = c.operativeState[id],
          contract = c.contracts[id],
          expiry = contractExpiresSeconds(contract);
        if (
          !livingLocal(c, id) ||
          !canReassignOperative(c, id) ||
          operativeLocation(c, id) !== sector ||
          operativeInTransit(c, id) ||
          !['active', 'rest'].includes(present(r).assignment) ||
          c.militiaTraining.some((course: { trainerId: number; }) => course.trainerId === id) ||
          contract?.departurePending ||
          contract?.kind !== 'paid' ||
          expiry === null ||
          expiry <= now ||
          expiry > until ||
          present(r).captive ||
          present(r).bound ||
          present(r).detained ||
          present(r).surrendered ||
          present(r).departure ||
          present(r).routed ||
          present(r).fled ||
          present(r).unconscious ||
          present(r).knockedDown ||
          present(r).asleep ||
          present(r).sleepCollapsed ||
          present(r).hp !== present(r).maxHp ||
          present(r).bleeding ||
          present(r).morale < 28 ||
          present(r).morale >= 30 ||
          !payMoraleRewardEligible(c, id)
        ) {
          return [];
        }
        const quote = contractRenewalQuote(c, op, 'day');
        return quote.available &&
          quote.price > 0 &&
          quote.price <= c.resources.treasury &&
          present(contractExpiresSeconds(quote)) > until
          ? [{ id, quote }]
          : [];
      })
      .sort((a, b) => a.quote.price - b.quote.price || a.id - b.id)
      .slice(0, missing());
    for (const { id } of candidates) {
      ready(c);
      if (!missing()) {
        break;
      }
      const op = rosterFor(c).find((row) => row.id === id),
        contract = c.contracts[id],
        expiry = contractExpiresSeconds(contract),
        quote = contractRenewalQuote(c, op, 'day'),
        cash = c.resources.treasury;
      assert.equal(quote.available, true, quote.reason);
      assert.ok(quote.price <= cash);
      assert.ok(present(contractExpiresSeconds(quote)) > until);
      const action = {
        type: 'renewContract',
        id,
        term: 'day',
        expectedExpiresAt: present(contract).expiresAt,
        expectedExpiresSecond: present(contract).expiresSecond ?? 0,
      };
      const row = {
        id,
        action,
        quote,
        previousExpirySeconds: expiry,
        treasuryBefore: cash,
        untilSeconds: until,
      };
      receipt.current = row;
      c = dispatchCampaign(c, action);
      ready(c);
      assert.equal(seconds(c), now);
      assert.equal(c.resources.treasury, cash - quote.price);
      assert.equal(contractExpiresSeconds(c.contracts[id]), contractExpiresSeconds(quote));
      assert.ok(
        northernReliefFitLocal(c).includes(id),
        'The actual retained survivor must qualify before reducing a real vacancy.',
      );
      Object.assign(row, {
        expirySeconds: contractExpiresSeconds(c.contracts[id]),
        treasury: c.resources.treasury,
      });
      renewals.push(row);
      receipt.current = null;
      report({ event: 'retainedNorthernReliefSupport', ...row });
    }
    return { campaign: c, retained: renewals.map((row) => row.id), renewals };
  } catch (error) {
    throw preserveFailure(error, c, receipt);
  }
}

// Recruitment grants control and starts paid service at the accepted game instant.
export function hireNorthernReliefReplacement(start: CampaignSnapshot, id: number, { report = () => {} } = {}) {
  let c = start;
  const receipt = { id };
  try {
    ready(c);
    const op = rosterFor(start).find((row) => row.id === id);
    assert.ok(op);
    assert.ok(!start.recruited.includes(id));
    assert.equal(pendingHire(start, id), undefined);
    const quote = contractQuote(start, op, 'week'),
      arrival = immediateRecruitmentExpectation(start, op, 'week', quote, sector),
      cash = start.resources.treasury,
      now = seconds(start);
    assert.equal(quote.available, true, quote.reason);
    assert.ok(quote.price <= routeHiringCeiling(start, 200));
    const action = { type: 'recruitCivic', id, term: 'week', destination: sector };
    Object.assign(receipt, { action, quote, arrival, treasuryBefore: cash });
    c = dispatchCampaign(c, action);
    ready(c);
    assert.equal(seconds(c), now);
    assert.equal(c.resources.treasury, cash - quote.total);

    const contract = c.contracts[id],
      r = c.operativeState[id];
    assert.equal(c.recruited.filter((value) => value === id).length, 1);
    assert.equal(operativeLocation(c, id), sector);
    assert.equal(operativeInTransit(c, id), false);
    assert.equal(present(r).alive, true);
    assert.equal(present(r).captured, false);
    assert.equal(present(r).hp, present(r).maxHp);
    assert.equal(present(r).bleeding, 0);
    assert.equal(present(contract).started * 3600 + (present(contract).startedSecond ?? 0), now);
    assert.equal(
      contractExpiresSeconds(contract),
      hireArrivalDueSeconds(arrival) + present(quote.hours) * 3600,
    );
    assert.equal(present(contract).paid, quote.price);
    assert.equal(pendingHire(c, id), undefined);

    receipt.treasury = c.resources.treasury;
    report({ event: 'paidNorthernReplacement', id, quote, arrival: structuredClone(arrival) });
    return c;
  } catch (error) {
    throw preserveFailure(error, c, receipt);
  }
}
