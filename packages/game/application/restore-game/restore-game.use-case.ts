import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import type { RestoreGameRepository } from './restore-game.repository.ts';
import type { RestoreGameResponse } from './restore-game.response.ts';

export class RestoreGameUseCase<TGame> {
  readonly #repository: RestoreGameRepository<TGame>;

  constructor(repository: RestoreGameRepository<TGame>) {
    this.#repository = repository;
  }

  execute(): RestoreGameResponse<TGame> {
    const text = this.#repository.read();
    if (!text) {
      throw new DomainRefusal(DomainRefusalCode.SavedGameUnavailable);
    }
    return this.#repository.restore(text);
  }
}
