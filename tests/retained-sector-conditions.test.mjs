import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../game/campaign.js';
import { advanceCampaignWorld } from '../game/military-remains.js';
import { visit, leave } from './local-contract-fixture.mjs';

test('a transferred auxiliary does not suffer condition changes in its archived departure sector', () => {
  let campaign = initialCampaign(12);
  campaign.sectors.retiro.militia = [1, 0, 0];
  campaign = leave(visit(campaign));
  const militiaId = campaign.garrisons.retiro[0].id;
  const field = campaign.sectorStates.retiro;
  const archive = field.units.find((unit) => String(unit.id) === String(militiaId));
  archive.hp = 5;
  archive.bleeding = 1;
  archive.bandaged = 0;
  campaign = dispatchCampaign(campaign, {
    type: 'transferMilitia',
    from: 'retiro',
    to: 'buenos_aires',
    rank: 0,
    count: 1,
  });
  assert.equal(campaign.lastError, null);
  const beforeArchive = structuredClone(
    campaign.sectorStates.retiro.units.find((unit) => String(unit.id) === String(militiaId)),
  );
  const beforeCurrent = structuredClone(campaign.garrisons.buenos_aires[0]);
  campaign.hour += 1;
  advanceCampaignWorld(campaign);
  assert.deepEqual(
    campaign.sectorStates.retiro.units.find((unit) => String(unit.id) === String(militiaId)),
    beforeArchive,
  );
  assert.deepEqual(campaign.garrisons.buenos_aires[0], beforeCurrent);
  assert.equal(
    (campaign.sectorStates.retiro.deathHistory ?? []).some(
      (death) => String(death.actor.id) === String(militiaId),
    ),
    false,
  );
});
