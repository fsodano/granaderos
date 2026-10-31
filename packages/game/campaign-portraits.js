import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
import { campaignDefinitions } from './campaign-definition.js';
import { isContentImageReference } from './campaign-assets.js';
import { SPRITE_APPEARANCES, canonicalSpriteAppearance } from './sprite-appearances.ts';

export const NEUTRAL_CHARACTER_PORTRAIT = Object.freeze({
  id: 'neutral-avatar',
  name: 'Personaje',
  src: '/portrait-placeholder.svg',
  gender: 'person',
  role: 'character',
  skinTone: 'brown',
  spriteSkinTone: 'brown',
  spriteAppearance: 'surgeon',
  selectable: true,
});

/** @returns {Array<{id:string,name:string,src:string,gender:string,role:string,skinTone:string,spriteSkinTone?:string,spriteAppearance?:string,selectable?:boolean}>} */
/** @param {import('./public/compatibility-types.ts').CampaignContext | null} [context]
 * @returns {import('../campaign-format/types.ts').PortraitDefinition[]}
 */
export function campaignCharacterPortraits(context = null) {
  const content = campaignDefinitions(context);
  if (Array.isArray(content?.presentation?.characterPortraits)) {
    return content.presentation.characterPortraits.length
      ? content.presentation.characterPortraits
      : [NEUTRAL_CHARACTER_PORTRAIT];
  }
  if (!content || (content.scenario !== 'generic-v1' && !content.campaignStory)) {
    return DEFAULT_CATALOGUE.characterPortraits;
  }
  const used = new Set(),
    portraits = [];
  for (const character of content.characters ?? []) {
    if (!isContentImageReference(character.portrait) || used.has(character.portrait)) {
      continue;
    }
    used.add(character.portrait);
    const appearance = canonicalSpriteAppearance(character.spriteAppearance) ?? 'surgeon',
      skinTone = character.skinTone ?? 'brown';
    portraits.push({
      id: `portrait-${character.id}`,
      name: character.name,
      src: character.portrait,
      gender: SPRITE_APPEARANCES[appearance]?.gender ?? 'person',
      role: 'character',
      skinTone,
      spriteSkinTone: skinTone,
      spriteAppearance: appearance,
      selectable: true,
    });
  }
  return portraits.length ? portraits : [NEUTRAL_CHARACTER_PORTRAIT];
}

/** @param {string} id @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export const campaignCharacterPortrait = (id, context = null) =>
  campaignCharacterPortraits(context).find((portrait) => portrait.id === id);
