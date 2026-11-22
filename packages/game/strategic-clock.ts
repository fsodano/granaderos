import type { CampaignSnapshot } from './public/campaign-types.ts';
import { gameSecondsFromCampaignClock } from './domain/shared/game-time.ts';
// Speeds are simulated seconds per real second. The clock starts paused.
export const STRATEGIC_CLOCK_SPEEDS = Object.freeze([60, 300, 900, 3600]);
export const campaignSeconds = (s: Pick<CampaignSnapshot, 'hour' | 'secondOfHour'>) =>
  gameSecondsFromCampaignClock(s);
