// Independent of uniform, faction, equipment, posture, and health.
// Values are visual palettes, not ancestry or gameplay attributes.
export const SKIN_PALETTES = Object.freeze({
  light: Object.freeze({
    label: 'Clara',
    r: [0.06, 0.27, 0.52, 0.78, 0.98],
    g: [0.04, 0.15, 0.34, 0.58, 0.82],
    b: [0.03, 0.09, 0.22, 0.4, 0.64],
  }),
  brown: Object.freeze({
    label: 'Morena',
    r: [0.04, 0.18, 0.36, 0.57, 0.78],
    g: [0.025, 0.08, 0.19, 0.33, 0.54],
    b: [0.018, 0.04, 0.1, 0.19, 0.34],
  }),
  dark: Object.freeze({
    label: 'Oscura',
    r: [0.025, 0.08, 0.16, 0.29, 0.5],
    g: [0.018, 0.04, 0.08, 0.16, 0.32],
    b: [0.014, 0.025, 0.05, 0.1, 0.2],
  }),
});
// Existing portrait art direction for the named historical cast.
import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
const historical = DEFAULT_CATALOGUE.historicalSkinTones;
import { ROSTER_SKIN_TONES } from './sprite-skin-roster.js';
import { characterPortrait } from './character-portraits.js';
/** @returns {'light'|'brown'|'dark'} */
export function spriteSkinTone(unit) {
  const explicit = { white: 'light', black: 'dark' }[unit.skinTone] ?? unit.skinTone;
  if (Object.hasOwn(SKIN_PALETTES, explicit)) {
    return explicit;
  }
  const avatarTone =
    !unit.genericCharacter && Number(unit.id) === 1000
      ? characterPortrait(unit.portraitId)?.spriteSkinTone
      : undefined;
  if (avatarTone) {
    return avatarTone;
  }
  // Reusing a recruit's portrait also reuses that portrait's palette. Keep
  // avatar and legacy officer IDs on their existing stable fallback.
  const portraitId = Number(unit.portraitId),
    id =
      Number(unit.id) === 1000 &&
      Number.isInteger(portraitId) &&
      portraitId >= 100 &&
      portraitId <= 147
        ? portraitId
        : unit.id;
  if (!unit.genericCharacter && Object.hasOwn(historical, id)) {
    return historical[id];
  }
  if (!unit.genericCharacter && Object.hasOwn(ROSTER_SKIN_TONES, id)) {
    return ROSTER_SKIN_TONES[id];
  }
  // Stable ID selection also works for saved NPCs and enemy units. Never use RNG
  // here: drawing another frame or reloading a save cannot change a person's skin.
  let hash = 2166136261;
  for (const c of String(id ?? unit.portraitId ?? 'default')) {
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  return ['light', 'brown', 'dark'][hash % 3];
}
