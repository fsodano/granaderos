import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { hiringPriceMultiplier } from '../packages/game/economy-balance.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
// Long campaign routes verify combat, custody, paid recovery and history. Their
// declared army fund and midnight clock cover staged support squads at the
// current hiring prices and preserve the route's authored timetable.
// Stock-budget opening acceptance tests keep the ordinary 3,200-peso package.
export const ROUTE_STARTING_TREASURY = 32000;
export function fundedRouteContent() {
  const content = defaultContentPackage();
  present(content.rules).startingTreasury = ROUTE_STARTING_TREASURY;
  present(content.rules).startingHour = 0;
  return content;
}

export const routeHiringCeiling = (state: CampaignSnapshot, previousPrice: number) =>
  previousPrice * hiringPriceMultiplier(state);
