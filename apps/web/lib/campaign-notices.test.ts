import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CampaignJourney,
  CampaignSnapshot,
} from '../../../packages/game/public/campaign-types.ts';
import { present } from '../../../tests/assert-present.ts';
import { initialCampaign } from '../../../tests/legacy-campaign-fixture.ts';
import { strategicClockInterrupt } from './campaign-notices.ts';

function readyJourney(): CampaignJourney {
  return {
    version: 1,
    path: ['retiro'],
    mode: 'march',
    startedAt: 0,
    legHours: 0,
    elapsed: 1,
    status: 'ready',
    returning: false,
    reason: null,
  };
}

function withReadyArrival(campaign: CampaignSnapshot): CampaignSnapshot {
  present(campaign.squads[0]).journey = readyJourney();
  return campaign;
}

function withPendingBattle(campaign: CampaignSnapshot): CampaignSnapshot {
  campaign.pendingBattle = { id: 'battle-1', sector: 'buenos_aires', squad: [] };
  return campaign;
}

void test('a refused command reports its error before every other notice', () => {
  const before = initialCampaign();
  const after = withPendingBattle(withReadyArrival(initialCampaign()));
  after.defeated = true;
  after.lastError = 'La orden fue rechazada.';
  assert.equal(strategicClockInterrupt(before, after), 'La orden fue rechazada.');
});

void test('a pending arrival decision is reported before a pending battle', () => {
  const before = initialCampaign();
  const after = withPendingBattle(withReadyArrival(initialCampaign()));
  assert.equal(
    strategicClockInterrupt(before, after),
    'Elegí combatir o retirarte. El tiempo de campaña está detenido.',
  );
});

void test('a defeated campaign is reported', () => {
  const before = initialCampaign();
  const after = initialCampaign();
  after.defeated = true;
  assert.equal(strategicClockInterrupt(before, after), 'La campaña ha terminado.');
});

void test('a trained skill is reported', () => {
  const before = initialCampaign();
  const after = structuredClone(before);
  present(after.operativeState[3]).trainedStats = { marksmanship: 1 };
  assert.equal(strategicClockInterrupt(before, after), 'Un combatiente mejoró una habilidad.');
});

void test('a campaign with nothing to report says nothing', () => {
  const campaign = initialCampaign();
  assert.equal(strategicClockInterrupt(campaign, campaign), null);
});
