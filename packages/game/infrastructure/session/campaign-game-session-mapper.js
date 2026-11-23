import { GameSession } from '../../domain/session/game-session.ts';
import { WorldTimeline } from '../../domain/world/world-timeline.ts';

export function sectorSessionRegistration(request) {
  return {
    id: request.id,
    sectorId: request.sceneId ?? request.sector,
    characterIds: [...request.squad, ...(request.missionAllies ?? []), ...(request.garrison ?? [])]
      .map((character) => String(character.id))
      .concat(
        (request.enemies ?? []).map(
          (character) => `visit:${request.id}:enemy:${String(character.id)}`,
        ),
      ),
  };
}

export function restoreGameSession(campaign) {
  const suspended = campaign.suspendedSectorSessions ?? [];
  const requests = [
    ...suspended.map((session) => session.request),
    ...(campaign.pendingBattle ? [campaign.pendingBattle] : []),
  ];
  return GameSession.restore({
    id: campaign.gameSessionId ?? 'unidentified-compatibility-session',
    revision: campaign.gameRevision ?? 0,
    activeSectorSessionId: campaign.pendingBattle?.id ?? null,
    suspendedSectorSessionIds: suspended.map((session) => session.request.id),
    sectorSessions: requests.map(sectorSessionRegistration),
    randomSource: { seed: campaign.seed ?? 0 },
    worldTimeline: WorldTimeline.startAt(acceptedCampaignSecond(campaign)).toSnapshot(),
  });
}

function acceptedCampaignSecond(campaign) {
  return (campaign.hour ?? 0) * 3600 + (campaign.secondOfHour ?? 0);
}

export function projectGameSession(campaign, session) {
  const snapshot = session.snapshot();
  if (
    snapshot.activeSectorSessionId !== (campaign.pendingBattle?.id ?? null) ||
    snapshot.suspendedSectorSessionIds.length !== (campaign.suspendedSectorSessions?.length ?? 0) ||
    snapshot.suspendedSectorSessionIds.some(
      (id) => !campaign.suspendedSectorSessions.some((record) => record.request.id === id),
    )
  ) {
    throw new Error('Las visitas abiertas no corresponden a la partida.');
  }
  if (campaign.gameSessionId) {
    campaign.gameSessionId = snapshot.id;
  }
  campaign.gameRevision = snapshot.revision;
  const acceptedSecond = session.timeline.currentSecond;
  campaign.hour = Math.floor(acceptedSecond / 3600);
  const secondOfHour = acceptedSecond % 3600;
  if (secondOfHour) {
    campaign.secondOfHour = secondOfHour;
  } else {
    delete campaign.secondOfHour;
  }
}
