import type { GroundSupply, ResidentSupplies } from '../../../domain/world/resident-supplies.ts';

export type CollectResidentSupplyContext = Readonly<{
  resident: ResidentSupplies;
  groundSupplies: readonly GroundSupply[];
}>;

export interface CollectResidentSupplyRepository {
  load(characterId: string): CollectResidentSupplyContext;
  commit(context: CollectResidentSupplyContext): void;
}
