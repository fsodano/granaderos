export type CreateGameSessionRequest<TDefinition> = Readonly<{
  seed: number;
  definition: TDefinition;
}>;
