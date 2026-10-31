import type { CampaignOperative, CampaignOperativeState } from './public/campaign-types.ts';
import { initializeUnitAmmunition } from './tactical-ammunition.js';

export function carriedAmmunition(
  op: CampaignOperative,
  record: CampaignOperativeState | undefined,
) {
  const unit = {
    ...op,
    ...record,
    inventory: structuredClone(record?.inventory ?? {}),
    loaded: record?.carriedLoaded ?? 0,
    ammo: record?.ammo ?? 0,
    ...(record?.carriedReloadProgress ? { reloadProgress: record.carriedReloadProgress } : {}),
  };
  initializeUnitAmmunition(unit, { defaultCount: 0 });
  return unit;
}
