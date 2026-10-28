import { SquadFormationService } from '../../../domain/personnel/squad-formation-service.ts';
import type { FormSquadRequest } from './form-squad.request.ts';
import type { FormSquadResponse } from './form-squad.response.ts';
import type { FormSquadRepository } from './form-squad.repository.ts';
export class FormSquadUseCase {
  readonly #repository: FormSquadRepository;
  constructor(repository: FormSquadRepository) {
    this.#repository = repository;
  }
  execute(request: FormSquadRequest): FormSquadResponse {
    const context = this.#repository.load(request);
    const formation = new SquadFormationService().form(
      context.squads,
      context.target,
      request.characterIds,
      context.candidates,
    );
    this.#repository.commit(formation);
    return {
      squadId: formation.target.id,
      characterIds: formation.target.memberIds,
      locationId: formation.target.locationId,
    };
  }
}
