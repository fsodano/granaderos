export { validStartingCondition } from '../campaign-format/character-start-schema.js';
// Authored condition is assigned once. Saves retain the mutable physical state.
/** @param {import("../campaign-format/types.ts").CharacterDefinition} character @returns {import("../campaign-format/types.ts").CharacterCondition} */
export function startingCharacterCondition(character) {
  return {
    hp: character.attributes.maxHp,
    energy: 100,
    fatigue: 0,
    bleeding: 0,
    bandaged: 0,
    ...character.startingCondition,
  };
}
