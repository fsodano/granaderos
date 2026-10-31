import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialCampaign,
  dispatchCampaign,
  rosterFor,
  contractQuote,
} from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';

void test('an authored arrival delay does not postpone control or contract start', () => {
  const definition = defaultContentPackage();
  present(definition.characters.find((character) => character.id === 'person-110')).arrivalHours =
    12;
  present(definition.rules).startingTreasury = 100_000;
  const campaign = initialCampaign(1812, definition);
  campaign.secondOfHour = 61;
  const candidate = rosterFor(campaign).find((character) => character.id === 110);
  const quote = contractQuote(campaign, candidate, 'day');
  const accepted = dispatchCampaign(campaign, {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'day',
  });
  assert.equal(accepted.lastError, null);
  assert.ok(accepted.recruited.includes(110));
  assert.ok(accepted.squad.includes(110));
  assert.equal(present(accepted.operativeState[110]).location, campaign.location);
  assert.equal(accepted.hour, campaign.hour);
  assert.equal(accepted.secondOfHour, 61);
  assert.equal(present(accepted.contracts[110]).started, campaign.hour);
  assert.equal(present(accepted.contracts[110]).startedSecond, 61);
  assert.equal(present(accepted.contracts[110]).expiresSecond, 61);
  assert.equal(accepted.resources.treasury, campaign.resources.treasury - quote.total);
  assert.deepEqual(accepted.hiringArrivals ?? [], []);
  const restored = decodeSave(encodeSave(accepted)).campaign;
  assert.deepEqual(restored, accepted);
  const repeated = dispatchCampaign(restored, {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'day',
  });
  assert.ok(repeated.lastError);
  assert.equal(repeated.resources.treasury, accepted.resources.treasury);
  assert.equal(repeated.gameRevision, accepted.gameRevision);
});

void test('insufficient payment and stale requests preserve the entire accepted game', () => {
  const campaign = initialCampaign();
  campaign.resources.treasury = 0;
  const rejected = dispatchCampaign(campaign, {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'day',
  });
  assert.ok(rejected.lastError);
  assert.deepEqual({ ...rejected, lastError: null }, { ...campaign, lastError: null });
  const stale = dispatchCampaign(campaign, {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'day',
    expectedRevision: 42,
  });
  assert.ok(stale.lastError);
  assert.deepEqual({ ...stale, lastError: null }, { ...campaign, lastError: null });
});
