import { present } from './assert-present.ts';
import type {
  CampaignSnapshot,
  CampaignOperative,
  CampaignHiringArrival,
} from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import type { ContractQuote } from '../packages/game/public/personnel-query-types.ts';
export type ImmediateRecruitmentReceipt = CampaignHiringArrival & {
  bookedSecond: number;
  departedSecond: number;
  dueSecond: number;
};
import { contractExpiresSeconds } from '../packages/game/contracts.js';

export function immediateRecruitmentExpectation(
  campaign: CampaignSnapshot,
  combatant: CampaignOperative,
  term: string,
  quote: ContractQuote,
  destination: string,
): ImmediateRecruitmentReceipt {
  const second = campaign.secondOfHour ?? 0;
  return {
    operativeId: combatant.id,
    destination,
    bookedAt: campaign.hour,
    bookedSecond: second,
    departedAt: campaign.hour,
    departedSecond: second,
    dueAt: campaign.hour,
    dueSecond: second,
    travelHours: 0,
    term,
    paid: quote.price,
    permanent: quote.permanent,
    serviceHours: quote.hours,
  };
}

export function assertImmediateRecruitment(
  campaign: CampaignSnapshot,
  expectation: ImmediateRecruitmentReceipt,
  quote: ContractQuote,
) {
  const id = expectation.operativeId;
  const contract = campaign.contracts[id];
  const startedAtSecond = expectation.bookedAt * 3600 + expectation.bookedSecond;
  assert.equal(campaign.recruited.filter((value) => value === id).length, 1);
  assert.equal(
    campaign.hiringArrivals.some((value) => value.operativeId === id),
    false,
  );
  assert.equal(present(campaign.operativeState[id]).location, expectation.destination);
  assert.equal(present(contract).kind, quote.permanent ? 'patriot' : 'paid');
  assert.equal(present(contract).term, expectation.term);
  assert.equal(present(contract).paid, quote.price);
  assert.equal(
    present(present(contract).started) * 3600 + (present(contract).startedSecond ?? 0),
    startedAtSecond,
  );
  assert.equal(
    contractExpiresSeconds(contract),
    quote.permanent ? null : startedAtSecond + present(quote.hours) * 3600,
  );
}
