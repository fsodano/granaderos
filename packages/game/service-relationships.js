export {
  SERVICE_REFUSAL_LIMIT,
  SERVICE_REFUSAL_REASON_LIMIT,
  PREFERRED_COMPANION_LIMIT,
  validateServiceRefusals,
  validatePreferredCompanions,
} from '../campaign-format/character-relationships-schema.js';
import { OPERATIVES } from './data.js';
import { CIVIC_RECRUITS } from './civic-recruits.js';
import {
  characterForOperative,
  legacyOperativeId,
  operativeIdForCharacter,
} from './content-character-ids.ts';

export const PREFERRED_COMPANION_MORALE = 3;

// Preferences belong to definitions, not changing morale or a rolled event.
// An older pinned package without this field remains neutral.
/** @returns {import("./public/personnel-query-types.ts").ServiceRefusal[]} */
export function serviceRelationships(state, operative) {
  const content = state?.contentCampaign?.package;
  const definition = content
    ? Array.isArray(content.characters)
      ? characterForOperative(state, operative.id)
      : null
    : operative;
  return (definition?.serviceRefusals ?? []).map((preference) => {
    const rivalId = content
      ? operativeIdForCharacter(content, preference.character)
      : legacyOperativeId(preference.character);
    const rival = content
      ? content.characters.find((c) => c.id === preference.character)
      : [...OPERATIVES, ...CIVIC_RECRUITS].find((o) => o.id === rivalId);
    return { ...preference, rivalId, rivalName: rival?.name ?? preference.character };
  });
}

/** @returns {Array<{character:string,reason:string,companionId:number|undefined,companionName:string}>} */
export function preferredCompanions(state, operative) {
  if (!operative) {
    return [];
  }
  const content = state?.contentCampaign?.package;
  const definition = content
    ? Array.isArray(content.characters)
      ? characterForOperative(state, operative.id)
      : null
    : operative;
  return (definition?.preferredCompanions ?? []).map((preference) => {
    const companionId = content
      ? operativeIdForCharacter(content, preference.character)
      : legacyOperativeId(preference.character);
    const companion = content
      ? content.characters.find((c) => c.id === preference.character)
      : [...OPERATIVES, ...CIVIC_RECRUITS].find((o) => o.id === companionId);
    return { ...preference, companionId, companionName: companion?.name ?? preference.character };
  });
}

export function serviceRelationshipRefusal(state, operative) {
  if (!operative) {
    return null;
  }
  const now = (state?.hour ?? 0) * 3600 + (state?.secondOfHour ?? 0);
  for (const relationship of serviceRelationships(state, operative)) {
    const id = relationship.rivalId,
      record = state?.operativeState?.[id],
      contract = state?.contracts?.[id];
    if (
      !state?.recruited?.includes(id) ||
      !record?.alive ||
      record.hp <= 0 ||
      record.captured ||
      !contract
    ) {
      continue;
    }
    const expiry =
      contract.expiresAt == null ? null : contract.expiresAt * 3600 + (contract.expiresSecond ?? 0);
    if (expiry !== null && expiry <= now) {
      continue;
    }
    return {
      ...relationship,
      reason: `${operative.name} no acepta contratarse ni renovar mientras ${relationship.rivalName} siga en servicio. ${relationship.reason}`,
    };
  }
  return null;
}
