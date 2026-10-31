import type { GetVisibleCharactersRepository } from './get-visible-characters.repository.ts';

export type GetVisibleCharactersResponse = Readonly<{ characterIds: readonly string[] }>;

export class GetVisibleCharactersUseCase {
  readonly #repository: GetVisibleCharactersRepository;

  constructor(repository: GetVisibleCharactersRepository) {
    this.#repository = repository;
  }

  execute(): GetVisibleCharactersResponse {
    const characterIds = new Set<string>();
    for (const character of this.#repository.inspect()) {
      if (character.visible) {
        characterIds.add(character.characterId);
      }
    }
    return { characterIds: [...characterIds] };
  }
}
