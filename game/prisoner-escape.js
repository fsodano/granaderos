import {atHand} from './tactical-planning-space.js';
import {tacticalLevel} from './tactical-space.js';
import {boundaryMatches,findSectorExit} from './tactical-exits.js';
import {propBlocksAt} from './props.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function prisonerCanExit(battle,npc,leader,exit){
 const tile=battle.tiles.find(t=>t.x===npc.x&&t.y===npc.y);
 return Boolean(npc.detention?.freed&&!npc.departure&&npc.hp>=15&&!npc.unconscious&&npc.energy>1&&!npc.entangled&&!npc.knockedDown&&!npc.surrendered&&npc.escort?.leaderId===leader.id&&!npc.escort.waiting&&tacticalLevel(npc)===0&&tacticalLevel(leader)===0&&boundaryMatches(battle,npc,exit.edge)&&boundaryMatches(battle,leader,exit.edge)&&atHand(npc,leader,1)&&tile&&!tile.blocked&&!propBlocksAt(battle,npc.x,npc.y));
}
export function crossPrisonerEscorts(battle,leader,exit){
 if(!leader.departure)return [];
 const escaped=[];
 for(const npc of battle.npcs??[])if(prisonerCanExit(battle,npc,leader,exit)){
  npc.energy--;npc.lastMovePath=[];
  npc.departure={exitId:exit.id,edge:exit.edge,destination:exit.destination,x:npc.x,y:npc.y,elapsedSeconds:battle.elapsedSeconds??0,mountId:null};
  npc.detentionEscape={version:1,battleId:battle.battleId,leaderId:leader.id,energySpent:1,leader:{x:leader.x,y:leader.y},width:battle.width,height:battle.height};
  escaped.push(npc);
 }
 return escaped;
}
export function validatePrisonerEscape(npc,battle=null){
 const receipt=npc.detentionEscape,d=npc.departure;
 if(!npc.detention){need(receipt===undefined,'La salida no tiene prisionero.');return;}
 if(!receipt){need(d===undefined,'La salida del prisionero no tiene recibo.');return;}
 need(npc.detention.freed&&npc.hp>=15&&!npc.unconscious&&npc.energy>0&&receipt&&Object.keys(receipt).length===7&&receipt.version===1&&receipt.energySpent===1&&receipt.battleId===npc.detentionRelease?.battleId&&receipt.leaderId===npc.escort?.leaderId&&!npc.escort.waiting,'El recibo de escape es inválido.');
 need(Number.isInteger(receipt.width)&&receipt.width>=4&&receipt.width<=128&&Number.isInteger(receipt.height)&&receipt.height>=4&&receipt.height<=128&&receipt.leader&&Object.keys(receipt.leader).length===2,'Las dimensiones del escape son inválidas.');
 const exit=findSectorExit(npc.detention.sector,null,d?.exitId);
 need(exit&&d&&Object.keys(d).length===7&&d.edge===exit.edge&&d.destination===exit.destination&&d.mountId===null&&Number.isSafeInteger(d.elapsedSeconds)&&d.elapsedSeconds>=(npc.detentionOrders?.at(-1)?.elapsedSeconds??npc.detentionRelease.elapsedSeconds)&&d.x===npc.x&&d.y===npc.y&&tacticalLevel(npc)===0&&boundaryMatches(receipt,d,exit.edge)&&boundaryMatches(receipt,receipt.leader,exit.edge)&&atHand(d,receipt.leader,1)&&!(d.x===receipt.leader.x&&d.y===receipt.leader.y),'El prisionero no cruzó junto a su rescatista.');
 if(battle){
  const leader=battle.units.find(u=>u.id===receipt.leaderId&&u.side==='player');
  need(receipt.battleId===battle.battleId&&receipt.width===battle.width&&receipt.height===battle.height&&battle.exits?.some(e=>e.id===exit.id)&&d.elapsedSeconds<=(battle.elapsedSeconds??0)&&leader?.departure&&['exitId','edge','destination','elapsedSeconds'].every(k=>leader.departure[k]===d[k])&&leader.departure.x===receipt.leader.x&&leader.departure.y===receipt.leader.y,'El escape no corresponde a la salida del rescate.');
 }
}
