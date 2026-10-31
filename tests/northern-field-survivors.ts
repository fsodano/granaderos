import { present } from './assert-present.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
// Use the same native morale floor as the opening reserve rule. This selector
// reads readiness only; ordinary care and squad orders keep their authority.
export function northernFieldSurvivors(campaign: CampaignSnapshot, doctors: number[], clinic: string|undefined) {
  return [...new Set([1000, 114, 123, ...campaign.recruited])].filter((id) => {
    const record = campaign.operativeState[id];
    return (
      !doctors.includes(id) &&
      campaign.recruited.includes(id) &&
      present(record).alive &&
      !present(record).captured &&
      present(record).location === clinic &&
      present(record).morale >= 40
    );
  });
}
