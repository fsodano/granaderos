import assert from 'node:assert/strict';
import {dispatchCampaign} from '../packages/game/campaign.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

// Released prisoners can be serving locally without belonging to a squad.
// Give each actual defender a normal squad before walking to known roof cover.
// This never adds a body, changes their equipment, or settles a raid.
export function stageOpeningRearCover(start,{sector=start.location,exclude=[],report=()=>{}}={}){
 assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 let campaign=decodeSave(encodeSave(start)).campaign;
 const ids=campaign.recruited.filter(id=>{
  const r=campaign.operativeState[id];
  return !exclude.includes(id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;
 });
 assert.ok(ids.length,'The actual rear guard needs physically present capable soldiers.');
 const actions=[];
 for(let offset=0;offset<ids.length;offset+=6){
  const action={type:'createSquad',sector,name:'Guardia de la cubierta '+(1+offset/6),ids:ids.slice(offset,offset+6)};
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);
 }
 campaign=stageRouteRoofDefenders(campaign,ids,{report});
 for(const [id,r]of Object.entries(start.operativeState)){
  assert.equal(campaign.operativeState[id].alive,r.alive,'Cover preparation preserves every actual casualty.');
  assert.equal(campaign.operativeState[id].captured,r.captured,'Cover preparation cannot release prisoners.');
 }
 assert.equal(campaign.resources.treasury,start.resources.treasury);
 const receipt={event:'openingRearCover',sector,ids,actions,startSeconds:start.hour*3600+(start.secondOfHour??0),endSeconds:campaign.hour*3600+(campaign.secondOfHour??0)};
 report(receipt);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return {campaign,receipt};
}
