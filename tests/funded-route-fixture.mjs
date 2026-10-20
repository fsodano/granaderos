import {hiringPriceMultiplier} from '../game/economy-balance.js';
import {defaultContentPackage} from '../game/content-package.js';
// Long campaign routes verify combat, custody, paid recovery and history. Their
// declared army fund and midnight clock cover staged support squads at the
// current hiring prices and preserve the route's authored timetable.
// Stock-budget opening acceptance tests keep the ordinary 3,200-peso package.
export const ROUTE_STARTING_TREASURY=32000;
export function fundedRouteContent(){const content=defaultContentPackage();content.rules.startingTreasury=ROUTE_STARTING_TREASURY;content.rules.startingHour=0;return content;}

export const routeHiringCeiling=(state,previousPrice)=>previousPrice*hiringPriceMultiplier(state);
