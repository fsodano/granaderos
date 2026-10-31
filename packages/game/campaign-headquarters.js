import { validateHeadquarters as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateHeadquarters(value, context = null) {
  return validateSchema(value, { world: campaignWorld(context) });
}
import { foundryFor } from './campaign-foundry.js';
import { scenarioFor, workshopSectorsFor } from './campaign-scenario.js';
import { campaignWorld, campaignSectors } from './campaign-definition.js';
import { arrivalFacilityOptions } from './arrival-sites.js';

/** @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export const headquartersOptions = (context) =>
  campaignSectors(context).filter((s) =>
    arrivalFacilityOptions(s.id, context).includes('barracks'),
  );
export const HEADQUARTERS_OPTIONS = Object.freeze(headquartersOptions());
export const headquartersFor = (state) =>
  state?.contentCampaign?.package.headquarters ??
  campaignWorld(state).defaultHeadquarters ??
  campaignSectors(state)[0]?.id;
export const headquartersName = (state) => {
  const place = campaignSectors(state).find((s) => s.id === headquartersFor(state));
  return place?.shortName ?? place?.name;
};

export const campaignChapters = (state) => scenarioFor(state).chapters(state);
export const hasWorkshop = (state, id) =>
  id === headquartersFor(state) ||
  workshopSectorsFor(state).includes(id) ||
  Boolean(state.flags?.foundry && id === foundryFor(state).sector);
