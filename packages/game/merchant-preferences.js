import { DEFAULT_WORLD } from '../../content/campaigns/default.js';

const definitions = (value) => value?.contentCampaign?.package ?? value?.campaignPackage ?? value;
const neutral = Object.freeze({
  preferences: Object.freeze({}),
  legacyAmmunitionLimits: Object.freeze({}),
  defaultLegacyAmmunitionLimit: 60,
});
export function merchantPolicies(context = null) {
  const content = definitions(context);
  return (
    content?.world?.merchantPolicies ??
    (content?.scenario === 'generic-v1' || content?.campaignStory
      ? neutral
      : (DEFAULT_WORLD.merchantPolicies ?? neutral))
  );
}
export function merchantProfile(sector, context = null) {
  const p = merchantPolicies(context).preferences[sector];
  return p ? { name: p.name, description: p.description } : null;
}
// Period-game rates are campaign data. The core applies the selected fraction
// to each physical item's price and condition without opening a public shop.
export function merchantBuyingTerms(sector, item, context = null) {
  const profile = merchantPolicies(context).preferences[sector],
    preferred = Boolean(profile?.preferredItems.some((id) => String(id) === String(item))),
    percent = preferred ? profile.preferredPercent : (profile?.buyPercent ?? 40);
  return { percent, fraction: percent / 100, preferred };
}
export function merchantWeaponRefusal(sector, instance, context = null) {
  const profile = merchantPolicies(context).preferences[sector];
  return profile && instance.condition < profile.minimumWeaponCondition
    ? profile.weaponRefusal
    : null;
}
export function legacyMerchantAmmunitionLimit(context, sector) {
  const policy = merchantPolicies(context);
  return policy.legacyAmmunitionLimits[sector] ?? policy.defaultLegacyAmmunitionLimit;
}

export { validateMerchantPolicies } from '../campaign-format/merchant-policy-schema.js';
