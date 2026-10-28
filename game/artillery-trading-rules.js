import {
  validateArtilleryTradingRules as validateSchema,
  ARTILLERY_TRADING_FIELDS,
} from '../campaign-format/campaign-location-schema.js';
export { ARTILLERY_TRADING_FIELDS } from '../campaign-format/campaign-location-schema.js';
export function validateArtilleryTradingRules(value, context = null) {
  return validateSchema(value, { world: campaignWorld(context) });
}
import { campaignSectors, campaignWorld } from './campaign-definition.js';
import { DEFAULT_WORLD } from '../campaigns/default.js';
export const DEFAULT_ARTILLERY_TRADING = Object.freeze(DEFAULT_WORLD.artilleryTrading);
const genericDefaults = Object.freeze({
  enabled: true,
  initialCash: 1200,
  buyPercent: 40,
  resalePercent: 80,
  buyingOverrides: Object.freeze({}),
});

export const artilleryTradingRules = (s) =>
  s?.contentCampaign?.package.artilleryTrading ??
  campaignWorld(s).artilleryTrading ??
  genericDefaults;
export const artilleryBuyingPercent = (s) =>
  artilleryTradingRules(s).buyingOverrides[s.location] ?? artilleryTradingRules(s).buyPercent;
