import assert from 'node:assert/strict';
import {activateTownIncome,TOWN_INCOME_SOURCES} from '../game/town-income.js';

// A declared established agreement for subsystem scenarios. This is saved
// fixture history; actual spoken activation is proved in town-income-campaign.
export function recordTownAgreement(state,sourceId){
 const source=TOWN_INCOME_SOURCES.find(source=>source.id===sourceId);assert.ok(source);
 const npcId=source.representative.npcId,sectorId=source.representative.sectorId,approach='friendly';
 state.conversations[npcId]={...state.conversations[npcId],met:true,hour:state.hour,secondOfHour:state.secondOfHour??0,lastApproach:approach,sector:sectorId,text:'El acuerdo del puerto quedó registrado.'};
 assert.equal(activateTownIncome(state,{npcId,sectorId,approach}).applied,true);
 return state;
}
