import type { TalkToCharacterRequest } from './talk-to-character.request.ts';
import type { TalkToCharacterResponse } from './talk-to-character.response.ts';

export interface TalkToCharacterRepository<TCampaign, TSectorSession> {
  resolve(request: TalkToCharacterRequest): void;
  projectParticipants(): void;
  commit(): TalkToCharacterResponse<TCampaign, TSectorSession>;
}
