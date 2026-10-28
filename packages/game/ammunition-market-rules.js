import { validateAmmunitionMarket as validateSchema } from '../campaign-format/ammunition-market-schema.js';
import { AMMUNITION_FAMILIES } from './ammunition-families.js';
import { arrivalFacilityOptions } from './arrival-sites.js';
import { campaignSectors, campaignWorld } from './campaign-definition.js';
import { cartridgePrice } from './campaign-rules.js';

const keys = Object.keys(AMMUNITION_FAMILIES);
export const ammunitionMarketLocations = (context) =>
  campaignSectors(context).filter((s) => arrivalFacilityOptions(s.id, context).length > 0);
export const AMMUNITION_MARKET_LOCATIONS = ammunitionMarketLocations();
export const DEFAULT_AMMUNITION_MARKET = Object.freeze({
  enabled: false,
  automaticPurchase: false,
  restockHours: 24,
  families: Object.freeze(
    Object.fromEntries(
      keys.map((key) => {
        const n = AMMUNITION_FAMILIES[key].legacyTypes.length;
        return [
          key,
          Object.freeze({ initial: 60 * n, capacity: 60 * n, replenish: 6 * n, price: null }),
        ];
      }),
    ),
  ),
});
export const ammunitionMarketRules = (s, at) => {
  const authored = s?.contentCampaign?.package.ammunitionMarket;
  return authored?.locations?.[at] ?? authored?.defaults ?? DEFAULT_AMMUNITION_MARKET;
};
export const ammunitionUnitPrice = (s, at, key) =>
  ammunitionMarketRules(s, at).families[key]?.price ?? cartridgePrice(s);
export function validateAmmunitionMarket(value, context = null) {
  return validateSchema(value, { world: campaignWorld(context) });
}
