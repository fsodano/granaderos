import assert from 'node:assert/strict';
import { contractExpiresSeconds } from '../packages/game/contracts.js';

export function immediateRecruitmentExpectation(campaign, combatant, term, quote, destination) {
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

export function assertImmediateRecruitment(campaign, expectation, quote) {
  const id = expectation.operativeId;
  const contract = campaign.contracts[id];
  const startedAtSecond = expectation.bookedAt * 3600 + expectation.bookedSecond;
  assert.equal(campaign.recruited.filter((value) => value === id).length, 1);
  assert.equal(
    campaign.hiringArrivals.some((value) => value.operativeId === id),
    false,
  );
  assert.equal(campaign.operativeState[id].location, expectation.destination);
  assert.equal(contract.kind, quote.permanent ? 'patriot' : 'paid');
  assert.equal(contract.term, expectation.term);
  assert.equal(contract.paid, quote.price);
  assert.equal(contract.started * 3600 + (contract.startedSecond ?? 0), startedAtSecond);
  assert.equal(
    contractExpiresSeconds(contract),
    quote.permanent ? null : startedAtSecond + quote.hours * 3600,
  );
}
