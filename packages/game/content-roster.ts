import type { CampaignSnapshot, CampaignOperative } from './public/campaign-types.ts';
import { authoredPresentation } from './content-character-presentation.ts';
import {
  characterForOperative,
  operativeIdForCharacter,
  legacyOperativeId,
  isContractCharacter,
  hasGenericCharacterDefinitions,
} from './content-character-ids.ts';
import { CIVIC_DEFAULTS } from './civic-recruits.js';
import { scenarioFor } from './campaign-scenario.js';
// Historical roles keep their original slots. New authored identities never
// acquire their numeric powers and need no entry in the built-in catalogue.
export function authoredOperative(
  state: CampaignSnapshot,
  operative: CampaignOperative,
): CampaignOperative {
  const definition = characterForOperative(state, operative.id);
  if (!definition) {
    return operative;
  }
  return {
    ...operative,
    ...definition.attributes,
    ...authoredPresentation(definition),
    ...(hasGenericCharacterDefinitions(state.contentCampaign?.package)
      ? { genericCharacter: true, abilities: [...(definition.abilities ?? [])] }
      : {}),
    // Do not inherit a newer default preference into an older pinned package.
    serviceRefusals: structuredClone(definition.serviceRefusals ?? []),
    preferredCompanions: structuredClone(definition.preferredCompanions ?? []),
    ...(definition.abilities === undefined ? {} : { abilities: [...definition.abilities] }),
    ...(definition.traits === undefined ? {} : { traits: definition.traits }),
    ...(definition.service === undefined ? {} : { service: definition.service }),
    ...(definition.progression === undefined ? {} : { progression: definition.progression }),
    ...(definition.ridingSkill === undefined && definition.traits === undefined
      ? {}
      : {
          ridingSkill: Math.max(
            definition.ridingSkill ?? operative.ridingSkill ?? 0,
            (definition.traits ?? operative.traits ?? []).includes('expert_rider') ? 80 : 0,
          ),
        }),
    recruitmentSource: isContractCharacter(definition) ? 'contract' : 'encounter',
    hp: definition.attributes.maxHp,
    name: definition.name,
    nickname: definition.nickname,
    role: definition.role,
    biography: definition.biography,
    monthlyPay: definition.monthlyPay,
    ...(definition.serviceGuarantee === undefined
      ? {}
      : { serviceGuarantee: definition.serviceGuarantee }),
    weeklyPay: scenarioFor(state).weeklyPayFor(state, operative, definition),
    portraitId: definition.portrait,
    portrait: definition.portrait,
    contentId: definition.id,
  };
}
/** @returns {Array<ReturnType<typeof authoredOperative>>} */
export function authoredRoster(
  state: CampaignSnapshot,
  baseline: CampaignOperative[],
): CampaignOperative[] {
  const content = state.contentCampaign?.package;
  if (!content) {
    return baseline;
  }
  return content.characters.map((c) => {
    const id = operativeIdForCharacter(content, c.id);
    if (id === undefined) {
      throw new Error('Falta la identidad del personaje de campaña.');
    }
    return authoredOperative(
      state,
      (!hasGenericCharacterDefinitions(content) &&
        baseline.find((o) => o.id === legacyOperativeId(c.id))) || {
        ...CIVIC_DEFAULTS,
        id,
        name: c.name,
        nickname: c.nickname,
        role: c.role,
        biography: c.biography,
        classId: 'soldado',
        traits: [],
        ridingSkill: 0,
        monthlyPay: c.monthlyPay,
        service: 'contract',
        progression: 'experience',
      },
    );
  });
}
