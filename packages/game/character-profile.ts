import type {
  CampaignOfficerProfile,
  CampaignOperative,
  OfficerAttribute,
} from './public/campaign-types.ts';
import type { CampaignContext } from './public/compatibility-types.ts';
import { campaignDefinitions } from './campaign-definition.js';
export const PROFILE_ATTRIBUTES: { id: OfficerAttribute; name: string }[] = [
  { id: 'maxHp', name: 'Salud' },
  { id: 'agility', name: 'Agilidad' },
  { id: 'dexterity', name: 'Destreza' },
  { id: 'strength', name: 'Fuerza' },
  { id: 'leadership', name: 'Liderazgo' },
  { id: 'wisdom', name: 'Sabiduría' },
  { id: 'marksmanship', name: 'Puntería' },
  { id: 'mechanical', name: 'Mecánica' },
  { id: 'explosives', name: 'Pólvora y artillería' },
  { id: 'medical', name: 'Medicina' },
];

import {
  campaignCharacterPortrait,
  campaignCharacterPortraits,
  NEUTRAL_CHARACTER_PORTRAIT,
} from './campaign-portraits.js';
import { campaignOfficerCreation, officerCreationWeapon } from './campaign-officer-creation.ts';
import { weaponMetadata } from './weapon-definition.ts';
import { canonicalSpriteAppearance } from './sprite-appearances.ts';
import { CRITICAL_HEALTH } from './actor-condition.js';
export {
  CHARACTER_PORTRAITS,
  SELECTABLE_CHARACTER_PORTRAITS,
  PORTRAIT_GENDERS,
  PORTRAIT_ROLES,
  PORTRAIT_SKIN_TONES,
  PORTRAITS_PER_COMBINATION,
} from './character-portraits.js';
export const PROFILE_POINTS = 550;
export const MIN_OFFICER_HEALTH = CRITICAL_HEALTH;
export const CHARACTER_CLASSES = structuredClone(campaignOfficerCreation().classes).map((c) => ({
  ...c,
  weapon: officerCreationWeapon(c.weapon)?.template ?? 0,
  blade: officerCreationWeapon(c.blade)?.template,
}));
export const PROFILE_QUESTIONS = structuredClone(campaignOfficerCreation().questions);
export const defaultProfile = (context: CampaignContext = null): CampaignOfficerProfile => {
  const creation = campaignOfficerCreation(context),
    portraits = campaignCharacterPortraits(context),
    portrait =
      portraits.find((p) => p.id === creation.defaults.portraitId) ??
      portraits.find((p) => p.selectable !== false) ??
      portraits[0] ??
      NEUTRAL_CHARACTER_PORTRAIT;
  const defaultClass =
    creation.classes.find((c) => c.id === creation.defaults.classId) ?? creation.classes[0];
  if (!defaultClass) {
    throw Error('La campaña debe definir una clase de personaje.');
  }
  return {
    version: 2,
    classId: defaultClass.id,
    portraitId: portrait.id,
    attributes: {
      maxHp: 55,
      agility: 55,
      dexterity: 55,
      strength: 55,
      leadership: 55,
      wisdom: 55,
      marksmanship: 55,
      mechanical: 55,
      explosives: 55,
      medical: 55,
    },
  };
};
// Apply this only to new commissions. Earlier valid profiles remain unchanged
// when the roster or a saved campaign reconstructs their officer.
export function validateOfficerCreationHealth(profile: CampaignOfficerProfile | undefined): void {
  if (
    profile?.version === 2 &&
    (!Number.isInteger(profile.attributes?.maxHp) || profile.attributes.maxHp < MIN_OFFICER_HEALTH)
  ) {
    throw Error(
      `La salud inicial debe tener al menos ${MIN_OFFICER_HEALTH} puntos para que tu personaje esté consciente.`,
    );
  }
}
export function applyCharacterProfile(
  op: CampaignOperative,
  answers: Readonly<Record<string, string>>,
  profile: CampaignOfficerProfile | undefined,
  context: CampaignContext = null,
): CampaignOperative {
  if (profile === undefined) {
    return op;
  }
  if (
    profile?.nickname !== undefined &&
    (typeof profile.nickname !== 'string' ||
      profile.nickname.length > 16 ||
      /[<>]/u.test(profile.nickname) ||
      Array.from(profile.nickname).some((character) => character.charCodeAt(0) < 32))
  ) {
    throw Error('El apodo debe tener hasta 16 caracteres, sin símbolos de marcado.');
  }
  const creation = campaignOfficerCreation(context),
    cls = creation.classes.find((c) => c.id === profile?.classId),
    portrait = campaignCharacterPortrait(profile?.portraitId, context);
  if (profile?.version !== 2 || !cls || !portrait) {
    throw Error('Elegí una clase y un retrato válidos.');
  }
  if (creation.questions.some((q) => !q.choices.some((c) => c.id === answers?.[q.id]))) {
    throw Error('Completá el cuestionario personal.');
  }
  if (
    !profile.attributes ||
    Object.keys(profile.attributes).length !== PROFILE_ATTRIBUTES.length ||
    PROFILE_ATTRIBUTES.some(
      (a) =>
        !Number.isInteger(profile.attributes[a.id]) ||
        profile.attributes[a.id] < 0 ||
        profile.attributes[a.id] > 85,
    ) ||
    Object.values(profile.attributes).reduce((a, b) => a + b, 0) !== PROFILE_POINTS
  ) {
    throw Error('Distribuí exactamente 550 puntos: cada atributo debe quedar entre 0 y 85.');
  }
  const weapon = officerCreationWeapon(cls.weapon, context),
    blade = officerCreationWeapon(cls.blade, context),
    content = campaignDefinitions(context),
    skinTone = portrait.spriteSkinTone ?? portrait.skinTone,
    spriteAppearance = canonicalSpriteAppearance(portrait.spriteAppearance);
  return {
    ...op,
    ...profile.attributes,
    ...(profile.nickname?.trim() || op.nickname
      ? { nickname: profile.nickname?.trim() || op.nickname || '' }
      : {}),
    hp: profile.attributes.maxHp,
    role: cls.name,
    classId: cls.id,
    weapon: weapon?.template ?? 0,
    ...(blade ? { blade: blade.template } : {}),
    ...(weapon && content?.weapons ? { weaponMetadata: weaponMetadata(weapon) } : {}),
    ...(blade && content?.weapons ? { bladeMetadata: weaponMetadata(blade) } : {}),
    profileRegistry: creation.registry,
    portrait: portrait.src,
    portraitId: profile.portraitId,
    ...(spriteAppearance ? { spriteAppearance } : {}),
    ...(skinTone === 'light' || skinTone === 'brown' || skinTone === 'dark' ? { skinTone } : {}),
    monthlyPay: 0,
    weeklyPay: 0,
    ...(answers['temperament'] === undefined ? {} : { personality: answers['temperament'] }),
    ridingSkill: answers['specialty'] === 'rider' ? 80 : answers['origin'] === 'estancia' ? 55 : 20,
    ...(answers['origin'] === undefined ? {} : { origin: answers['origin'] }),
    ...(answers['crisis'] === undefined ? {} : { crisisResponse: answers['crisis'] }),
    traits: [
      ...(answers['doctrine'] ? [answers['doctrine']] : []),
      ...(answers['origin'] === 'workshop'
        ? ['workshop_training']
        : answers['origin'] === 'cabildo'
          ? ['teacher']
          : []),
      ...(answers['crisis'] === 'rescue'
        ? ['field_rescuer']
        : answers['crisis'] === 'rally'
          ? ['steadfast']
          : ['guerrilla_tactician']),
      ...(answers['specialty'] === 'night'
        ? ['night_vision']
        : answers['specialty'] === 'teacher'
          ? ['teacher']
          : answers['specialty'] === 'ambidextrous'
            ? ['ambidextrous']
            : ['expert_rider']),
    ],
    biography: creation.biography,
  };
}
