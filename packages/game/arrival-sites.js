import { validateArrivalSites as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateArrivalSites(sites, context = null) {
  return validateSchema(sites, { world: campaignWorld(context) });
}
import { campaignWorld, campaignSectors } from './campaign-definition.js';
import { DEFAULT_CONTENT } from '../../content/campaigns/default.js';

export const ARRIVAL_FACILITIES = Object.freeze({
  post: 'Posta',
  barracks: 'Cuartel',
  port: 'Puerto',
  landing: 'Embarcadero',
});
export function arrivalFacilityOptions(sector, context = null) {
  const world = campaignWorld(context);
  return world.arrivalFacilities?.[sector] ?? [];
}
export function defaultArrivalSites() {
  return structuredClone(DEFAULT_CONTENT.arrivalSites);
}
const BASELINE = Object.freeze(
  defaultArrivalSites().map((s) =>
    Object.freeze({ ...s, facilities: Object.freeze(s.facilities) }),
  ),
);
export function arrivalSitesFor(state) {
  return state.contentCampaign?.package.arrivalSites ?? BASELINE;
}
export function arrivalSiteLabel(site) {
  return site.facilities.map((f) => ARRIVAL_FACILITIES[f]).join(' · ');
}
