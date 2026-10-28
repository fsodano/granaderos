import { ItemTransferService } from '../../../domain/inventory/item-transfer-service.ts';
import type { TransferItemRepository } from './transfer-item.repository.ts';
import type { ItemSnapshot } from '../../../domain/inventory/item.ts';

export type TransferItemRequest = Readonly<{
  sourceId: string;
  destinationId: string;
  selectionId: string;
  quantity: number;
  expectedSource?: string;
}>;

export class TransferItemUseCase {
  #repository: TransferItemRepository;
  #transfers: ItemTransferService;

  constructor(repository: TransferItemRepository, transfers = new ItemTransferService()) {
    this.#repository = repository;
    this.#transfers = transfers;
  }

  execute(request: TransferItemRequest): Readonly<{ item: ItemSnapshot }> {
    const context = this.#repository.load(
      request.sourceId,
      request.destinationId,
      request.selectionId,
    );
    const transfer = this.#transfers.prepare(
      context.source,
      context.destination,
      request.selectionId,
      request.quantity,
      context.placement,
      request.expectedSource,
    );
    this.#repository.commit(transfer);
    return { item: transfer.item };
  }
}
