import { validateCampaignRules } from '../campaign-format/campaign-rules-schema.js';
export { validateCampaignRules } from '../campaign-format/campaign-rules-schema.js';
// Defaults preserve campaigns created before rule authoring was available.
export const DEFAULT_CAMPAIGN_RULES = Object.freeze({
  startingTreasury: 3200,
  deploymentCartridges: 10,
  enemyCartridges: 13,
  militiaCartridges: 6,
});
export const DEFAULT_CARTRIDGE_PRICE = 1;
// Optional in content: do not add a redundant field to older package identities.
export const cartridgePrice = (state) =>
  state?.contentCampaign?.package.rules?.cartridgePrice ?? DEFAULT_CARTRIDGE_PRICE;

export const campaignRules = (state) =>
  state?.contentCampaign?.package.rules ?? DEFAULT_CAMPAIGN_RULES;
