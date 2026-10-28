export type GameSaveIdentity = Readonly<{ sessionId: string; revision: number; requestId: string }>;

export interface SaveGameRepository {
  current(): GameSaveIdentity;
  serialize(): string;
  persist(text: string, identity: GameSaveIdentity): void;
}
