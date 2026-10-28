// Default constants remain available for older consumers. All runtime
// narrative and opposition decisions use the selected, saved campaign context.
export {ROYALIST_COMMANDS,NORTHERN_AXIS} from '../../content/campaigns/granaderos/narrative.js';
export {enemyCommandsFor} from './campaign-scenario.js';
import {scenarioFor} from './campaign-scenario.js';
export const campaignEnemyCount=s=>scenarioFor(s).narrative.campaignEnemyCount(s);
export const coastalRevenue=s=>scenarioFor(s).narrative.coastalRevenue(s);
export const royalistIntel=s=>scenarioFor(s).narrative.royalistIntel(s);
export const mentorDispatch=s=>scenarioFor(s).narrative.mentorDispatch(s);
export const oppositionFor=(request,s)=>scenarioFor(s).narrative.oppositionFor(request,s);
