import {
  readTacticalInventory,
  readIncomingPlacement,
  writeStoredInventory,
} from './tactical-inventory-mapper.js';

export class SnapshotTransferItemRepository {
  #source;
  #destination;
  #stack;
  #extract;
  #result;

  constructor(source, destination, stack, extract) {
    this.#source = source;
    this.#destination = destination;
    this.#stack = stack;
    this.#extract = extract;
  }

  load(sourceId, destinationId) {
    return {
      source: readTacticalInventory(this.#source, sourceId),
      destination: readTacticalInventory(this.#destination, destinationId),
      placement: readIncomingPlacement(this.#stack),
    };
  }

  commit(transfer) {
    const extracted = this.#extract();
    const received = writeStoredInventory(this.#destination, transfer.destination);
    this.#result = { source: extracted.unit, target: received, stack: extracted.stack };
  }

  result() {
    if (!this.#result) {
      throw new Error('The item transfer has not committed.');
    }
    return this.#result;
  }
}
