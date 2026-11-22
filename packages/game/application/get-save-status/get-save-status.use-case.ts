import type { GetSaveStatusRepository } from './get-save-status.repository.ts';
import type { SaveStatus } from './get-save-status.response.ts';

export class GetSaveStatusUseCase {
  readonly #repository: GetSaveStatusRepository;

  constructor(repository: GetSaveStatusRepository) {
    this.#repository = repository;
  }

  execute(): SaveStatus {
    return this.#repository.read();
  }
}
