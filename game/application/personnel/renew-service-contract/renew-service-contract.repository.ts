import type { ServiceRenewalContext } from '../../../domain/personnel/service-renewal-service.ts';
import type { ServiceContract } from '../../../domain/personnel/service-contract.ts';
import type { RenewServiceContractRequest } from './renew-service-contract.request.ts';

export interface RenewServiceContractRepository {
  load(request: RenewServiceContractRequest): ServiceRenewalContext;
  commit(context: ServiceRenewalContext, contract: ServiceContract): void;
}
