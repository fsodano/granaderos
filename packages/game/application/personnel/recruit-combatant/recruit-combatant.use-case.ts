import { RecruitmentService } from '../../../domain/personnel/recruitment-service.ts';
import { DomainRefusal, DomainRefusalCode } from '../../../domain/shared/domain-refusal.ts';
import type { RecruitCombatantRepository } from './recruit-combatant.repository.ts';
import type { RecruitCombatantRequest } from './recruit-combatant.request.ts';
import type { RecruitCombatantResponse } from './recruit-combatant.response.ts';

export class RecruitCombatantUseCase {
  readonly #repository: RecruitCombatantRepository;
  readonly #recruitment: RecruitmentService;

  constructor(repository: RecruitCombatantRepository, recruitment = new RecruitmentService()) {
    this.#repository = repository;
    this.#recruitment = recruitment;
  }

  execute(request: RecruitCombatantRequest): RecruitCombatantResponse {
    if (!request.characterId || !request.term) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const context = this.#repository.load(request);
    const locationId = request.locationId ?? context.allowedLocations[0];
    if (!locationId) {
      throw new DomainRefusal(DomainRefusalCode.InvalidPlacement);
    }
    const outcome = this.#recruitment.recruit(context, locationId);
    this.#repository.commit(context, outcome);
    return {
      characterId: outcome.characterId,
      locationId: outcome.locationId,
      assignment: outcome.assignment,
      paidPesos: outcome.paid.pesos,
      serviceEndsAtSeconds: outcome.contract.expiresAt?.seconds ?? null,
    };
  }
}
