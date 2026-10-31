import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
// Subsystem scenarios that start after the southern towns have been secured.
// This is explicit test setup, never the new-player campaign constructor.
export function secureArea(
  state: CampaignSnapshot,
  ids: string[] = ['buenos_aires', 'ensenada'],
): CampaignSnapshot {
  for (const id of ids) {
    Object.assign(present(state.sectors[id]), { owner: 'patriot', loyalty: 65 });
  }
  return state;
}
