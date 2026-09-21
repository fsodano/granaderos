import {atHand} from './tactical-planning-space.js';
import {tacticalLevel} from './tactical-space.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const PRISONER_RELEASE_AP=15;
export const PRISONER_ESCORT_AP=2;
export function recordPrisonerEscort(battle,unit,npc,waiting){
 const point=p=>({x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)});
 npc.detentionOrders??=[];npc.detentionOrders.push({version:1,battleId:battle.battleId,leaderId:unit.id,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds??0,mode:battle.mode,paidAP:battle.mode==='exploration'?0:PRISONER_ESCORT_AP,leader:point(unit),prisoner:point(npc),waiting});
 npc.escort={leaderId:unit.id,waiting};
}
export function recordPrisonerRelease(battle,unit,npc){
 npc.detention.freed=true;npc.escort={leaderId:unit.id,waiting:false};
 const point=p=>({x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)});
 npc.detentionRelease={version:1,battleId:battle.battleId,leaderId:unit.id,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds??0,mode:battle.mode,paidAP:battle.mode==='exploration'?0:PRISONER_RELEASE_AP,leader:point(unit),prisoner:point(npc)};
}
export function validatePrisonerRelease(npc,battle=null){
 const receipt=npc.detentionRelease;
 if(!npc.detention?.freed){need(receipt===undefined&&npc.detentionOrders===undefined&&(!npc.detention||npc.escort===undefined),'El prisionero sigue detenido.');return;}
 need(receipt&&typeof receipt==='object'&&!Array.isArray(receipt)&&Object.keys(receipt).length===9&&receipt.version===1&&typeof receipt.battleId==='string'&&receipt.battleId.length>0&&receipt.battleId.length<=200&&typeof receipt.leaderId==='string'&&receipt.leaderId.length>0&&receipt.leaderId.length<=120,'Falta el parte de liberación del prisionero.');
 need(Number.isInteger(receipt.turn)&&receipt.turn>=1&&Number.isSafeInteger(receipt.elapsedSeconds)&&receipt.elapsedSeconds>=0&&['combat','exploration'].includes(receipt.mode)&&receipt.paidAP===(receipt.mode==='combat'?PRISONER_RELEASE_AP:0),'El coste de liberación del prisionero es inválido.');
 const point=p=>p&&Object.keys(p).length===3&&['x','y','tacticalLevel'].every(k=>Number.isInteger(p[k])&&p[k]>=0)&&p.x<512&&p.y<512&&p.tacticalLevel<=8;
 need(point(receipt.leader)&&point(receipt.prisoner)&&atHand(receipt.leader,receipt.prisoner,1.5)&&!(receipt.leader.x===receipt.prisoner.x&&receipt.leader.y===receipt.prisoner.y),'La liberación requiere un rescatista adyacente.');
 const orders=npc.detentionOrders??[];
 need(Array.isArray(orders)&&orders.length<=10000,'Las órdenes del prisionero son inválidas.');
 let previous=receipt;
 for(const order of orders){
  need(order&&Object.keys(order).length===10&&typeof order.waiting==='boolean'&&order.battleId===receipt.battleId&&order.turn>=previous.turn&&order.elapsedSeconds>=previous.elapsedSeconds&&order.paidAP===(order.mode==='combat'?PRISONER_ESCORT_AP:0),'La orden del prisionero es inválida.');
  const {waiting,...paid}=order;
  validatePrisonerRelease({...npc,detentionOrders:undefined,detentionRelease:{...paid,paidAP:paid.mode==='combat'?PRISONER_RELEASE_AP:0},escort:{leaderId:paid.leaderId,waiting:false}},battle);
  previous=order;
 }
 const expected=orders.at(-1)??{leaderId:receipt.leaderId,waiting:false};
 need(npc.escort&&Object.keys(npc.escort).length===2&&npc.escort.leaderId===expected.leaderId&&npc.escort.waiting===expected.waiting,'La escolta del prisionero no corresponde al rescate.');
 if(battle){
  if(receipt.battleId===battle.battleId)need(receipt.turn<=battle.turn&&receipt.elapsedSeconds<=(battle.elapsedSeconds??0)&&battle.units.some(u=>u.side==='player'&&u.id===receipt.leaderId),'El rescatista no pertenece al despliegue.');
  else need(npc.hp===0,'La liberación pertenece a otro despliegue.');
 }
}
