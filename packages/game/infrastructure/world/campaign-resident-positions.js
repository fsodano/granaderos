import { openSectorEntryRequests } from '../session/campaign-session-access.js';
import { MAX_TACTICAL_LEVEL, surfaceAt } from '../../tactical-space.js';
import { sceneAnchorFor } from '../../campaign-scenario.js';

const characterPosition = (reference) => ({
  x: reference.position.x,
  y: reference.position.y,
  tacticalLevel: reference.position.level,
});

/** @typedef {{characterId: string, position: {x: number, y: number, level: number}}} ResidentPositionReference */

/** @returns {ResidentPositionReference[]} */
export function residentPositionsFor(campaign, field) {
  const sectorId = field.sectorId ?? field.sector;
  if (!sectorId) return [];
  const sceneId = field.sceneId ?? null;
  const location = sceneAnchorFor(campaign, sectorId);
  const participating = new Set([
    ...(field.units?.filter((actor) => actor.side === 'player') ?? field.squad ?? []).map((actor) =>
      String(actor.id),
    ),
    ...openSectorEntryRequests(campaign).flatMap((request) =>
      [...(request.squad ?? []), ...(request.missionAllies ?? []), ...(request.garrison ?? [])].map(
        (character) => String(character.id),
      ),
    ),
  ]);
  const travelling = new Set(
    (campaign.squads ?? []).filter((squad) => squad.journey).flatMap((squad) => squad.members),
  );
  return (campaign.recruited ?? []).flatMap((id) => {
    const character = campaign.operativeState[id];
    if (
      participating.has(String(id)) ||
      travelling.has(id) ||
      !character?.alive ||
      character.captured ||
      character.hp <= 0 ||
      character.location !== location ||
      character.residentSector !== sectorId ||
      (character.residentScene ?? null) !== sceneId ||
      !character.residentPosition
    )
      return [];
    const point = character.residentPosition;
    return [
      {
        characterId: `character:${id}`,
        position: { x: point.x, y: point.y, level: point.tacticalLevel ?? 0 },
      },
    ];
  });
}

export function residentPositionPoints(field) {
  return (field.residentPositions ?? []).map(characterPosition);
}

export function refreshResidentPositions(campaign, field) {
  const positions = residentPositionsFor(campaign, field);
  if (positions.length) field.residentPositions = positions;
  else delete field.residentPositions;
}

export function refreshCampaignResidentPositions(campaign) {
  for (const request of openSectorEntryRequests(campaign)) {
    refreshResidentPositions(campaign, request);
    if (request.resumeSnapshot) refreshResidentPositions(campaign, request.resumeSnapshot);
  }
  for (const session of campaign.suspendedSectorSessions ?? []) {
    refreshResidentPositions(campaign, session.snapshot);
  }
}

export function validateResidentPositions(field) {
  if (!field || field.residentPositions === undefined) return;
  if (!Array.isArray(field.residentPositions)) throw new Error('Invalid resident positions.');
  const identities = new Set();
  for (const reference of field.residentPositions) {
    const { characterId, position } = reference ?? {};
    if (
      typeof characterId !== 'string' ||
      !/^character:\d+$/.test(characterId) ||
      identities.has(characterId) ||
      !position ||
      Object.keys(reference).some((key) => !['characterId', 'position'].includes(key)) ||
      Object.keys(position).some((key) => !['x', 'y', 'level'].includes(key)) ||
      ![position.x, position.y, position.level].every(Number.isSafeInteger) ||
      position.x < 0 ||
      position.y < 0 ||
      position.level < 0 ||
      position.level > MAX_TACTICAL_LEVEL ||
      !surfaceAt(field, characterPosition(reference))
    )
      throw new Error('Invalid resident position reference.');
    identities.add(characterId);
  }
}

export function validateResidentPositionContext(
  campaign,
  field,
  { allowLegacyOmission = false } = {},
) {
  if (field.residentPositions === undefined && allowLegacyOmission) return;
  validateResidentPositions(field);
  const expected = residentPositionsFor(campaign, field);
  const actualPositions = field.residentPositions ?? [];
  if (
    actualPositions.length !== expected.length ||
    expected.some(
      (reference) =>
        !actualPositions.some(
          (actual) =>
            actual.characterId === reference.characterId &&
            ['x', 'y', 'level'].every((key) => actual.position?.[key] === reference.position[key]),
        ),
    )
  )
    throw new Error('Resident positions do not match the campaign.');
}
