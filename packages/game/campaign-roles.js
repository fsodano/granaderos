import { validateCampaignRoles as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateCampaignRoles(value, characters) {
  return validateSchema(value, characters);
}
import { foundryFor, foundryLocationName } from './campaign-foundry.js';
import { OPERATIVES } from './data.js';
import { campaignWorld } from './campaign-definition.js';
import { operativeIdForCharacter } from './content-character-ids.js';
import { contractExpiresSeconds } from './contracts.js';

export const ORIGINAL_CAMPAIGN_ROLES = Object.freeze(campaignWorld().defaultRoles);
export function rolesForContent(content) {
  if (content?.campaignRoles !== undefined) return content.campaignRoles;
  const defaults = content?.world?.defaultRoles;
  if (!defaults && (content?.scenario === 'generic-v1' || content?.campaignStory))
    return { foundryEngineer: null, marchCommander: null };
  return Object.fromEntries(
    Object.entries(defaults ?? ORIGINAL_CAMPAIGN_ROLES).map(([role, id]) => [
      role,
      !content || content.characters.some((c) => c.id === id) ? id : null,
    ]),
  );
}

export function campaignRole(state, key) {
  const content = state.contentCampaign?.package,
    character = rolesForContent(content)[key];
  if (!character) return null;
  const id = content ? operativeIdForCharacter(content, character) : Number(character.slice(7));
  const definition = content
    ? content.characters.find((c) => c.id === character)
    : OPERATIVES.find((c) => c.id === id);
  return definition ? { id, character, name: definition.nickname || definition.name } : null;
}
export function campaignRoleActive(state, key) {
  const role = campaignRole(state, key),
    record = role && state.operativeState[role.id],
    contract = role && state.contracts?.[role.id];
  const expiry = contractExpiresSeconds(contract),
    now = state.hour * 3600 + (state.secondOfHour ?? 0);
  return Boolean(
    role &&
    state.recruited.includes(role.id) &&
    record?.alive &&
    record.hp > 0 &&
    !record.captured &&
    !contract?.departurePending &&
    (expiry === null || expiry > now),
  );
}
export function foundryReason(state) {
  const role = campaignRole(state, 'foundryEngineer');
  if (!role) return 'Esta campaña no tiene responsable de fundición.';
  if (state.sectors[foundryFor(state).sector].owner !== 'patriot')
    return `La fundición necesita ${foundryLocationName(state)} bajo control patriota.`;
  if (!campaignRoleActive(state, 'foundryEngineer'))
    return `Incorporá a ${role.name}; debe estar con vida, libre y en servicio.`;
  return null;
}
