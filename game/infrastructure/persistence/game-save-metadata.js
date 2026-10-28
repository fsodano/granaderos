export const GameMappingVersion = 1;

export function gameSaveMetadata(campaign) {
  if (campaign.gameSessionId === undefined) return undefined;
  const metadata = {
    version: GameMappingVersion,
    sessionId: campaign.gameSessionId,
    revision: campaign.gameRevision ?? 0,
  };
  validateGameSaveMetadata(metadata, campaign);
  return metadata;
}

export function validateGameSaveMetadata(metadata, campaign) {
  if (metadata === undefined) {
    if (campaign?.gameSessionId !== undefined)
      throw new Error('Falta la versión del modelo de partida.');
    return;
  }
  if (metadata === null || metadata.version !== GameMappingVersion) {
    throw new Error('Esta versión del modelo de partida no es compatible.');
  }
  if (
    typeof metadata.sessionId !== 'string' ||
    !metadata.sessionId.trim() ||
    !Number.isSafeInteger(metadata.revision) ||
    metadata.revision < 0 ||
    metadata.sessionId !== campaign?.gameSessionId ||
    metadata.revision !== (campaign?.gameRevision ?? 0)
  ) {
    throw new Error('La identidad o la revisión de la partida guardada no coincide.');
  }
}
