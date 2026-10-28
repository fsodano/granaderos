import type { GetSaveStatusRepository, SaveStatus } from './get-save-status.repository.ts';

export class GetSaveStatusUseCase {
  readonly #repository: GetSaveStatusRepository;

  constructor(repository: GetSaveStatusRepository) {
    this.#repository = repository;
  }

  execute(): SaveStatus {
    return this.#repository.read();
  }
}
