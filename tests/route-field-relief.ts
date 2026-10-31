import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignServiceContract,
} from '../packages/game/public/campaign-types.ts';
import type { ContractQuote } from '../packages/game/public/personnel-query-types.ts';
import type { ImmediateRecruitmentReceipt } from './immediate-recruitment-fixture.ts';
import { present } from './assert-present.ts';
export type RouteReliefOrder = {
  action: CampaignAction;
  from: number;
  to: number;
  treasuryBefore: number;
  treasuryAfter: number;
};
export type RouteReliefHire = {
  id: number;
  quote: ContractQuote;
  arrival: ImmediateRecruitmentReceipt;
  guaranteeId: string | null;
  debited: number;
};
export type RouteReliefRenewal = {
  id: number;
  quote: ContractQuote;
  previous: CampaignServiceContract;
  contract: CampaignServiceContract;
  debited: number;
};
export type RouteFieldReliefEvent =
  | ({ event: 'routeFieldReliefOrder' } & RouteReliefOrder)
  | ({ event: 'routeFieldReliefBooked' } & RouteReliefHire);
type ReliefOptions = { minimum?: number; report?: (event: RouteFieldReliefEvent) => void };
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor, civicStatus } from '../packages/game/campaign.js';
import { isContractOperative } from '../packages/game/content-character-ids.ts';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';
import { hireArrivalDueSeconds, hiringArrivalReason } from '../packages/game/hiring-arrivals.js';
import { immediateRecruitmentExpectation } from './immediate-recruitment-fixture.ts';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);

