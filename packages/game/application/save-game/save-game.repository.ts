import type { GameSaveIdentity } from './save-game.response.ts';

export interface SaveGameRepository {
  current(): GameSaveIdentity;
  serialize(): string;
  persist(text: string, identity: GameSaveIdentity): void;
}
