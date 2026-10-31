import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { order, visit, tactical, leave, saved } from './local-contract-fixture.ts';

// Move a declared, finite carried reserve into actual local ground custody.
// This does not buy items, add quantities or replace an opening route.
export function stageFiniteDressings(state:CampaignSnapshot, donorId:number, count:number) {
  let pair = visit(state);
  pair = tactical(pair, { type: 'drop', unitId: String(donorId), item: 'medkits', count });
  return saved({ campaign: leave(pair) }).campaign;
}
export function collectFiniteDressings(state:CampaignSnapshot, operativeId:number, count:number) {
  const model = sectorInventoryModel(state, state.location, rosterFor(state), operativeId);
  const row = model.entries.find(
    (row) => row.reachable && equipmentReceipt(row.expected).item === 'medkits' && row.count >= count,
  );
  assert.ok(row, 'the declared local dressing reserve remains reachable');
  return order(state, {
    type: 'sectorInventory',
    sector: state.location,
    operativeId,
    direction: 'take',
    sourceKey: row.key,
    expected: row.expected,
    count,
  });
}
