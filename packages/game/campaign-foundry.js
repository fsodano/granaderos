import { validateFoundry as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateFoundry(value, context = null) {
  return validateSchema(value, { world: campaignWorld(context) });
}
import { campaignWorld, campaignSectors, campaignDefinitions } from './campaign-definition.js';
import { arrivalFacilityOptions } from './arrival-sites.js';

export const foundryLocations = (context) =>
  campaignSectors(context).filter((s) =>
    arrivalFacilityOptions(s.id, context).includes('barracks'),
  );
export const FOUNDRY_LOCATIONS = Object.freeze(foundryLocations());
export const DEFAULT_FOUNDRY = Object.freeze(campaignWorld().defaultFoundry);
export const foundryFor = (state) => {
  const content = campaignDefinitions(state);
  if (content?.foundry) {
    return content.foundry;
  }
  if (content?.world?.defaultFoundry) {
    return content.world.defaultFoundry;
  }
  if (content?.scenario === 'generic-v1' || content?.campaignStory) {
    return {
      sector:
        content.headquarters ?? content.world?.defaultHeadquarters ?? campaignSectors(state)[0]?.id,
      name: 'Taller del cuartel',
      armyName: 'Fuerza de campaña',
      setupCost: 0,
      fundingCost: 0,
    };
  }
  return campaignWorld(state).defaultFoundry ?? DEFAULT_FOUNDRY;
};
export const foundryLocationName = (state) =>
  foundryLocations(state).find((s) => s.id === foundryFor(state).sector)?.name;
