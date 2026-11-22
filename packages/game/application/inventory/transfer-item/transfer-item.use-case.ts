import { ItemTransferService } from '../../../domain/inventory/item-transfer-service.ts';
import type { TransferItemRepository } from './transfer-item.repository.ts';
import type { TransferItemRequest } from './transfer-item.request.ts';
import type { TransferItemResponse } from './transfer-item.response.ts';

export class TransferItemUseCase {
  #repository: TransferItemRepository;
  #transfers: ItemTransferService;

  constructor(repository: TransferItemRepository, transfers = new ItemTransferService()) {
    this.#repository = repository;
    this.#transfers = transfers;
  }

  execute(request: TransferItemRequest): TransferItemResponse {
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
