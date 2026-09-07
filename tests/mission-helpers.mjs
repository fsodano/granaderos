import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,visibleHostiles,bladeFor} from '../game/tactical.js';
const step=(s,a)=>{const n=dispatchCampaign(s,a);if(n.lastError)throw Error(n.lastError);return n;};
export function attendYatasto(s){
 s=step(s,{type:'travel',sector:'tucuman'});s=step(s,{type:'visitMission',mission:'yatasto'});let b=enterSector(s.pendingBattle,s.sceneStates.yatasto);const actor=b.units.find(u=>u.side==='player'&&!u.militia);
 for(const npcId of ['yatasto-belgrano','yatasto-san-martin','yatasto-san-martin']){const npc=b.npcs.find(n=>n.id===npcId);const p=getReachable(b,actor.id).filter(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1).sort((a,b)=>a.cost-b.cost)[0];if(!p)throw Error('Conference interlocutor unreachable');if(p.cost)b=actBattle(b,{type:'move',unitId:actor.id,x:p.x,y:p.y});if(b.lastError)throw Error(b.lastError);s=step(s,{type:'talkNPC',npcId,approach:'mission',unitId:Number(actor.id),sectorState:b});}
 return step(s,{type:'finishMission',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});
}
