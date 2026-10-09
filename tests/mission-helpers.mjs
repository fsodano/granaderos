import {approachNPC} from './approach-npc.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,visibleHostiles,bladeFor} from '../game/tactical.js';
const step=(s,a)=>{const n=dispatchCampaign(s,a);if(n.lastError)throw Error(n.lastError);return n;};
export function attendYatasto(s){
 if(s.location!=='tucuman')s=completeTestTravel(s,{sector:'tucuman'});
 s=step(s,{type:'visitMission',mission:'yatasto'});let b=enterSector(s.pendingBattle,s.sceneStates.yatasto);const actor=b.units.find(u=>u.side==='player'&&!u.militia);
 for(const npcId of ['yatasto-belgrano','yatasto-san-martin','yatasto-san-martin']){b=approachNPC(b,actor.id,npcId);s=step(s,{type:'talkNPC',npcId,approach:'mission',unitId:Number(actor.id),sectorState:b});}
 return step(s,{type:'finishMission',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});
}
