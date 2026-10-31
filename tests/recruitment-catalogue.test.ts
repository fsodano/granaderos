import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { GetRecruitmentCandidatesUseCase } from '../packages/game/application/personnel/get-recruitment-candidates/get-recruitment-candidates.use-case.ts';
import { CampaignGetRecruitmentCandidatesRepository } from '../packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js';

function candidates(campaign: CampaignSnapshot, availability: string) {
  const repository = new CampaignGetRecruitmentCandidatesRepository(campaign, rosterFor(campaign));
  return new GetRecruitmentCandidatesUseCase(repository).execute({ availability }).characterIds;
}

void test('available recruitment candidates obey service relationships and retain query purity', () => {
  const definition = defaultContentPackage();
  present(
    definition.characters.find((character) => character.id === 'person-110'),
  ).serviceRefusals = [{ character: 'person-111', reason: 'No aceptan servir juntos.' }];
  present(definition.rules).startingTreasury = 100_000;
  const campaign = dispatchCampaign(initialCampaign(1812, definition), {
    type: 'recruitCombatant',
    characterId: '111',
    term: 'day',
  });
  assert.equal(campaign.lastError, null);
  const accepted = structuredClone(campaign);
  assert.equal(candidates(campaign, 'available').includes('110'), false);
  assert.ok(candidates(campaign, 'unavailable').includes('110'));
  assert.ok(candidates(campaign, 'hired').includes('111'));
  assert.deepEqual(campaign, accepted);
});

void test('an equipment return obligation excludes a candidate from available recruitment', () => {
  const campaign = initialCampaign();
  present(campaign.operativeState[110]).serviceEquipmentReturn = {
    id: 'service-return-110',
    sectorId: 'retiro',
    siteId: 'retiro',
    entryEdge: 'N',
    entryAnchor: { x: 4, y: 0 },
  };
  assert.equal(candidates(campaign, 'available').includes('110'), false);
  assert.ok(candidates(campaign, 'unavailable').includes('110'));
});
