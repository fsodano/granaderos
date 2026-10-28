import {
  CharacterAbilities,
  type CharacterRatingName,
} from '../../domain/personnel/character-abilities.ts';

export type CharacterAbilityDefinition = Readonly<
  {
    id: number;
    traits?: readonly string[];
    abilities?: readonly string[];
    genericCharacter?: boolean;
  } & Partial<Record<CharacterRatingName, number>>
>;

export class CampaignCharacterAbilitiesMapper {
  constructor(campaign: unknown);
  read(
    character: CharacterAbilityDefinition,
    participant?: Partial<Record<CharacterRatingName, number>>,
  ): CharacterAbilities;
}
