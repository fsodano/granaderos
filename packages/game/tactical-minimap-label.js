import {worldCell,campaignPlace} from './world-cells.js';
import {missionScenesFor} from './campaign-scenario.js';

export function tacticalMinimapLabel(state,context=state){
 const seconds=Math.max(0,(state.startSeconds??0)+(state.elapsedSeconds??0));
 const minutes=Math.floor(seconds/60),hour=Math.floor(minutes/60)%24,minute=minutes%60;
 const mission=missionScenesFor(context)[state.sceneId??state.missionId??state.sectorId],cell=worldCell(state.sectorId,context)??worldCell(mission?.anchor,context);
 return {sectorCode:state.sectorCode??cell?.grid??'',sectorName:state.sectorName??mission?.name??campaignPlace(state.sectorId,context)?.name??'Sector',day:Math.floor(seconds/86400)+1,time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};
}
