import { Inventory } from './inventory.ts';
import type { IncomingPlacement } from './inventory.ts';
import { InventoryRefusal, InventoryRefusalCode } from './item.ts';
import type { ItemSnapshot } from './item.ts';

export type ItemTransfer = Readonly<{
  source: Inventory;
  destination: Inventory;
  item: ItemSnapshot;
}>;

export class ItemTransferService {
  prepare(
    source: Inventory,
    destination: Inventory,
    selectionId: string,
    quantity: number,
    placement: IncomingPlacement,
    expectedSource?: string,
  ): ItemTransfer {
    if (source.custodianId === destination.custodianId) {
      throw new InventoryRefusal(InventoryRefusalCode.SameCustodian);
    }
    const sourceCopy = new Inventory(source.toSnapshot());
    const destinationCopy = new Inventory(destination.toSnapshot());
    const item = sourceCopy.take(selectionId, quantity, expectedSource);
    destinationCopy.receive(item, placement);
    return { source: sourceCopy, destination: destinationCopy, item: item.toSnapshot() };
  }
}
