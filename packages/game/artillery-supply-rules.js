import {
  ARTILLERY_SUPPLY_FIELDS,
  validateArtillerySupply,
} from '../campaign-format/campaign-rules-schema.js';
export {
  ARTILLERY_SUPPLY_FIELDS,
  validateArtillerySupply,
} from '../campaign-format/campaign-rules-schema.js';
// Optional campaign data keeps older content identities unchanged. These prices
// and the reserve limit are Granaderos tuning, not historical market values.
export const DEFAULT_ARTILLERY_SUPPLY = Object.freeze({
  enabled: true,
  bronze4: 20,
  field8: 30,
  swivel: 10,
  reserveLimit: 6,
});

export const artillerySupplyRules = (s) =>
  s?.contentCampaign?.package.artillerySupply ?? DEFAULT_ARTILLERY_SUPPLY;
