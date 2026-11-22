import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot, BattleTile } from '../packages/game/public/compatibility-types.ts';
import type { GameSnapshotContent } from '../packages/game/public/game-snapshot-types.ts';
import { parseJsonObject } from '../packages/campaign-format/json-value.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';

const COMPACTED_MAP_COUNT = 12;
const COMPACTED_MAP_SIZE = 64;

function deployed(): { campaign: CampaignSnapshot; battle: BattleSnapshot } {
  let campaign = dispatchCampaign(initialCampaign(12), {
    type: 'recruitCombatant',
    id: 110,
    term: 'week',
  });
  assert.equal(campaign.lastError, null);
  campaign = dispatchCampaign(campaign, { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  const result = prepareCampaignBattle(campaign);
  assert.equal(result.error, null);
  return { campaign: result.campaign, battle: present(result.battle) };
}

function evenTerrain(size: number): BattleTile[] {
  return Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: Math.floor(index / size),
    type: 'grass',
  }));
}

void test('the game snapshot types describe the envelope the save produces', () => {
  const pair = deployed();
  const encoded = encodeSave(pair.campaign, pair.battle);
  const content: GameSnapshotContent = decodeSave(encoded);
  assert.deepEqual(content, pair);
  const envelope = parseJsonObject(encoded);
  assert.equal(envelope['format'], 'granaderos');
  assert.ok(envelope['schema'] === 1 || envelope['schema'] === 2);
  assert.equal(typeof envelope['savedAt'], 'string');
});

void test('a save whose terrain is compacted carries schema 2', () => {
  const pair = deployed();
  const campaign = structuredClone(pair.campaign);
  const template = structuredClone(pair.battle);
  const tiles = evenTerrain(COMPACTED_MAP_SIZE);
  for (let index = 0; index < COMPACTED_MAP_COUNT; index++) {
    const sectorId = `compacted-terrain-${index}`;
    campaign.sectorStates[sectorId] = {
      ...template,
      sectorId,
      sourceMapId: sectorId,
      battleId: null,
      width: COMPACTED_MAP_SIZE,
      height: COMPACTED_MAP_SIZE,
      tiles: structuredClone(tiles),
    };
  }
  const envelope = parseJsonObject(encodeSave(campaign));
  assert.equal(envelope['schema'], 2);
});
