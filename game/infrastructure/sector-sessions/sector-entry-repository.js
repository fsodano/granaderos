import { readSectorSession, writeSectorSession } from './sector-session-mapper.js';
import { validateBattleSnapshot } from '../../validate-battle.js';

export class SnapshotEnterSectorRepository {
  #snapshot;
  #resuming;
  #revision = 0;
  #initializePerception;

  constructor(request, previous, options, buildSectorEntrySnapshot, initializePerception) {
    this.#resuming = Boolean(request.resumeSnapshot);
    this.#snapshot = this.#resuming
      ? structuredClone(request.resumeSnapshot)
      : buildSectorEntrySnapshot(request, previous, options);
    if (this.#resuming) validateBattleSnapshot(this.#snapshot, request);
    if (this.#snapshot.sectorId !== request.sector)
      throw new Error('sector-entry-location-mismatch');
    this.#initializePerception = initializePerception;
  }

  loadSectorEntry() {
    const snapshot = this.#snapshot;
    return {
      request: {
        sessionId:
          snapshot.sectorSession?.id ??
          `sector:${snapshot.battleId ?? snapshot.sectorId}:${snapshot.startSeconds ?? 0}`,
        sectorId: snapshot.sectorId,
        participantIds: snapshot.units.map((unit) => String(unit.id)),
        deploymentRequired: Boolean(snapshot.deployment),
      },
      ...(this.#resuming ? { resumedSession: readSectorSession(snapshot) } : {}),
      revision: this.#revision,
    };
  }

  commitSectorEntry(session, expectedRevision) {
    if (expectedRevision !== this.#revision) throw new Error('stale-sector-entry');
    const snapshot = structuredClone(this.#snapshot);
    writeSectorSession(snapshot, session);
    const admitted =
      this.#resuming || snapshot.deployment ? snapshot : this.#initializePerception(snapshot);
    this.#revision++;
    this.#snapshot = admitted;
    return admitted;
  }
}
