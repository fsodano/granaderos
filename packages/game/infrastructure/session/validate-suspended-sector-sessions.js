import { restoreGameSession } from './campaign-game-session-mapper.js';

export function validateSuspendedSectorSessions(campaign, activeSnapshot, restorePair) {
  const suspended = campaign.suspendedSectorSessions;
  if (suspended === undefined) return;
  if (!Array.isArray(suspended) || suspended.length > 8) {
    throw new Error('Las visitas suspendidas no son válidas.');
  }
  const now = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
  for (const record of suspended) {
    const squad = campaign.squads.find((group) => group.id === record?.activeSquadId);
    if (
      !record?.request ||
      !record.snapshot ||
      !squad ||
      !Number.isSafeInteger(record.suspendedAtSeconds) ||
      record.suspendedAtSeconds < 0 ||
      record.suspendedAtSeconds > now ||
      record.location !== squad.location ||
      record.snapshot.battleId !== record.request.id ||
      record.snapshot.startSeconds + record.snapshot.elapsedSeconds !== now
    ) {
      throw new Error('La visita suspendida no corresponde a su escuadra o a su reloj.');
    }
  }
  restoreGameSession(campaign);
  const current =
    campaign.pendingBattle && activeSnapshot
      ? {
          request: campaign.pendingBattle,
          snapshot: activeSnapshot,
          activeSquadId: campaign.activeSquadId,
          location: campaign.location,
          suspendedAtSeconds: now,
        }
      : null;
  for (const record of suspended) {
    const squad = campaign.squads.find((group) => group.id === record.activeSquadId);
    const view = {
      ...campaign,
      pendingBattle: record.request,
      activeSquadId: record.activeSquadId,
      squad: [...squad.members],
      location: record.location,
      suspendedSectorSessions: [
        ...suspended.filter((other) => other !== record),
        ...(current ? [current] : []),
      ],
    };
    const validated = restorePair(view, record.snapshot);
    record.request = validated.campaign.pendingBattle;
    record.snapshot = validated.battle;
  }
}
