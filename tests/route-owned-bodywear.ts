import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { EquipmentItem } from '../packages/game/public/compatibility-types.ts';
import type {
  CarriedEquipment,
  SectorInventoryEntry,
} from '../packages/game/public/sector-inventory-types.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
import { present } from './assert-present.ts';
export type RouteBodywearEvent = {
  event: 'routeFiniteBodywearRecovered';
  id: number;
  sector: string;
  slot: 'headwear' | 'outfit' | 'legwear';
  sourceKey: string | null;
  record: EquipmentItem;
};
type BodywearOptions = { report?: (event: RouteBodywearEvent) => void };
type UsableBodywear = CarriedEquipment & { inventoryKey: string; expected: string };
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { operativeLocation } from '../packages/game/squads.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';

// Complete missing worn protection from the person's real pockets or known
// local loot. Each ordinary pickup/equip keeps the complete physical record.
export function recoverRouteBodywear(
  start: CampaignSnapshot,
  ids: readonly number[],
  { report = () => {} }: BodywearOptions = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const before = structuredClone(start);
  for (const id of ids) {
    for (const slot of ['headwear', 'outfit', 'legwear'] as const) {
      if ((present(c.operativeState[id])[slot]?.condition ?? 0) > 0) {
        continue;
      }
      const sector = operativeLocation(c, id),
        model = () => sectorInventoryModel(c, sector, rosterFor(c), id),
        kind = { headwear: 'hat', outfit: 'poncho', legwear: 'trousers' }[slot];
      assert.equal(model().reason, null);
      assert.equal(Number(present(model().personal).id), id);
      const matches = (record: EquipmentItem) =>
        record.kind === 'outfit' && record.outfit === kind && (record.condition ?? 0) > 0;
      const usable = (row: CarriedEquipment): row is UsableBodywear =>
        typeof row.inventoryKey === 'string' &&
        typeof row.expected === 'string' &&
        matches(equipmentReceipt(row.expected)) &&
        Boolean(row.equip?.some((choice) => choice.slot === slot && choice.valid));
      let carried = model().carried.find(usable),
        source: SectorInventoryEntry | undefined;
      const cash = c.resources.treasury,
        clock = [c.hour, c.secondOfHour];
      if (!carried) {
        source = model()
          .entries.filter((row) => row.reachable && matches(equipmentReceipt(row.expected)))
          .sort(
            (a, b) =>
              (equipmentReceipt(b.expected).condition ?? 0) -
              (equipmentReceipt(a.expected).condition ?? 0),
          )[0];
        assert.ok(source, `The actual river soldier ${id} needs finite local ${slot}.`);
        c = dispatchCampaign(c, {
          type: 'sectorInventory',
          sector,
          operativeId: id,
          direction: 'take',
          sourceKey: source.key,
          expected: source.expected,
          count: 1,
        });
        assert.equal(c.lastError, null);
        carried = model().carried.find(usable);
        assert.ok(carried);
        const { item: _item, ...record } = equipmentReceipt(source.expected);
        assert.deepEqual(equipmentReceipt(carried.expected), record);
        assert.equal(
          model().entries.find((row) => row.key === present(source).key)?.count ?? 0,
          source.count - 1,
        );
      }
      const record = equipmentReceipt(carried.expected);
      c = dispatchCampaign(c, {
        type: 'sectorInventory',
        sector,
        operativeId: id,
        direction: 'equip',
        inventoryKey: carried.inventoryKey,
        expected: carried.expected,
        slot,
      });
      assert.equal(c.lastError, null);
      assert.deepEqual(present(c.operativeState[id])[slot], record);
      assert.equal(c.resources.treasury, cash);
      assert.deepEqual([c.hour, c.secondOfHour], clock);
      report({
        event: 'routeFiniteBodywearRecovered',
        id,
        sector,
        slot,
        sourceKey: source?.key ?? null,
        record,
      });
    }
  }
  for (const [id, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(present(c.operativeState[Number(id)]).alive, false);
      assert.equal(present(c.operativeState[Number(id)]).deathMinute, r.deathMinute);
    }
  }
  assert.deepEqual(start, before);
  return decodeSave(encodeSave(c)).campaign;
}
