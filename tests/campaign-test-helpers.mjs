import {dispatchCampaign} from '../game/campaign.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
function transportPath(s,from,to){const seen=new Set([from]),queue=[from];while(queue.length){const id=queue.shift();if(id===to)return true;for(const next of CAMPAIGN_SECTORS.find(d=>d.id===id).neighbors)if(!seen.has(next)&&s.sectors[next].owner==='patriot'){seen.add(next);queue.push(next);}}return false;}
// Integration tests explicitly march through controlled sectors before a frontier attack.
export function marchToFront(state,action){
 if(action.type!=='attack')return state;
 const target=action.sector??'san_lorenzo';const destinations=target==='san_lorenzo'?['san_nicolas']:CAMPAIGN_SECTORS.find(d=>d.id===target)?.neighbors??[];
 if(state.location===target||destinations.includes(state.location))return state;
 const destination=destinations.find(id=>state.sectors[id].owner==='patriot'&&transportPath(state,state.location,id));
 if(!destination)return state;
 const next=dispatchCampaign(state,{type:'travel',sector:destination});
 if(next.lastError)throw Error(`Integration-test march failed: ${next.lastError}`);
 return next;
}

import {encounterForOperative} from '../game/encounters.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle,actBattle} from '../game/tactical.js';
export function meetLocalRecruit(state,action){
 if(action.type!=='recruit')return null;
 const npc=encounterForOperative(action.id);if(!npc)return null;
 let s=state;if(s.location!==npc.sector){s=dispatchCampaign(s,{type:'travel',sector:npc.sector});if(s.lastError)throw Error(s.lastError);}
 s=dispatchCampaign(s,{type:'visitSector'});if(s.lastError)throw Error(s.lastError);
 const map=buildSectorMap(s.pendingBattle);let battle=createBattle(map.squad,map);const actor=battle.units.filter(u=>u.side==='player').sort((a,b)=>b.leadership-a.leadership)[0];
 battle=actBattle(battle,{type:'move',unitId:actor.id,x:npc.x-1,y:npc.y});if(battle.lastError)throw Error(battle.lastError);
 s=dispatchCampaign(s,{type:'talkNPC',npcId:npc.id,approach:'recruit',unitId:Number(actor.id),sectorState:battle});if(s.lastError)return s;
 return dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});
}