// Restore only the size of a local serving force. The caller still owns real
// wound care, equipment, formation and every mandatory encounter response.
export function recruitRouteFieldRelief(
  start: CampaignSnapshot,
  { minimum = 12, report = () => {} }: ReliefOptions = {},
) {
  assert.ok(
    Number.isSafeInteger(minimum) && minimum >= 1 && minimum <= 12,
    'Relief needs a bounded one- or two-column target.',
  );
  const before = structuredClone(start),
    sector = start.location,
    hires: RouteReliefHire[] = [],
    renewals: RouteReliefRenewal[] = [],
    orders: RouteReliefOrder[] = [];
  let campaign = structuredClone(start);
  const local = () =>
    campaign.recruited.filter((id) => {
      const r = campaign.operativeState[id],
        expiry = contractExpiresSeconds(campaign.contracts[id]);
      return (
        r?.alive &&
        !r.captured &&
        !operativeInTransit(campaign, id) &&
        operativeLocation(campaign, id) === sector &&
        (expiry === null || expiry > clock(campaign))
      );
    });
  const queued = () =>
    campaign.hiringArrivals.filter(
      (a) =>
        a.destination === sector &&
        campaign.operativeState[a.operativeId]?.alive &&
        !present(campaign.operativeState[a.operativeId]).captured,
    );
  const stopped = () =>
    campaign.pendingEncounter
      ? 'pending-encounter'
      : campaign.pendingBattle
        ? 'pending-battle'
        : campaign.defeated
          ? 'campaign-defeated'
          : null;
  const finish = (reason: string | null) => {
    assert.deepEqual(start, before, 'Relief must not mutate its caller input.');
    return {
      campaign,
      hires,
      renewals,
      orders,
      localIds: local(),
      ready: !reason && local().length >= minimum,
      reason: reason ?? null,
    };
  };
  const execute = (action: CampaignAction) => {
    const from = clock(campaign),
      cash = campaign.resources.treasury;
    const next = dispatchCampaign(campaign, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    campaign = next;
    const row = {
      action: structuredClone(action),
      from,
      to: clock(campaign),
      treasuryBefore: cash,
      treasuryAfter: campaign.resources.treasury,
    };
    orders.push(row);
    report(structuredClone({ event: 'routeFieldReliefOrder', ...row }));
  };
  const retain = (until: number) => {
    for (const id of campaign.recruited) {
      const body = campaign.operativeState[id];
      if (!body?.alive || body.captured) {
        continue;
      }
      let expiry = contractExpiresSeconds(campaign.contracts[id]);
      if (expiry !== null && expiry <= clock(campaign)) {
        return 'Serving contract ' + id + ' has already expired.';
      }
      for (let n = 0; expiry !== null && expiry <= until; n++) {
        assert.ok(n < 8, 'A bounded relief arrival cannot require unbounded daily renewals.');
        const person = rosterFor(campaign).find((op) => op.id === id),
          quote = contractRenewalQuote(campaign, present(person), 'day');
        if (!quote.available) {
          return 'Required renewal ' + id + ': ' + quote.reason;
        }
        if (quote.price > campaign.resources.treasury) {
          return 'Insufficient treasury for required renewal ' + id + '.';
        }
        const previous = structuredClone(present(campaign.contracts[id])),
          cash = campaign.resources.treasury;
        const action: CampaignAction = {
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: present(previous.expiresAt),
          expectedExpiresSecond: previous.expiresSecond ?? 0,
        };
        execute(action);
        assert.equal(campaign.resources.treasury, cash - quote.price);
        expiry = contractExpiresSeconds(campaign.contracts[id]);
        assert.ok(present(expiry) > present(contractExpiresSeconds(previous)));
        renewals.push({
          id,
          quote: structuredClone(quote),
          previous,
          contract: structuredClone(present(campaign.contracts[id])),
          debited: cash - campaign.resources.treasury,
        });
        if (stopped()) {
          return stopped();
        }
      }
    }
    return null;
  };
  if (stopped()) {
    return finish(stopped());
  }
  if (local().length >= minimum) {
    return finish(null);
  }
  const admission = hiringArrivalReason(campaign, sector);
  if (admission) {
    return finish(admission);
  }
  // Existing bookings count before any new quote. Re-entry after a real raid
  // must neither charge them again nor invent their arrival or their service.
  for (let booking = 0; local().length + queued().length < minimum; booking++) {
    assert.ok(booking < minimum, 'Relief books at most the actual bounded deficit.');
    const candidates = rosterFor(campaign)
      .filter((op) => isContractOperative(campaign, op) && civicStatus(campaign, op.id).available)
      .map((person) => ({ person, quote: contractQuote(campaign, person, 'week') }))
      .filter(({ quote }) => quote.available && !quote.permanent && quote.price > 0)
      .sort(
        (a, b) =>
          a.quote.total - b.quote.total ||
          (b.person.marksmanship ?? 0) - (a.person.marksmanship ?? 0) ||
          a.person.id - b.person.id,
      );
    const chosen = candidates[0];
    if (!chosen) {
      return finish('No available paid catalogue relief.');
    }
    const { person, quote } = chosen;
    if (quote.total > campaign.resources.treasury) {
      return finish('Insufficient treasury for paid local relief.');
    }
    const arrival = immediateRecruitmentExpectation(campaign, person, 'week', quote, sector),
      cash = campaign.resources.treasury;
    execute({ type: 'recruitCivic', id: person.id, term: 'week', destination: sector });
    assert.equal(campaign.resources.treasury, cash - quote.total);
    const reference =
      campaign.hiringArrivals.find((a) => a.operativeId === person.id) ??
      campaign.contracts[person.id];
    const hire = {
      id: person.id,
      quote: structuredClone(quote),
      arrival: structuredClone(arrival),
      guaranteeId: present(reference).guaranteeId ?? null,
      debited: cash - campaign.resources.treasury,
    };
    hires.push(hire);
    report(structuredClone({ event: 'routeFieldReliefBooked', ...hire }));
    if (stopped()) {
      return finish(stopped());
    }
  }
  for (let attempt = 0; local().length < minimum; attempt++) {
    if (stopped()) {
      return finish(stopped());
    }
    if (!queued().length) {
      return finish('Paid local relief has no remaining arrival.');
    }
    if (attempt >= 240) {
      return finish('Paid local relief did not arrive within 240 real wait attempts.');
    }
    const acute = campaign.recruited.find((id) => {
      const r = campaign.operativeState[id];
      return r?.alive && !r.captured && (r.hp < 15 || r.bleeding > 0);
    });
    if (acute !== undefined) {
      return finish('Actual acute survivor ' + acute + ' needs finite care before relief waiting.');
    }
    const retained = retain(clock(campaign) + 3600);
    if (retained) {
      return finish(retained);
    }
    const remaining = Math.max(...queued().map(hireArrivalDueSeconds)) - clock(campaign);
    assert.ok(remaining <= 168 * 3600, 'Only the actual bounded arrival journey may be awaited.');
    execute({ type: 'wait', hours: 1 });
    // A zero-time attention return is legal. Retry only through another real
    // wait, under the fixed attempt bound; a real encounter belongs to caller.
  }
  return finish(stopped());
}
