import { validateCampaignPresentation as validatePresentationSchema } from '../campaign-format/presentation-schema.js';
import { canonicalSpriteAppearance } from './sprite-appearances.js';
import { validateOfficerCreation } from './campaign-officer-creation.js';
import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
import { operativeIdForCharacter } from './content-character-ids.js';

export function validateCampaignPresentation(value, content) {
  const errors = validatePresentationSchema(value, content);
  if (errors.length || value === undefined) return errors;
  for (const portrait of value.characterPortraits ?? []) {
    if (
      portrait.spriteAppearance !== undefined &&
      !canonicalSpriteAppearance(portrait.spriteAppearance)
    )
      errors.push(`Presentación de campaña: rostro inválido o repetido: ${portrait.id}.`);
  }
  errors.push(...validateOfficerCreation(value.officerCreation, content));
  const defaultPortrait = value.officerCreation?.defaults?.portraitId;
  const usesHistoricalPortraits =
    value.characterPortraits === undefined &&
    content?.scenario !== 'generic-v1' &&
    !content?.campaignStory;
  if (
    defaultPortrait !== undefined &&
    defaultPortrait !== null &&
    usesHistoricalPortraits &&
    !DEFAULT_CATALOGUE.characterPortraits.some(
      (portrait) => portrait.id === defaultPortrait && portrait.selectable !== false,
    )
  )
    errors.push('Presentación de campaña: el rostro inicial no está disponible en esta campaña.');
  if (
    value.skirmish &&
    Array.isArray(content?.characters) &&
    content.characters.every((character) => character && typeof character.id === 'string')
  ) {
    const operativeIds = new Set(
      content.characters.map((character) => operativeIdForCharacter(content, character.id)),
    );
    if (!value.skirmish.operativeIds.every((id) => operativeIds.has(id)))
      errors.push('Presentación de campaña: combate de muestra inválido.');
  }
  return errors;
}
