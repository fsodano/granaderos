import { SectorSession } from '../../../domain/sector-sessions/sector-session.ts';
import type { EnterSectorRepository } from './enter-sector.repository.ts';
export type EnterSectorResponse<Snapshot> = Readonly<{
  snapshot: Snapshot;
  sessionId: string;
  resumed: boolean;
}>;
export class EnterSectorUseCase<Snapshot> {
  readonly #repository: EnterSectorRepository<Snapshot>;
  constructor(repository: EnterSectorRepository<Snapshot>) {
    this.#repository = repository;
  }
  execute(): EnterSectorResponse<Snapshot> {
    const entry = this.#repository.loadSectorEntry();
    const request = entry.request;
    const session =
      entry.resumedSession ??
      SectorSession.enter(request.sessionId, request.sectorId, request.deploymentRequired);
    if (!entry.resumedSession && request.participantIds.length)
      session.admitParticipants(request.participantIds);
    return {
      snapshot: this.#repository.commitSectorEntry(session, entry.revision),
      sessionId: session.id,
      resumed: Boolean(entry.resumedSession),
    };
  }
}
