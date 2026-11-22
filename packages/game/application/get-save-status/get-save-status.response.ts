import type { GameSaveIdentity } from '../save-game/save-game.response.ts';

export type SaveState = 'unsaved' | 'saving' | 'saved' | 'blocked' | 'failed';
export type SaveStatus = Readonly<{
  state: SaveState;
  accepted: GameSaveIdentity | null;
  persisted: GameSaveIdentity | null;
  message: string | null;
}>;
