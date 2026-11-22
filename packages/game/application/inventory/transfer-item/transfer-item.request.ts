export type TransferItemRequest = Readonly<{
  sourceId: string;
  destinationId: string;
  selectionId: string;
  quantity: number;
  expectedSource?: string;
}>;
