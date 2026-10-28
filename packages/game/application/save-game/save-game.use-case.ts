import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import type { GameSaveIdentity, SaveGameRepository } from './save-game.repository.ts';

export class SaveGameUseCase {
  readonly #repository: SaveGameRepository;

  constructor(repository: SaveGameRepository) {
    this.#repository = repository;
  }

  execute(request: GameSaveIdentity): GameSaveIdentity {
    const current = this.#repository.current();
    if (
      !request.sessionId ||
      !request.requestId ||
      !Number.isSafeInteger(request.revision) ||
      request.revision < 0 ||
      current.sessionId !== request.sessionId ||
      current.revision !== request.revision ||
      current.requestId !== request.requestId
    ) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    const text = this.#repository.serialize();
    this.#repository.persist(text, current);
    return current;
  }
}
