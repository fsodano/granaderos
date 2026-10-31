import type { CampaignArtillery } from './public/campaign-types.ts';

export function storedArtilleryRecord(gun: CampaignArtillery): CampaignArtillery {
  return {
    id: gun.id,
    type: gun.type,
    side: gun.side,
    loaded: gun.loaded,
    ammo: gun.ammo,
    ...(gun.reloadProgress === undefined ? {} : { reloadProgress: gun.reloadProgress }),
    ...(gun.facing === undefined ? {} : { facing: gun.facing }),
  };
}
