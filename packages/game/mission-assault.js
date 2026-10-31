import { scenarioFor } from './campaign-scenario.js';
/** @returns {{id:string;name:string;origin:string;members:number[];reason:string|null}[]} */
export const missionAssaultSquads = (s) => scenarioFor(s).assault.missionAssaultSquads(s);
export const missionAssaultManifest = (s, ids) =>
  scenarioFor(s).assault.missionAssaultManifest(s, ids);
