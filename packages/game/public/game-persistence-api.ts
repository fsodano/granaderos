import type { CampaignContent } from '../../campaign-format/types.ts';
import type { CampaignSnapshot } from './campaign-types.ts';
import type { BattleSnapshot } from './compatibility-types.ts';
import type { RestoredGame } from '../infrastructure/persistence/game-snapshot-mapper.js';
import { CreateGameSessionUseCase } from '../application/create-game-session/create-game-session.use-case.ts';
import { RestoreGameUseCase } from '../application/restore-game/restore-game.use-case.ts';
import { CampaignCreateGameSessionRepository } from '../infrastructure/persistence/create-game-session.repository.js';
import { SerializedRestoreGameRepository } from '../infrastructure/persistence/restore-game.repository.js';

export function createNewGameSession(
  seed: number,
  definition: CampaignContent | null = null,
): CampaignSnapshot {
  const repository = new CampaignCreateGameSessionRepository();
  return new CreateGameSessionUseCase<CampaignContent | null, CampaignSnapshot>(repository).execute(
    { seed, definition },
  );
}

export function restoreGameSession(text: string): RestoredGame {
  const repository = new SerializedRestoreGameRepository(text);
  return new RestoreGameUseCase<RestoredGame>(repository).execute();
}

export function restoreGameSnapshot(text: string): {
  campaign: CampaignSnapshot;
  battle: BattleSnapshot | null;
} {
  return restoreGameSession(text).snapshot();
}
