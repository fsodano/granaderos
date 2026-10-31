import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { advanceCampaignWorld } from '../packages/game/military-remains.js';
import { visit, leave } from './local-contract-fixture.ts';

void test('a transferred auxiliary does not suffer condition changes in its archived departure sector', () => {
  let campaign = initialCampaign(12);
  present(campaign.sectors['retiro']).militia = [1, 0, 0];
  campaign = leave(visit(campaign));
  const militiaId = present(present(campaign.garrisons['retiro'])[0]).id;
  const field = campaign.sectorStates['retiro'];
  const archive = present(field).units.find((unit) => String(unit.id) === String(militiaId));
  present(archive).hp = 5;
  present(archive).bleeding = 1;
  present(archive).bandaged = 0;
  campaign = dispatchCampaign(campaign, {
    type: 'transferMilitia',
    from: 'retiro',
    to: 'buenos_aires',
    rank: 0,
    count: 1,
  });
  assert.equal(campaign.lastError, null);
  const beforeArchive = structuredClone(
    present(campaign.sectorStates['retiro']).units.find(
      (unit) => String(unit.id) === String(militiaId),
    ),
  );
  const beforeCurrent = structuredClone(present(campaign.garrisons['buenos_aires'])[0]);
  campaign.hour += 1;
  advanceCampaignWorld(campaign);
  assert.deepEqual(
    present(campaign.sectorStates['retiro']).units.find(
      (unit) => String(unit.id) === String(militiaId),
    ),
    beforeArchive,
  );
  assert.deepEqual(present(campaign.garrisons['buenos_aires'])[0], beforeCurrent);
  assert.equal(
    (present(campaign.sectorStates['retiro']).deathHistory ?? []).some(
      (death) => String(death.actor.id) === String(militiaId),
    ),
    false,
  );
});
