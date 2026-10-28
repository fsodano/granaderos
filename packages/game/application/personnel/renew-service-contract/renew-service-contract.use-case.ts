import { ServiceRenewalService } from '../../../domain/personnel/service-renewal-service.ts';
import { DomainRefusal, DomainRefusalCode } from '../../../domain/shared/domain-refusal.ts';
import type { RenewServiceContractRequest } from './renew-service-contract.request.ts';
import type { RenewServiceContractResponse } from './renew-service-contract.response.ts';
import type { RenewServiceContractRepository } from './renew-service-contract.repository.ts';

export class RenewServiceContractUseCase {
  readonly #repository: RenewServiceContractRepository;
  readonly #renewal: ServiceRenewalService;

  constructor(repository: RenewServiceContractRepository, renewal = new ServiceRenewalService()) {
    this.#repository = repository;
    this.#renewal = renewal;
  }

  execute(request: RenewServiceContractRequest): RenewServiceContractResponse {
    if (!request.characterId || !request.term)
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    const context = this.#repository.load(request);
    const contract = this.#renewal.renew(context);
    this.#repository.commit(context, contract);
    return {
      characterId: contract.characterId,
      paidPesos: contract.payment.pesos,
      expiresAtSeconds: contract.expiresAt!.seconds,
    };
  }
}
