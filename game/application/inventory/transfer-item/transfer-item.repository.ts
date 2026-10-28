import type { Inventory, IncomingPlacement } from '../../../domain/inventory/inventory.ts';
import type { ItemTransfer } from '../../../domain/inventory/item-transfer-service.ts';

export type TransferItemContext = Readonly<{
  source: Inventory;
  destination: Inventory;
  placement: IncomingPlacement;
}>;
export interface TransferItemRepository {
  load(sourceId: string, destinationId: string, selectionId: string): TransferItemContext;
  commit(transfer: ItemTransfer): void;
}
