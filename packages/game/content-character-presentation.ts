import type { CharacterDefinition } from '../campaign-format/types.ts';
import type { CampaignOperative, CampaignSnapshot } from './public/campaign-types.ts';
import type { BattleSnapshot } from './public/compatibility-types.ts';
import { campaignDefinitions } from './campaign-definition.js';
import { OPERATIVES } from './data.js';
import { CIVIC_RECRUITS } from './civic-recruits.js';
import { characterProfile } from './characters.js';
import {
  legacyOperativeId,
  isContractCharacter,
  characterForActor,
  campaignActors,
  hasGenericCharacterIds,
  hasGenericCharacterDefinitions,
} from './content-character-ids.ts';
import { spriteAppearance, canonicalSpriteAppearance } from './sprite-appearances.ts';
import { campaignCharacterPortrait } from './campaign-portraits.js';
import { canonicalContent } from './content-identity.js';
import { validateForceAppearanceReferences } from './content-force-equipment.js';

export const SPEECH_LABELS = {
  hired: 'Al incorporarse',
  contact: 'Al detectar enemigos',
  cleared: 'Al asegurar el sector',
  wounded: 'Al recibir una herida',
  exhausted: 'Al caer por agotamiento',
  death: 'Al morir',
  ending: 'Al terminar la campaña',
  treated: 'Al recibir primeros auxilios de otra persona',
  near: 'Al pasar un disparo cerca sin herirlo',
  interrupt: 'Al poder actuar en una interrupción',
};
export { SPEECH_LINE_LIMIT } from '../campaign-format/character-presentation-schema.js';
export const APPEARANCE_LABELS = {
  granadero: 'Uniforme de granadero',
  royalist: 'Uniforme realista',
  worker: 'Trabajador',
  surgeon: 'Civil',
  gaucho: 'Poncho',
  friar: 'Fraile',
  'woman-scout': 'Combatiente',
  'woman-shawl': 'Civil con mantón',
};

// Effective editor values also support drafts written before these fields existed.
/** @param {import("../campaign-format/types.ts").CharacterDefinition} character @param {import("./public/compatibility-types.ts").CampaignContext} [context] @returns {{personality:string,speech:Record<string,string>,spriteAppearance:string,skinTone?:string}} */
export function characterPresentationDefaults(
  character: import('../campaign-format/types.ts').CharacterDefinition,
  context: import('./public/compatibility-types.ts').CampaignContext | undefined,
): {
  personality: string;
  speech: Record<string, string>;
  spriteAppearance: string;
  skinTone?: string;
} {
  const content = campaignDefinitions(context);
  const id = hasGenericCharacterDefinitions(content) ? undefined : legacyOperativeId(character.id);
  const original: CampaignOperative | undefined = [...OPERATIVES, ...CIVIC_RECRUITS].find(
    (o) => o.id === id,
  );
  const operative = {
    ...original,
    id: id ?? 2000,
    contentId: character.id,
    biography: character.biography,
    recruitmentSource: isContractCharacter(character) ? 'contract' : 'encounter',
    traits: character.traits ?? original?.traits ?? [],
    genericCharacter: hasGenericCharacterDefinitions(content),
  };
  const profile = characterProfile(operative);
  return {
    personality: character.personality ?? profile.personality,
    speech: character.speech ?? profile.speech,
    spriteAppearance: character.spriteAppearance ?? spriteAppearance(operative),
    ...(character.skinTone === undefined ? {} : { skinTone: character.skinTone }),
  };
}

// Only explicitly authored fields are attached to runtime actors. This keeps
// older packages and their existing saved actors compatible.
export function authoredPresentation(character: CharacterDefinition) {
  const profile = {
    ...(character.personality === undefined ? {} : { personality: character.personality }),
    ...(character.speech === undefined ? {} : { speech: { ...character.speech } }),
  };
  return {
    ...(Object.keys(profile).length ? { storyProfile: profile } : {}),
    ...(character.spriteAppearance === undefined
      ? {}
      : { spriteAppearance: character.spriteAppearance }),
    ...(character.skinTone === undefined ? {} : { skinTone: character.skinTone }),
  };
}

export function validatePresentationReferences(
  state: CampaignSnapshot,
  value: CampaignSnapshot | BattleSnapshot = state,
): void {
  validateForceAppearanceReferences(state, value);
  const need = (condition: boolean) => {
    if (!condition) {
      throw Error('La voz o apariencia guardada no coincide con el personaje de la campaña.');
    }
  };
  for (const actor of campaignActors(value)) {
    if (!state.contentCampaign) {
      need(actor.storyProfile === undefined);
      continue;
    }
    if (
      Number(
        ('operativeId' in actor ? actor.operativeId : undefined) ??
          ('detention' in actor ? actor.detention?.operativeId : undefined) ??
          actor.id,
      ) === 1000 &&
      state.officer?.profile &&
      (hasGenericCharacterIds(state.contentCampaign.package) ||
        state.contentCampaign.package.campaignStory)
    ) {
      const portrait = campaignCharacterPortrait(state.officer.profile.portraitId, state);
      if (!portrait) {
        throw new Error('No existe el retrato del oficial.');
      }
      need(actor.portraitId === portrait.id && actor.portrait === portrait.src);
      need(
        (actor.spriteAppearance ?? null) ===
          (canonicalSpriteAppearance(portrait.spriteAppearance) ?? null),
      );
      need((actor.skinTone ?? null) === (portrait.spriteSkinTone ?? portrait.skinTone ?? null));
    }
    const definition = characterForActor(state, actor);
    if (!definition) {
      need(actor.storyProfile === undefined);
      continue;
    }
    if (actor.contentId !== undefined) {
      need(actor.contentId === definition.id);
    }
    const expected = authoredPresentation(definition);
    for (const field of ['storyProfile', 'spriteAppearance', 'skinTone'] as const) {
      need(canonicalContent(actor[field] ?? null) === canonicalContent(expected[field] ?? null));
    }
  }
}
