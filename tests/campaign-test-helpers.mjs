import {approachNPC} from './approach-npc.mjs';
import {worldOwner} from '../game/world-cells.js';
import {tooTiredToMarch} from '../game/march-fatigue.js';
import {dispatchCampaign} from '../game/campaign.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {transportPath} from '../game/logistics.js';
// Follow real recovery and movement orders when test journeys cross exhaustion.
export function restForMarch(state){
 if(state.pendingEncounter||!['patriot','neutral'].includes(worldOwner(state,state.location)))return state;
 if(!state.squad.some(id=>tooTiredToMarch(state.operativeState[id])||state.operativeState[id].asleep))return state;
 let s=state;
 for(const id of s.squad){const r=s.operativeState[id];if(!r.asleep&&(r.fatigue>0||r.energy<100)){s=dispatchCampaign(s,{type:'setSleep',operativeId:id,asleep:true});if(s.lastError)throw Error(s.lastError);}}
 for(let i=0;s.squad.some(id=>s.operativeState[id].asleep)&&i<20;i++){s=dispatchCampaign(s,{type:'wait',hours:12});if(s.lastError)throw Error(s.lastError);if(s.pendingEncounter)return s;}
 if(s.squad.some(id=>s.operativeState[id].asleep))throw Error('The test squad did not finish its actual sleep.');
 return s;
}
// Follow each real hour and resume after actual recovery. A notice is not arrival.
export function completeTestTravel(state,action){
 let s=state;
 for(let attempt=0;attempt<240;attempt++){
  if(s.pendingEncounter||s.pendingBattle)return s;
  const q=s.squads.find(q=>q.id===s.activeSquadId),journey=q?.journey;
  if(!journey&&s.location===action.sector)return restForMarch(s);
  let next;
  if(journey?.status==='paused'){
   next=dispatchCampaign(s,{type:'cancelTravel',choice:'stop'});
  }else if(journey){
   if(journey.status==='ready')throw Error('The travel fixture reached an unresolved assault.');
   next=dispatchCampaign(s,{type:'wait',hours:24});
  }else next=dispatchCampaign(restForMarch(s),{...action,type:'travel',queue:true});
  if(next.lastError)throw Error(`Integration-test march to ${action.sector} failed: ${next.lastError}`);s=next;
 }
 throw Error(`The test squad did not reach ${action.sector} through its actual route.`);
}
export function marchToFront(state,action){
 if(action.type!=='attack')return state;
 const target=action.sector??'san_lorenzo',destinations=target==='san_lorenzo'?['san_nicolas']:CAMPAIGN_SECTORS.find(d=>d.id===target)?.neighbors??[];
 let s=restForMarch(state);
 if(s.location===target||destinations.includes(s.location))return s;
 const destination=destinations.find(id=>s.sectors[id].owner==='patriot'&&transportPath(s,s.location,id));
 return destination?completeTestTravel(s,{sector:destination}):s;
}

import {encounterForOperative} from '../game/encounters.js';
import {enterSector} from '../game/world.js';
import {createBattle} from '../game/tactical.js';
export function meetLocalRecruit(state,action){
 if(action.type!=='recruit')return null;
 const npc=encounterForOperative(action.id);if(!npc)return null;
 let s=state;if(s.location!==npc.sector){s=completeTestTravel(s,{sector:npc.sector});}
 s=dispatchCampaign(s,{type:'visitSector'});if(s.lastError)throw Error(s.lastError);
 let battle=enterSector(s.pendingBattle,s.sectorStates[s.pendingBattle.sector]);const actor=battle.units.filter(u=>s.pendingBattle.squad.some(member=>String(member.id)===u.id)&&u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.departure&&!u.surrendered&&!u.routed).sort((a,b)=>b.leadership-a.leadership)[0];
 if(!actor)throw Error('No conscious deployed speaker is available for this meeting.');
 battle=approachNPC(battle,actor.id,npc.id);
 const local=battle.npcs.find(n=>n.id===npc.id);
 s=dispatchCampaign(s,{type:'talkNPC',npcId:npc.id,approach:'recruit',unitId:Number(actor.id),sectorState:battle});if(s.lastError)return s;
 const joined=s.pendingBattle.squad.find(u=>u.id===action.id);if(joined&&!battle.units.some(u=>Number(u.id)===action.id)){const record=createBattle([joined],{width:battle.width,height:battle.height,enemies:[],exploration:true}).units[0];battle.units.push({...record,x:local.x,y:local.y});battle.npcs=battle.npcs.filter(n=>n.id!==npc.id);}
 return dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});
}
