import {actBattle,getReachable,endTurn,canSee} from '../game/tactical.js';
import {wallEdgeCells,wallMovementBlocked} from '../game/wall-geometry.js';
// Civilian routines advance during movement. Replan short, legal steps rather
// than walking toward an obsolete NPC coordinate on a larger sector.
export function approachNPC(battle,unitId,npcId){
 for(let i=0;i<240;i++){
  const actor=battle.units.find(u=>u.id===String(unitId)),npc=battle.npcs.find(n=>n.id===npcId);
  if(!actor||!npc)throw Error('Missing interlocutor or actor.');
  if(Math.abs(actor.x-npc.x)+Math.abs(actor.y-npc.y)<=1&&!wallMovementBlocked(battle,actor,npc)){
   if(canSee(battle,actor,npc))return battle;
   battle=actBattle(battle,{type:'look',unitId:actor.id,x:npc.x,y:npc.y});if(battle.lastError)throw Error(battle.lastError);continue;
  }
  if(actor.hp>=15&&actor.energy<10&&battle.mode==='exploration'){battle=endTurn(battle);if(battle.lastError)throw Error(battle.lastError);continue;}
  const reachable=getReachable(battle,actor);
  const adjacent=reachable.filter(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1&&!wallMovementBlocked(battle,p,npc)).sort((a,b)=>a.cost-b.cost)[0];
  let action;
  if(adjacent?.path.length)action={type:'move',unitId:actor.id,...adjacent.path[0]};
  else{
   const doors=battle.wallEdges.filter(t=>t.type==='door'&&!t.open&&!t.locked&&!t.jammed&&!t.destroyed);
   const options=doors.flatMap(door=>reachable.filter(p=>wallEdgeCells(door).some(c=>c.x===p.x&&c.y===p.y&&(c.tacticalLevel??0)===(p.tacticalLevel??0))).map(p=>({door,p}))).sort((a,b)=>(a.p.cost+Math.abs(a.door.x-npc.x)+Math.abs(a.door.y-npc.y))-(b.p.cost+Math.abs(b.door.x-npc.x)+Math.abs(b.door.y-npc.y)));
   const next=options[0];if(!next)throw Error(`No legal approach to ${npcId}: ${JSON.stringify({actor:{x:actor.x,y:actor.y,hp:actor.hp,energy:actor.energy,ap:actor.ap,unconscious:actor.unconscious},npc:{x:npc.x,y:npc.y},reachable:reachable.length})}`);
   action=next.p.path.length?{type:'move',unitId:actor.id,...next.p.path[0]}:{type:'door',unitId:actor.id,doorId:next.door.doorId};
  }
  battle=actBattle(battle,action);if(battle.lastError)throw Error(battle.lastError);
 }
 throw Error(`Interlocutor ${npcId} was not reached within 240 legal steps.`);
}
