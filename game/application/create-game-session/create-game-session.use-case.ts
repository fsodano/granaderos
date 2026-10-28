import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import type {
  CreateGameSessionRepository,
  CreateGameSessionRequest,
} from './create-game-session.repository.ts';

export class CreateGameSessionUseCase<TDefinition, TGame> {
  readonly #repository: CreateGameSessionRepository<TDefinition, TGame>;

  constructor(repository: CreateGameSessionRepository<TDefinition, TGame>) {
    this.#repository = repository;
  }

  execute(request: CreateGameSessionRequest<TDefinition>): TGame {
    if (!Number.isSafeInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
      throw new DomainRefusal(DomainRefusalCode.InvalidGameSeed);
    }
    return this.#repository.create(request);
  }
}
