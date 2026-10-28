import { sectorSessionRegistration } from '../session/campaign-game-session-mapper.js';
import { openSectorEntryRequests } from '../session/campaign-session-access.js';

export class RetainedSectorPresence {
  #campaign;
  #travellingCharacters;
  #visitingCharacters;
  #garrisonLocations;
  #missionAllyLocations;

  constructor(campaign) {
    this.#campaign = campaign;
    this.#travellingCharacters = new Set(
      (campaign.squads ?? [])
        .filter((squad) => squad.journey)
        .flatMap((squad) => (squad.members ?? []).map(String)),
    );
    this.#visitingCharacters = new Set(
      openSectorEntryRequests(campaign).flatMap(
        (request) => sectorSessionRegistration(request).characterIds,
      ),
    );
    this.#garrisonLocations = new Map(
      Object.entries(campaign.garrisons ?? {}).flatMap(([sectorId, characters]) =>
        characters.map((character) => [String(character.id), sectorId]),
      ),
    );
    this.#missionAllyLocations = new Map(
      Object.entries(campaign.missionAllies ?? {}).map(([sectorId, character]) => [
        String(character.id),
        sectorId,
      ]),
    );
  }

  includes(unit, field) {
    if (unit.departure || unit.fled) return false;
    if (unit.side !== 'player' || unit.hp <= 0) return true;
    const characterId = String(unit.operativeId ?? unit.id);
    if (this.#travellingCharacters.has(characterId) || this.#visitingCharacters.has(characterId))
      return false;
    if (unit.militia) return this.#garrisonLocations.get(characterId) === field.sectorId;
    const character = this.#campaign.operativeState?.[characterId];
    const location =
      character?.location ??
      character?.residentSector ??
      (unit.missionAlly ? this.#missionAllyLocations.get(characterId) : undefined);
    return !character || (character.alive && !character.captured && location === field.sectorId);
  }
}
