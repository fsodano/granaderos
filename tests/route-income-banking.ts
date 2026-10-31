import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { RouteTownIncomeEvent } from './route-town-income.ts';
import { present } from './assert-present.ts';
export type RouteIncomeEvent =
  | RouteTownIncomeEvent
  | { event: 'routeIncomeRenewal'; id: number; price: number; hour: number; second: number }
  | {
      event: 'routeIncomeBanked';
      target: number;
      treasury: number;
      hour: number;
      second: number;
      daily: number;
    };
type IncomeOptions = { keepIds?: readonly number[]; report?: (event: RouteIncomeEvent) => void };
import assert from 'node:assert/strict';
import { rosterFor, dailyIncome } from '../packages/game/campaign.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { ensureRouteTownIncome } from './route-town-income.ts';
import { order, saved } from './local-contract-fixture.ts';

// A route's money is earned only after the actual port meeting and the daily
// payment boundary. Preserve named serving people with exact quoted renewal.
export function bankRouteIncome(
  start: CampaignSnapshot,
  target: number,
  { keepIds = start.squad, report = () => {} }: IncomeOptions = {},
) {
  assert.ok(Number.isFinite(target) && target >= 0);
  let s = ensureRouteTownIncome(start, { report });
  for (let hour = 0; s.resources.treasury < target && hour < 720; hour++) {
    assert.ok(
      !s.pendingEncounter && !s.pendingBattle,
      'Resolve the real encounter before banking port income.',
    );
    assert.ok(dailyIncome(s) > 0, 'An actual controlled port agreement must pay the route.');
    for (const id of keepIds) {
      if (
        !s.recruited.includes(id) ||
        !s.operativeState[id]?.alive ||
        s.operativeState[id].captured
      ) {
        continue;
      }
      const contract = s.contracts[id],
        expiry = contractExpiresSeconds(contract),
        now = s.hour * 3600 + (s.secondOfHour ?? 0);
      if (expiry === null || expiry > now + 3600) {
        continue;
      }
      const quote = contractQuote(s, present(rosterFor(s).find((op) => op.id === id)), 'day'),
        cash = s.resources.treasury;
      assert.ok(quote.available, quote.reason ?? undefined);
      s = order(s, {
        type: 'renewContract',
        id,
        term: 'day',
        expectedExpiresAt: present(present(contract).expiresAt),
        expectedExpiresSecond: present(contract).expiresSecond ?? 0,
      });
      assert.equal(s.resources.treasury, cash - quote.price);
      report({
        event: 'routeIncomeRenewal',
        id,
        price: quote.price,
        hour: s.hour,
        second: s.secondOfHour ?? 0,
      });
    }
    s = order(s, { type: 'wait', hours: 1 });
  }
  assert.ok(
    s.resources.treasury >= target,
    'Actual port income must fund the declared route budget.',
  );
  report({
    event: 'routeIncomeBanked',
    target,
    treasury: s.resources.treasury,
    hour: s.hour,
    second: s.secondOfHour ?? 0,
    daily: dailyIncome(s),
  });
  return saved({ campaign: s }).campaign;
}
