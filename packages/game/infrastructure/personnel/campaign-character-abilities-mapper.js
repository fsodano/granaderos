import { CharacterAbilities, CharacterRating } from '../../domain/personnel/character-abilities.ts';
import { rosterFor } from '../../recruitment.js';
import { legacyCharacterAbilities } from '../../character-abilities.js';

export class CampaignCharacterAbilitiesMapper {
  #campaign;
  #definitions;

  constructor(campaign) {
    this.#campaign = campaign;
    this.#definitions = new Map(rosterFor(campaign).map((character) => [character.id, character]));
  }

  read(character, participant) {
    const definition = this.#definitions.get(character.id) ?? character;
    const record = this.#campaign.operativeState?.[character.id] ?? {};
    const ratings = Object.fromEntries(
      Object.values(CharacterRating).map((name) => [name, definition[name] ?? 0]),
    );
    const traits = definition.traits ?? [];
    const capabilities =
      definition.abilities ??
      (definition.genericCharacter ? [] : legacyCharacterAbilities(definition.id));
    const training = Object.fromEntries(
      Object.values(CharacterRating).flatMap((name) =>
        record.trainedStats?.[name] === undefined ? [] : [[name, record.trainedStats[name]]],
      ),
    );
    const abilities = new CharacterAbilities({ ratings, traits, capabilities }).withTraining(
      training,
      record.strength,
    );
    if (!participant) return abilities;
    const snapshot = abilities.toSnapshot();
    for (const name of Object.values(CharacterRating)) {
      if (participant[name] !== undefined) snapshot.ratings[name] = participant[name];
    }
    return new CharacterAbilities(snapshot);
  }
}
