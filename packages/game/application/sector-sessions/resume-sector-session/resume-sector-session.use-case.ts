import { DomainRefusal, DomainRefusalCode } from '../../../domain/shared/domain-refusal.ts';
import type { ResumeSectorSessionRequest } from './resume-sector-session.request.ts';
import type { ResumeSectorSessionResponse } from './resume-sector-session.response.ts';
import type { ResumeSectorSessionRepository } from './resume-sector-session.repository.ts';

export class ResumeSectorSessionUseCase {
  readonly #repository: ResumeSectorSessionRepository;

  constructor(repository: ResumeSectorSessionRepository) {
    this.#repository = repository;
  }

  execute(request: ResumeSectorSessionRequest): ResumeSectorSessionResponse {
    if (!request.sectorSessionId) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const { game, registration } = this.#repository.load(request.sectorSessionId);
    game.activateSectorSession(registration);
    this.#repository.commit(game);
    return { activeSectorSessionId: registration.id };
  }
}
