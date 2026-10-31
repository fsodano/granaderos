import type {
  SectorInventoryModel,
  SectorInventoryEntry,
} from '../packages/game/public/sector-inventory-types.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
import assert from 'node:assert/strict';

export function assertRouteEquipmentDebit(
  before: Pick<SectorInventoryModel, 'entries'>,
  after: Pick<SectorInventoryModel, 'entries'>,
  source: Pick<SectorInventoryEntry, 'key' | 'expected' | 'count'>,
) {
  const selected = before.entries.find((row) => row.key === source.key);
  assert.ok(selected);
  assert.equal(selected.expected, source.expected);
  assert.equal(selected.count, source.count);
  // Exhausting a container stack reuses its array key. Compare the complete
  // current stock, with only the selected stack's real one-item debit.
  const stock = (model: Pick<SectorInventoryModel, 'entries'>, debitKey: string | null = null) =>
    model.entries
      .flatMap((row) => {
        const stack = equipmentReceipt(row.expected);
        if (row.key === debitKey) {
          stack.count--;
        }
        return stack.count > 0
          ? [
              JSON.stringify({
                kind: row.kind,
                x: row.x,
                y: row.y,
                tacticalLevel: row.tacticalLevel,
                stack,
              }),
            ]
          : [];
      })
      .sort();
  assert.deepEqual(
    stock(after),
    stock(before, source.key),
    'the selected finite item must debit once while all other stock retains its metadata, quantity and location',
  );
  return source.count - 1;
}
