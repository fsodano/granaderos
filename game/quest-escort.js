import {validatePrisonerRelease} from './prisoner-release.js';
import {questsFor} from './quests.js';
import {boundaryMatches,boundaryPassable,findSectorExit} from './tactical-exits.js';
import {atHand} from './tactical-planning-space.js';
import {tacticalLevel} from './tactical-space.js';
import {wallMovementBlocked} from './wall-geometry.js';

export function applyQuestEscortOrders(campaign,battle){
 if(!battle)return battle;
 return {...battle,npcs:battle.npcs.map(npc=>{
  const quest=questsFor(campaign).find(q=>q.escort&&q.npcId===npc.id&&q.sector===battle.sectorId&&!battle.sceneId),record=quest&&campaign.quests?.[quest.id];
  if(!quest)return npc;
  const result={...npc};delete result.escort;
  if(record?.escortOrder)result.escort={...record.escortOrder,waiting:record.status!=='offered'||record.escortOrder.waiting};
  return result;
 })};
}
export function validateQuestEscortOrders(campaign,battle){
 const expected=applyQuestEscortOrders(campaign,battle);
 for(const quest of questsFor(campaign))if(quest.escort&&quest.sector===battle.sectorId&&!battle.sceneId&&campaign.quests?.[quest.id]&&!battle.npcs.some(n=>n.id===quest.npcId))throw Error('Falta el personaje del encargo de escolta.');
 for(let i=0;i<battle.npcs.length;i++){
  const npc=battle.npcs[i];if(npc.detention){validatePrisonerRelease(npc,battle);continue;}
  const order=expected.npcs[i].escort;
  if(npc.escort&&!questsFor(campaign).some(q=>q.escort&&q.npcId===npc.id&&q.sector===battle.sectorId&&!battle.sceneId))throw Error('La escolta no tiene un encargo autorizado.');
  if(Boolean(npc.escort)!==Boolean(order)||npc.escort&&(npc.escort.leaderId!==order.leaderId||npc.escort.waiting!==order.waiting))throw Error('La orden de escolta no coincide con el encargo.');
 }
}
export function escortArrival(quest,record,battle,npc,leader){
 if(!quest.escort||record?.status!=='offered'||record.escortOrder?.leaderId!==leader.id||record.escortOrder.waiting)throw Error('El combatiente debe conducir esta escolta.');
 const exit=findSectorExit(battle.sectorId,battle.sceneId??null,`${quest.sector}:${quest.escort.destination}`);
 if(!exit||exit.edge!==quest.escort.edge||!battle.exits?.some(e=>e.id===exit.id)||tacticalLevel(npc)!==0||tacticalLevel(leader)!==0||!(boundaryMatches(battle,npc,exit.edge)||boundaryMatches(battle,leader,exit.edge))||!atHand(npc,leader,1)||wallMovementBlocked(battle,npc,leader)||[npc,leader].some(actor=>boundaryMatches(battle,actor,exit.edge)&&!boundaryPassable(battle,actor,exit.edge)))throw Error('Acompañá al contacto hasta la salida indicada en el encargo y hablale allí.');
 return {x:npc.x,y:npc.y,leaderX:leader.x,leaderY:leader.y,width:battle.width,height:battle.height};
}
