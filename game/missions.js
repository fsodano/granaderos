// Compatibility exports point to the installed default campaign. Runtime
// callers must pass their campaign so generic packages receive no stock scenes.
export {MISSION_SCENES,YATASTO_NPCS} from '../campaigns/granaderos/missions.js';
export {missionScenesFor,sceneAnchorFor,isCampaignScene} from './campaign-scenario.js';
import {scenarioFor} from './campaign-scenario.js';
export const missionContacts=s=>scenarioFor(s).missions.missionContacts(s);
export const missionStatus=(s,id)=>scenarioFor(s).missions.missionStatus(s,id);
export const talkMission=(s,id,supplied)=>scenarioFor(s).missions.talkMission(s,id,supplied);
export const sanLorenzoAlly=s=>scenarioFor(s).missions.sanLorenzoAlly(s);
export const validateMissions=s=>scenarioFor(s).missions.validateMissions(s);
