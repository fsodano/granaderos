export type CreateGameSessionRequest<TDefinition> = Readonly<{
  seed: number;
  definition: TDefinition;
}>;

export interface CreateGameSessionRepository<TDefinition, TGame> {
  create(request: CreateGameSessionRequest<TDefinition>): TGame;
}
