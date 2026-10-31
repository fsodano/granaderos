import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, rosterFor } from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { contractQuote } from '../packages/game/contracts.js';
import { hireArrivalOrder } from '../packages/game/hiring-arrivals.js';
import { fundServiceGuarantee } from '../packages/game/service-guarantees.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';

function prepaidRecruitment() {
  const definition = defaultContentPackage();
  present(definition.characters.find((character) => character.id === 'person-110')).arrivalHours =
    12;
  const campaign = initialCampaign(42, definition);
  const candidate = rosterFor(campaign).find((character) => character.id === 110);
  const quote = contractQuote(campaign, candidate, 'day');
  campaign.resources.treasury -= quote.total;
  const guarantee = fundServiceGuarantee(campaign, candidate, quote.guarantee);
  campaign.hiringArrivals = [
    { ...hireArrivalOrder(campaign, candidate, 'day', quote, campaign.location), ...guarantee },
  ];
  delete campaign.recruitmentVersion;
  return campaign;
}

void test('a prepaid legacy recruit becomes available at saved time without paying or issuing equipment twice', () => {
  const legacy = prepaidRecruitment();
  const restored = decodeSave(encodeSave(legacy)).campaign;
  assert.equal(restored.resources.treasury, legacy.resources.treasury);
  assert.equal(restored.hour, legacy.hour);
  assert.equal(restored.secondOfHour ?? 0, legacy.secondOfHour ?? 0);
  assert.equal(restored.recruitmentVersion, 2);
  assert.deepEqual(restored.hiringArrivals, []);
  assert.ok(restored.recruited.includes(110));
  assert.ok(restored.squad.includes(110));
  assert.equal(present(restored.contracts[110]).started, legacy.hour);
  assert.equal(present(restored.contracts[110]).expiresAt, legacy.hour + 24);
  assert.equal(present(restored.contracts[110]).paid, present(legacy.hiringArrivals[0]).paid);
  assert.equal(present(restored.operativeState[110]).startingCartridgesIssued, true);
  assert.deepEqual(decodeSave(encodeSave(restored)).campaign, restored);
});
