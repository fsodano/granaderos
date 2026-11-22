import type { TalkToCharacterRequest } from '../../../packages/game/application/talk-to-character/talk-to-character.request.ts';
import type { TalkToCharacterResponse } from '../../../packages/game/application/talk-to-character/talk-to-character.response.ts';
import { TalkToCharacterUseCase } from '../../../packages/game/application/talk-to-character/talk-to-character.use-case.ts';
import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import { CampaignTalkToCharacterRepository } from '../../../packages/game/infrastructure/session/talk-to-character-repository.ts';

/** Run one conversation and return the accepted campaign and sector session. */
export function talkToCharacter(
  campaign: CampaignSnapshot,
  sectorSession: BattleSnapshot,
  request: TalkToCharacterRequest,
): TalkToCharacterResponse<CampaignSnapshot, BattleSnapshot> {
  const repository = new CampaignTalkToCharacterRepository(campaign, sectorSession);
  return new TalkToCharacterUseCase<CampaignSnapshot, BattleSnapshot>(repository).execute(request);
}
