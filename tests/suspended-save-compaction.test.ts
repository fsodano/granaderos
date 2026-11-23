import type {
  CampaignSectorEntryRequest,
  CampaignSnapshot,
} from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot, BattleTile } from '../packages/game/public/compatibility-types.ts';
import { isJsonObject, parseJsonObject } from '../packages/campaign-format/json-value.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { saveByteLength } from '../packages/game/save-limits.js';

const LARGE_MAP_SIZE = 100;

function largeTerrain(size: number): BattleTile[] {
  return Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: Math.floor(index / size),
    type: 'floor',
    blocked: false,
    cover: 0,
    blocksSight: false,
    buildingId: 'quinta',
    roomId: 'patio',
  }));
}

function suspendedOnLargeMap(): {
  campaign: CampaignSnapshot;
  request: CampaignSectorEntryRequest;
  snapshot: BattleSnapshot;
  record: {
    request: CampaignSectorEntryRequest;
    snapshot: BattleSnapshot;
    activeSquadId: string;
    location: string;
    suspendedAtSeconds: number;
  };
} {
  let campaign = dispatchCampaign(initialCampaign(12), {
    type: 'recruitCombatant',
    id: 110,
    term: 'week',
  });
  assert.equal(campaign.lastError, null);
  campaign = dispatchCampaign(campaign, { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  const prepared = prepareCampaignBattle(campaign);
  assert.equal(prepared.error, null);
  const request = structuredClone(present(prepared.campaign.sectorEntryRequest));
  delete request.resumeSnapshot;
  const snapshot = structuredClone(present(prepared.battle));
  snapshot.width = LARGE_MAP_SIZE;
  snapshot.height = LARGE_MAP_SIZE;
  snapshot.tiles = largeTerrain(LARGE_MAP_SIZE);
  const record = {
    request,
    snapshot,
    activeSquadId: prepared.campaign.activeSquadId,
    location: prepared.campaign.location,
    suspendedAtSeconds: prepared.campaign.hour * 3600 + (prepared.campaign.secondOfHour ?? 0),
  };
  prepared.campaign.sectorEntryRequest = null;
  prepared.campaign.suspendedSectorSessions = [record];
  return { campaign: prepared.campaign, request, snapshot, record };
}

void test('a suspended visit on a large map saves smaller and restores exactly', () => {
  const { campaign, request, snapshot, record: originalRecord } = suspendedOnLargeMap();
  const uncompactedBytes = saveByteLength(JSON.stringify(campaign));
  const encoded = encodeSave(campaign);
  const compactedBytes = saveByteLength(encoded);
  assert.ok(
    compactedBytes * 2 < uncompactedBytes,
    `esperaba ${compactedBytes} < ${uncompactedBytes}`,
  );
  const envelope = parseJsonObject(encoded);
  assert.equal(envelope['schema'], 2);
  const savedCampaign = envelope['campaign'];
  assert.ok(isJsonObject(savedCampaign));
  const savedSessions = savedCampaign['suspendedSectorSessions'];
  assert.ok(Array.isArray(savedSessions));
  assert.equal(savedSessions.length, 1);
  const savedSession = savedSessions[0];
  assert.ok(isJsonObject(savedSession));
  const savedSnapshot = savedSession['snapshot'];
  assert.ok(isJsonObject(savedSnapshot));
  const packed = savedSnapshot['tiles'];
  assert.ok(isJsonObject(packed));
  assert.equal(packed['encoding'], 'palette-v1');
  assert.ok(
    saveByteLength(JSON.stringify(packed)) * 4 < saveByteLength(JSON.stringify(snapshot.tiles)),
  );
  assert.deepEqual(savedSession['request'], request);

  const restored = decodeSave(encoded);
  assert.equal(restored.battle, null);
  const restoredSessions = present(restored.campaign.suspendedSectorSessions);
  assert.equal(restoredSessions.length, 1);
  const restoredRecord = present(restoredSessions[0]);
  assert.deepEqual(restoredRecord.request, originalRecord.request);
  assert.equal(restoredRecord.snapshot.width, LARGE_MAP_SIZE);
  assert.equal(restoredRecord.snapshot.height, LARGE_MAP_SIZE);
  assert.deepEqual(restoredRecord.snapshot.tiles, originalRecord.snapshot.tiles);
  assert.deepEqual(restoredRecord.snapshot.units, originalRecord.snapshot.units);
  assert.equal(restoredRecord.snapshot.turn, originalRecord.snapshot.turn);
  assert.equal(restoredRecord.snapshot.phase, originalRecord.snapshot.phase);
  assert.equal(restoredRecord.snapshot.battleId, originalRecord.snapshot.battleId);
  assert.equal(restoredRecord.snapshot.sectorId, originalRecord.snapshot.sectorId);
  assert.equal(restoredRecord.snapshot.sourceMapId, originalRecord.snapshot.sourceMapId);
});
