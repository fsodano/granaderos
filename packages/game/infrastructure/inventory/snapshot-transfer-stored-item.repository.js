import { Inventory } from '../../domain/inventory/inventory.ts';
import {
  readTacticalInventory,
  readTransferredItem,
  readIncomingPlacement,
  writeStoredInventory,
} from './tactical-inventory-mapper.js';

export class SnapshotTransferStoredItemRepository {
  #stack;
  #destination;
  #result;

  constructor(stack, destination) {
    this.#stack = stack;
    this.#destination = destination;
  }

  load(sourceId, destinationId) {
    const placement = readIncomingPlacement(this.#stack);
    return {
      source: new Inventory({
        custodianId: sourceId,
        unlimitedCapacity: true,
        entries: [
          {
            selectionId: 'stored-item',
            item: readTransferredItem(this.#stack).toSnapshot(),
            heldQuantity: 0,
            stackLimit: placement.stackLimit,
            slotSize: placement.slotSize,
          },
        ],
      }),
      destination: readTacticalInventory(this.#destination, destinationId),
      placement,
    };
  }

  commit(transfer) {
    this.#result = {
      target: writeStoredInventory(this.#destination, transfer.destination),
      remaining: transfer.source.quantityOf('stored-item'),
      stack: { ...structuredClone(this.#stack), count: transfer.item.quantity },
    };
  }

  result() {
    if (!this.#result) throw new Error('The stored item transfer has not committed.');
    return this.#result;
  }
}
