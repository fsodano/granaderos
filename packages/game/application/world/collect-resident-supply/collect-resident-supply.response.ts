import type { ResidentSupplyKind } from '../../../domain/world/resident-supplies.ts';

export type CollectResidentSupplyResult = Readonly<{
  collected: null | { itemId: string; groundId: string; kind: ResidentSupplyKind };
}>;
