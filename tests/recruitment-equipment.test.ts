import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { rosterFor as characterDefinitions } from '../packages/game/recruitment.ts';
import { campaignRules } from '../packages/game/campaign-rules.js';
import { ammunitionByType, weaponAmmoType } from '../packages/game/ammunition-types.js';
import { CampaignCharacterEquipmentMapper } from '../packages/game/infrastructure/personnel/campaign-character-equipment-mapper.ts';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { postContent } from './post-campaign-fixture.ts';
import { visit, leave } from './local-contract-fixture.ts';

void test('custom campaign recruitment preserves authored equipment and its finite ammunition through a sector visit', () => {
  let campaign = initialCampaign(8, postContent());
  const candidates = rosterFor(campaign)
    .filter((character) => character.recruitmentSource === 'contract')
    .sort(
      (left, right) =>
        Number(right.medical >= 80) - Number(left.medical >= 80) ||
        right.marksmanship - left.marksmanship,
    )
    .slice(0, 5);
  const initialAllowance = campaignRules(campaign).deploymentCartridges;
  const definitions = characterDefinitions(campaign);
  assert.ok(
    candidates.some(
      (candidate) =>
        present(definitions.find((definition) => definition.id === candidate.id)).weapon !==
        candidate.weapon,
    ),
  );

  for (const candidate of candidates) {
    campaign = dispatchCampaign(campaign, {
      type: 'recruitCombatant',
      characterId: String(candidate.id),
      term: 'week',
      destination: 'cordoba',
    });
    assert.equal(campaign.lastError, null);
    const record = campaign.operativeState[candidate.id];
    const actual = rosterFor(campaign).find((character) => character.id === candidate.id);
    assert.equal(present(actual).weapon, candidate.weapon);
    assert.equal(present(actual).blade, candidate.blade);
    assert.deepEqual(present(actual).weaponMetadata, candidate.weaponMetadata);
    assert.deepEqual(present(actual).bladeMetadata, candidate.bladeMetadata);
    assert.equal(present(record).startingCartridgesIssued, true);
    assert.deepEqual(ammunitionByType(record), {
      [present(weaponAmmoType(actual))]: initialAllowance - present(present(record).carriedLoaded),
    });
  }

  const acceptedRecords = structuredClone(campaign.operativeState);
  campaign = decodeSave(encodeSave(campaign)).campaign;
  assert.deepEqual(campaign.operativeState, acceptedRecords);
  const pair = visit(campaign);
  for (const candidate of candidates) {
    const participant = present(pair.battle).units.find((unit) => unit.id === String(candidate.id));
    assert.ok(participant);
    assert.equal(participant.weapon, candidate.weapon);
    assert.equal(participant.blade, candidate.blade);
    assert.deepEqual(participant.weaponMetadata, candidate.weaponMetadata);
    assert.deepEqual(participant.bladeMetadata, candidate.bladeMetadata);
    assert.equal(
      participant.loaded +
        Object.values(ammunitionByType(participant)).reduce((sum, quantity) => sum + quantity, 0),
      initialAllowance,
    );
  }
  campaign = decodeSave(encodeSave(leave(pair))).campaign;
  for (const candidate of candidates) {
    const returned = campaign.operativeState[candidate.id];
    assert.equal(
      present(returned).carriedLoaded,
      present(acceptedRecords[candidate.id]).carriedLoaded,
    );
    assert.deepEqual(ammunitionByType(returned), ammunitionByType(acceptedRecords[candidate.id]));
  }
});

void test('an explicit returned weapon does not inherit a previous authored definition', () => {
  const campaign = initialCampaign(8, postContent());
  const candidate = rosterFor(campaign).find((character) => character.contentId === 'benicio');
  delete present(campaign.operativeState[present(candidate).id]).weaponMetadata;
  delete present(campaign.operativeState[present(candidate).id]).bladeMetadata;
  const actual = new CampaignCharacterEquipmentMapper(campaign).project(present(candidate));
  assert.equal(actual.weapon, present(campaign.loadouts[present(candidate).id]).weapon);
  assert.equal(actual.blade, present(campaign.loadouts[present(candidate).id]).blade);
  assert.equal(actual.weaponMetadata, undefined);
  assert.equal(actual.bladeMetadata, undefined);
  assert.equal(actual.contentWeapon, undefined);
  assert.ok(present(candidate).weaponMetadata);
  assert.ok(present(candidate).bladeMetadata);
});
