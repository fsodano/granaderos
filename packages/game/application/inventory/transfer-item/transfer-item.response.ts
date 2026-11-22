import type { ItemSnapshot } from '../../../domain/inventory/item.ts';

export type TransferItemResponse = Readonly<{ item: ItemSnapshot }>;
