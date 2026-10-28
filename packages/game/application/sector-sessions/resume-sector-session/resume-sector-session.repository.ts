import type {
  GameSession,
  SectorSessionRegistration,
} from '../../../domain/session/game-session.ts';

export interface ResumeSectorSessionRepository {
  load(
    sectorSessionId: string,
  ): Readonly<{ game: GameSession; registration: SectorSessionRegistration }>;
  commit(game: GameSession): void;
}
