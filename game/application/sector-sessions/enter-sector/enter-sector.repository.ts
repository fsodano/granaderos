import type { SectorSession } from '../../../domain/sector-sessions/sector-session.ts';
import type { SectorEntryRequest } from './sector-entry.request.ts';
export interface EnterSectorRepository<Snapshot> {
  loadSectorEntry(): Readonly<{
    request: SectorEntryRequest;
    resumedSession?: SectorSession;
    revision: number;
  }>;
  commitSectorEntry(session: SectorSession, expectedRevision: number): Snapshot;
}
