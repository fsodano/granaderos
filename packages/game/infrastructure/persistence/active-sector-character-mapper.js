import { Character } from '../../domain/personnel/character.ts';
import { CampaignCharacterAbilitiesMapper } from '../personnel/campaign-character-abilities-mapper.js';

export class ActiveSectorCharacterMapper {
  #campaign;
  #personnel;
  #identities;
  #abilities;

  constructor(campaign, personnel, identities) {
    this.#campaign = campaign;
    this.#personnel = personnel;
    this.#identities = identities;
    this.#abilities = new CampaignCharacterAbilitiesMapper(campaign);
  }

  restore(unit, sectorId) {
    const id = String(unit.operativeId ?? unit.id);
    if (this.#campaign.operativeState[id]) {
      return this.#personnel.character(id);
    }
    return this.#identities.obtain('Character', id, () =>
      Character.restore({
        id,
        health: unit.hp,
        maximumHealth: unit.maxHp,
        alive: unit.hp > 0,
        bleeding: unit.bleeding,
        bandaged: unit.bandaged,
        captured: Boolean(unit.captured),
        locationId: sectorId,
        abilities: this.#abilities.read(unit).toSnapshot(),
      }),
    );
  }
}
