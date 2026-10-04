import {worldCell,campaignPlace} from './world-cells.js';
import {MISSION_SCENES} from './missions.js';

export function tacticalMinimapLabel(state){
 const seconds=Math.max(0,(state.startSeconds??0)+(state.elapsedSeconds??0));
 const minutes=Math.floor(seconds/60),hour=Math.floor(minutes/60)%24,minute=minutes%60;
 const mission=MISSION_SCENES[state.sceneId??state.missionId??state.sectorId],cell=worldCell(state.sectorId)??worldCell(mission?.anchor);
 return {sectorCode:state.sectorCode??cell?.grid??'',sectorName:state.sectorName??mission?.name??campaignPlace(state.sectorId)?.name??'Sector',day:Math.floor(seconds/86400)+1,time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};
}
