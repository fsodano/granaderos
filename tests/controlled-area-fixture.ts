import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
// Explicit established-territory fixture for subsystem tests, never a fresh
// campaign acceptance path. This changes no money, personnel or battle result.
export function secureArea(state: CampaignSnapshot, ...sectors: string[]): CampaignSnapshot {
  for (const id of sectors) {
    Object.assign(present(state.sectors[id]), { owner: 'patriot', loyalty: 65 });
  }
  return state;
}
