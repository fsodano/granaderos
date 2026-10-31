import { restoreGameSession, sectorSessionRegistration } from './campaign-game-session-mapper.js';

export class CampaignSectorSessionCoordinator {
  #campaign;

  constructor(campaign) {
    this.#campaign = campaign;
  }

  suspendActive(snapshot) {
    const campaign = this.#campaign;
    const request = campaign.pendingBattle;
    if (
      !request ||
      !snapshot ||
      snapshot.battleId !== request.id ||
      snapshot.elapsedSeconds !== snapshot.syncedSeconds ||
      snapshot.syncedSeconds !== (request.syncedSeconds ?? 0)
    ) {
      throw new Error('La visita debe estar sincronizada antes de cambiar de sector.');
    }
    const suspended = campaign.suspendedSectorSessions ?? [];
    if (suspended.some((record) => record.request.id === request.id)) {
      throw new Error('La visita ya está suspendida.');
    }
    const savedRequest = structuredClone(request);
    delete savedRequest.resumeSnapshot;
    campaign.suspendedSectorSessions = [
      ...suspended,
      {
        request: savedRequest,
        snapshot: structuredClone(snapshot),
        activeSquadId: campaign.activeSquadId,
        location: campaign.location,
        suspendedAtSeconds: campaign.hour * 3600 + (campaign.secondOfHour ?? 0),
      },
    ];
    campaign.pendingBattle = null;
  }

  assertCanActivate(request) {
    const game = restoreGameSession(this.#campaign);
    game.activateSectorSession(sectorSessionRegistration(request));
  }

  resume(sectorSessionId) {
    const campaign = this.#campaign;
    const suspended = campaign.suspendedSectorSessions ?? [];
    const record = suspended.find((session) => session.request.id === sectorSessionId);
    if (!record) {
      throw new Error('La visita suspendida no existe.');
    }
    const now = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
    const snapshot = structuredClone(record.snapshot);
    const elapsed = now - snapshot.startSeconds;
    if (!Number.isSafeInteger(elapsed) || elapsed < snapshot.elapsedSeconds) {
      throw new Error('El reloj de la visita suspendida no es válido.');
    }
    snapshot.elapsedSeconds = elapsed;
    snapshot.syncedSeconds = elapsed;
    snapshot.savedHour = campaign.hour;
    snapshot.savedSecond = campaign.secondOfHour ?? 0;
    delete snapshot.worldTimeLimitSecond;
    campaign.pendingBattle = {
      ...record.request,
      syncedSeconds: elapsed,
      resumeSnapshot: snapshot,
    };
    campaign.suspendedSectorSessions = suspended.filter((session) => session !== record);
    campaign.activeSquadId = record.activeSquadId;
    campaign.location = record.location;
    const squad = campaign.squads.find((group) => group.id === record.activeSquadId);
    if (!squad) {
      throw new Error('Falta la escuadra de la visita suspendida.');
    }
    campaign.squad = [...squad.members];
  }
}
