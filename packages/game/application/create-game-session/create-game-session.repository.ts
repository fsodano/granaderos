import type { CreateGameSessionRequest } from './create-game-session.request.ts';

export interface CreateGameSessionRepository<TDefinition, TGame> {
  create(request: CreateGameSessionRequest<TDefinition>): TGame;
}
