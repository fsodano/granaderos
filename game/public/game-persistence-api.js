import { CreateGameSessionUseCase } from '../application/create-game-session/create-game-session.use-case.ts';
import { RestoreGameUseCase } from '../application/restore-game/restore-game.use-case.ts';
import { CampaignCreateGameSessionRepository } from '../infrastructure/persistence/create-game-session.repository.js';
import { SerializedRestoreGameRepository } from '../infrastructure/persistence/restore-game.repository.js';

export function createNewGameSession(seed, definition) {
  const repository = new CampaignCreateGameSessionRepository();
  return new CreateGameSessionUseCase(repository).execute({ seed, definition });
}

export function restoreGameSession(text) {
  const repository = new SerializedRestoreGameRepository(text);
  return new RestoreGameUseCase(repository).execute();
}

export function restoreGameSnapshot(text) {
  return restoreGameSession(text).snapshot();
}
