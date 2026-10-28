export function openSectorEntryRequests(campaign) {
  return [
    ...(campaign.pendingBattle ? [campaign.pendingBattle] : []),
    ...(campaign.suspendedSectorSessions ?? []).map((session) => session.request),
  ];
}

export function isCharacterDeployed(campaign, characterId) {
  return openSectorEntryRequests(campaign).some((request) =>
    request.squad.some((character) => String(character.id) === String(characterId)),
  );
}

export function suspendedSectorSessionFor(campaign, sectorId) {
  return (campaign.suspendedSectorSessions ?? []).find(
    (session) => (session.request.sceneId ?? session.request.sector) === sectorId,
  );
}
