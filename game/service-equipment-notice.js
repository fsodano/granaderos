import {campaignPlace} from './world-cells.js';
import {missionScenesFor} from './campaign-scenario.js';

// A return marker is the player's own departure receipt. Its fixed location
// must not follow the former recruit or consult the current sector occupants.
export function serviceEquipmentReturnReason(state,id){
 const record=state?.operativeState?.[id],marker=record?.serviceEquipmentReturn;
 if(!marker)return null;
 const sector=campaignPlace(marker.sectorId,state)?.name;
 const mission=missionScenesFor(state)[marker.siteId];
 const site=mission?.name??campaignPlace(marker.siteId,state)?.name;
 const location=site&&sector&&site!==sector?`${site} (${sector})`:site??sector??'el lugar de su salida';
 const chooseSite=mission?` En «Lugar», elegí «${mission.name}».`:'';
 const points=record.toolkitPoints??0;
 const repair=points>0?` Retirá también ${points} ${points===1?'punto':'puntos'} de «Materiales de reparación».`:'';
 return `Recogé todo el equipo que dejó en ${location} antes de volver a contratar a esta persona. Usá «Equipo del sector» con un combatiente presente, consciente y despierto, en un sector reconocido y seguro.${chooseSite}${repair}`;
}
