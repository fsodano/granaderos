import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import type { TalkToCharacterRequest } from './talk-to-character.request.ts';
import type { TalkToCharacterResponse } from './talk-to-character.response.ts';
import type { TalkToCharacterRepository } from './talk-to-character.repository.ts';

export class TalkToCharacterUseCase<TCampaign, TSectorSession> {
  readonly #repository: TalkToCharacterRepository<TCampaign, TSectorSession>;

  constructor(repository: TalkToCharacterRepository<TCampaign, TSectorSession>) {
    this.#repository = repository;
  }

  execute(request: TalkToCharacterRequest): TalkToCharacterResponse<TCampaign, TSectorSession> {
    if (
      !request.characterId ||
      !request.speakerId ||
      !request.approach ||
      Boolean(request.dialogueNodeId) !== Boolean(request.dialogueChoiceId)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#repository.resolve(request);
    this.#repository.projectParticipants();
    return this.#repository.commit();
  }
}
