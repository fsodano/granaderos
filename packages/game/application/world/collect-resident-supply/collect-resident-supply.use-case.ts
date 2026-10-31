import { ScavengingPolicy } from '../../../domain/world/resident-supplies.ts';
import type { ResidentSupplyKind } from '../../../domain/world/resident-supplies.ts';
import type { CollectResidentSupplyRepository } from './collect-resident-supply.repository.ts';

export type CollectResidentSupplyRequest = Readonly<{ characterId: string }>;
export type CollectResidentSupplyResult = Readonly<{
  collected: null | { itemId: string; groundId: string; kind: ResidentSupplyKind };
}>;

export class CollectResidentSupplyUseCase {
  #repository: CollectResidentSupplyRepository;
  #policy: ScavengingPolicy;

  constructor(repository: CollectResidentSupplyRepository, policy = new ScavengingPolicy()) {
    this.#repository = repository;
    this.#policy = policy;
  }

  execute(request: CollectResidentSupplyRequest): CollectResidentSupplyResult {
    const context = this.#repository.load(request.characterId);
    const supply = this.#policy.selectSupply(context.resident, context.groundSupplies);
    if (!supply) {
      return { collected: null };
    }
    const custody = supply.transferOneTo(context.resident);
    this.#repository.commit(context);
    return { collected: { itemId: custody.itemId, groundId: supply.id, kind: supply.kind } };
  }
}
