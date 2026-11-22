import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import * as campaignModule from '../packages/game/campaign.js';
import * as recruitmentModule from '../packages/game/recruitment.ts';
import type { CampaignAction } from '../packages/game/public/campaign-types.ts';

void test('dispatchCampaign refuses the retired recruitCivic command alias', () => {
  const campaign = initialCampaign();
  // The retired alias is no longer part of CampaignAction, so the order starts
  // as a canonical hire and takes the old runtime name before it is dispatched.
  const retiredCommand: CampaignAction = { type: 'recruitCombatant', id: 101, term: 'week' };
  Object.assign(retiredCommand, { type: 'recruitCivic' });
  const refused = dispatchCampaign(campaign, retiredCommand);
  assert.equal(refused.lastError, 'Orden desconocida.');
  assert.deepEqual(refused.recruited, campaign.recruited);
  assert.deepEqual(refused.contracts, campaign.contracts);
});

void test('dispatchCampaign still hires a combatant with the canonical recruitCombatant command', () => {
  const campaign = initialCampaign();
  const hired = dispatchCampaign(campaign, { type: 'recruitCombatant', id: 101, term: 'week' });
  assert.equal(hired.lastError, null);
  assert.ok(hired.recruited.includes(101));
  assert.ok(hired.contracts[101]);
});

void test('candidateAdmission is exported by recruitment.ts and campaign.js, and civicStatus is not', () => {
  assert.equal(typeof recruitmentModule.candidateAdmission, 'function');
  assert.equal(typeof campaignModule.candidateAdmission, 'function');
  assert.equal('civicStatus' in recruitmentModule, false);
  assert.equal('civicStatus' in campaignModule, false);
});
