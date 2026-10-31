import type { CampaignContext } from './public/compatibility-types.ts';
import type { MerchantPolicies } from '../campaign-format/types.ts';
import { campaignDefinitions } from './campaign-definition.js';
import { DEFAULT_WORLD } from '../../content/campaigns/default.js';

const neutral: MerchantPolicies = Object.freeze({
  preferences: Object.freeze({}),
  legacyAmmunitionLimits: Object.freeze({}),
  defaultLegacyAmmunitionLimit: 60,
});
export function merchantPolicies(context: CampaignContext = null): MerchantPolicies {
  const content = campaignDefinitions(context);
  return (
    content?.world?.merchantPolicies ??
    (content?.scenario === 'generic-v1' || content?.campaignStory
      ? neutral
      : (DEFAULT_WORLD.merchantPolicies ?? neutral))
  );
}
export function merchantProfile(sector: string, context: CampaignContext = null) {
  const p = merchantPolicies(context).preferences[sector];
  return p ? { name: p.name, description: p.description } : null;
}
// Period-game rates are campaign data. The core applies the selected fraction
// to each physical item's price and condition without opening a public shop.
export function merchantBuyingTerms(
  sector: string,
  item: string | number,
  context: CampaignContext = null,
) {
  const profile = merchantPolicies(context).preferences[sector],
    preferred = Boolean(profile?.preferredItems.some((id) => String(id) === String(item))),
    percent = preferred && profile ? profile.preferredPercent : (profile?.buyPercent ?? 40);
  return { percent, fraction: percent / 100, preferred };
}
export function merchantWeaponRefusal(
  sector: string,
  instance: { condition: number },
  context: CampaignContext = null,
) {
  const profile = merchantPolicies(context).preferences[sector];
  return profile && instance.condition < profile.minimumWeaponCondition
    ? profile.weaponRefusal
    : null;
}
export function legacyMerchantAmmunitionLimit(context: CampaignContext, sector: string) {
  const policy = merchantPolicies(context);
  return policy.legacyAmmunitionLimits[sector] ?? policy.defaultLegacyAmmunitionLimit;
}

export { validateMerchantPolicies } from '../campaign-format/merchant-policy-schema.js';
