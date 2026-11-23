import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { contractQuote } from '../packages/game/contracts.js';
import { fundServiceGuarantee } from '../packages/game/service-guarantees.js';
import { hiringPriceMultiplier } from '../packages/game/economy-balance.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';

type LegacyArrival = {
  operativeId: number;
  destination: string;
  bookedAt: number;
  bookedSecond: number;
  departedAt: number;
  departedSecond: number;
  dueAt: number;
  dueSecond: number;
  travelHours: number;
  term: string;
  priceScale: number;
  paid: number;
  permanent: boolean;
  serviceHours: number | null;
  guaranteeId?: string;
};
type LegacySnapshot = CampaignSnapshot & {
  hiringArrivals?: LegacyArrival[];
  serviceGuarantees?: { entries: Record<string, { state: string }> };
};

const TRAVEL_HOURS = 12;

function prepaidCampaign(destination: string) {
  const definition = defaultContentPackage();
  const authored = present(
    definition.characters.find((character) => character.id === 'person-110'),
  );
  authored.arrivalHours = TRAVEL_HOURS;
  authored.serviceGuarantee = 40;
  const campaign = initialCampaign(42, definition);
  const candidate = present(rosterFor(campaign).find((character) => character.id === 110));
  const quote = contractQuote(campaign, candidate, 'day');
  campaign.resources.treasury -= quote.total;
  const guarantee = fundServiceGuarantee(campaign, candidate, quote.guarantee);
  const second = campaign.secondOfHour ?? 0;
  (campaign as LegacySnapshot).hiringArrivals = [
    {
      operativeId: candidate.id,
      destination,
      bookedAt: campaign.hour,
      bookedSecond: second,
      departedAt: campaign.hour,
      departedSecond: second,
      dueAt: campaign.hour + TRAVEL_HOURS,
      dueSecond: second,
      travelHours: TRAVEL_HOURS,
      term: 'day',
      priceScale: Number(hiringPriceMultiplier(campaign)),
      paid: quote.price,
      permanent: quote.permanent,
      serviceHours: quote.hours,
      ...guarantee,
    },
  ];
  delete campaign.recruitmentVersion;
  return { campaign, quote, guaranteeId: present(guarantee.guaranteeId) };
}

function restore(campaign: CampaignSnapshot) {
  return decodeSave(encodeSave(structuredClone(campaign))).campaign as LegacySnapshot;
}

void test('a new campaign does not carry the retired hiringArrivals field', () => {
  assert.equal('hiringArrivals' in initialCampaign(42), false);
});

void test('a prepaid recruit with a legal destination joins immediately, keeping pay and guarantee', () => {
  const { campaign, quote, guaranteeId } = prepaidCampaign('buenos_aires');
  present(campaign.sectors['buenos_aires']).owner = 'patriot';
  const restored = restore(campaign);
  assert.deepEqual(restored.refundableRecruitmentClaims ?? [], []);
  assert.equal('hiringArrivals' in restored, false);
  assert.equal(restored.forceRoster.filter((id) => id === 110).length, 1);
  assert.equal(present(restored.characters[110]).location, 'buenos_aires');
  assert.equal(present(restored.contracts[110]).started, campaign.hour);
  assert.equal(present(restored.contracts[110]).paid, quote.price);
  assert.equal(present(restored.contracts[110]).guaranteeId, guaranteeId);
  assert.equal(present(restored.serviceGuarantees?.entries?.[guaranteeId]).state, 'held');
  assert.equal(present(restored.characters[110]).startingCartridgesIssued, true);
  assert.equal(restored.resources.treasury, campaign.resources.treasury);
  assert.deepEqual(restore(restored), restored);
});

void test('a prepaid recruit whose destination is unsafe joins at another legal site', () => {
  const { campaign, quote, guaranteeId } = prepaidCampaign('buenos_aires');
  assert.equal(present(campaign.sectors['buenos_aires']).owner, 'royalist');
  assert.equal(present(campaign.sectors['retiro']).owner, 'patriot');
  const restored = restore(campaign);
  assert.deepEqual(restored.refundableRecruitmentClaims ?? [], []);
  assert.equal(restored.forceRoster.filter((id) => id === 110).length, 1);
  assert.equal(present(restored.characters[110]).location, 'retiro');
  assert.equal(present(restored.contracts[110]).paid, quote.price);
  assert.equal(present(restored.contracts[110]).guaranteeId, guaranteeId);
  assert.equal(present(restored.serviceGuarantees?.entries?.[guaranteeId]).state, 'held');
});

void test('a prepaid recruit with no legal site stays a refundable claim the desk can cancel', () => {
  const { campaign, quote, guaranteeId } = prepaidCampaign('retiro');
  present(campaign.sectors['retiro']).owner = 'royalist';
  const restored = restore(campaign);
  assert.ok(!restored.forceRoster.includes(110));
  assert.equal('hiringArrivals' in restored, false);
  const claim = present(restored.refundableRecruitmentClaims?.[0]);
  assert.equal(claim.operativeId, 110);
  assert.equal(claim.destination, 'retiro');
  assert.equal(claim.paid, quote.price);
  assert.equal(claim.guaranteeId, guaranteeId);
  assert.equal(present(restored.serviceGuarantees?.entries?.[guaranteeId]).state, 'held');
  const treasury = restored.resources.treasury;
  const cancelled = dispatchCampaign(restored, {
    type: 'cancelRecruitmentClaim',
    id: 110,
    expectedGuaranteeId: guaranteeId,
  }) as LegacySnapshot;
  assert.equal(cancelled.lastError, null);
  assert.equal(cancelled.resources.treasury, treasury + quote.total);
  assert.deepEqual(cancelled.refundableRecruitmentClaims ?? [], []);
  assert.equal(present(cancelled.serviceGuarantees?.entries?.[guaranteeId]).state, 'cancelled');
  assert.ok(!cancelled.forceRoster.includes(110));
});

void test('a campaign with nothing pending restores unchanged', () => {
  const campaign = initialCampaign(42);
  assert.deepEqual(restore(campaign), campaign);
});
