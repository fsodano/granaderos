import type { CampaignArtillery, CampaignSnapshot } from './public/campaign-types.ts';

export function localArtilleryDepot(state: CampaignSnapshot): CampaignArtillery[] {
  return state.sectors[state.location]?.owner === 'patriot'
    ? (state.artilleryDepots?.[state.location] ?? [])
    : [];
}
export function depotSelection(gun: Pick<CampaignArtillery, 'id'>): string {
  return `depot:${gun.id}`;
}
