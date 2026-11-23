import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MILITIA_PATROL, validateCampaignPatrol } from './militia-patrol.ts';

const campaignPatrol = Object.freeze({
  enabled: false,
  waypointTicks: 4,
  energyReserve: 40,
  restEnergy: 12,
});

const campaign = {
  contentCampaign: { package: { militiaPatrol: campaignPatrol } },
};

void test('the default militia patrol rules keep their values', () => {
  assert.deepEqual(DEFAULT_MILITIA_PATROL, {
    enabled: true,
    waypointTicks: 8,
    energyReserve: 50,
    restEnergy: 10,
  });
});

void test('the default militia patrol rules stay frozen', () => {
  assert.equal(Object.isFrozen(DEFAULT_MILITIA_PATROL), true);
});

void test('a scene whose patrol rules match the campaign is accepted', () => {
  assert.doesNotThrow(() =>
    validateCampaignPatrol(campaign, { militiaPatrol: { ...campaignPatrol } }),
  );
});

void test('a scene whose patrol rules disagree with the campaign is refused', () => {
  assert.throws(
    () =>
      validateCampaignPatrol(campaign, { militiaPatrol: { ...campaignPatrol, restEnergy: 11 } }),
    { message: 'Las reglas de patrulla no coinciden con la campaña.' },
  );
});
