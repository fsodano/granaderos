import {scenarioFor} from './campaign-scenario.js';
export const missionAssaultSquads=s=>scenarioFor(s).assault.missionAssaultSquads(s);
export const missionAssaultManifest=(s,ids)=>scenarioFor(s).assault.missionAssaultManifest(s,ids);
