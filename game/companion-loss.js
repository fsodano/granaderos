import {receiveCorrespondence} from './correspondence.js';
import {contractExpiresSeconds} from './contracts.js';
import {isUnconscious} from './actor-condition.js';
import {characterForOperative} from './content-character-ids.js';
import {preferredCompanions,PREFERRED_COMPANION_LIMIT} from './service-relationships.js';

const numericId=id=>Number.isSafeInteger(id)&&id>=0;
const second=value=>Number.isInteger(value)&&value>=0&&value<3600;
const own=(value,key)=>Object.hasOwn(value,key);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>own(value,key));
const now=state=>state.hour*3600+(state.secondOfHour??0);
const date=value=>object(value)&&Number.isSafeInteger(value.hour)&&value.hour>=0&&second(value.secondOfHour);
const messageId=(id,companionId)=>`companion-loss:${id}:${companionId}`;
const need=ok=>{if(!ok)throw Error('El aviso pendiente de pérdida de compañero es inválido.');};
function servingContract(state,id){
 const contract=state.contracts?.[id],at=now(state);
 if(!contract||!['paid','patriot','legacy'].includes(contract.kind)||!['day','week','fortnight','month'].includes(contract.term)||!Number.isSafeInteger(contract.started)||contract.started<0||
   contract.departurePending!==undefined&&typeof contract.departurePending!=='boolean'||
   contract.startedSecond!==undefined&&!second(contract.startedSecond)||contract.expiresSecond!==undefined&&!second(contract.expiresSecond)||
   !Number.isSafeInteger(contract.paid)||contract.paid<0||contract.paid>1e9||contract.started*3600+(contract.startedSecond??0)>at)return false;
 if(contract.expiresAt===null)return contract.kind!=='paid'&&contract.expiresSecond===undefined;
 if(!Number.isSafeInteger(contract.expiresAt)||contract.expiresAt<0||contract.expiresAt>1e9)return false;
 return contractExpiresSeconds(contract)>at;
}
const nameFor=(state,operative)=>characterForOperative(state,operative.id)?.name??operative.name;
const serviceIdentity=contract=>({serviceKind:contract.kind,serviceStarted:contract.started,serviceStartedSecond:contract.startedSecond??0});
const sameService=(receipt,contract)=>contract&&receipt.serviceKind===contract.kind&&receipt.serviceStarted===contract.started&&receipt.serviceStartedSecond===(contract.startedSecond??0);
const livingService=(state,id)=>state.recruited?.includes(id)&&state.operativeState?.[id]?.alive===true&&state.operativeState[id].hp>0&&!state.operativeState[id].captured&&!state.operativeState[id].surrendered&&servingContract(state,id);
const canWrite=(state,id,settled)=>{
 const record=state.operativeState[id];
 return !record.unconscious&&!isUnconscious(record)&&!record.asleep&&!record.sleepCollapsed&&
  (!(state.pendingBattle?.squad??[]).some(unit=>Number(unit.id)===id)||settled.has(id));
};

// This is the time a new military casualty was confirmed for correspondence,
// not its physical injury/death time. It survives later scene replacement.
function confirmationFor(state,id,battleId){
 const record=state.operativeState[id],at={hour:state.hour,secondOfHour:state.secondOfHour??0};
 if(battleId!==undefined){
  const request=state.pendingBattle;
  return typeof battleId==='string'&&battleId.length>0&&battleId.length<100&&request?.id===battleId&&
   request.squad?.some(unit=>Number(unit.id)===id&&unit.hp>0)?{...at,source:'return',battleId}:null;
 }
 return record.deathMinute===state.hour*60+Math.floor(at.secondOfHour/60)?{...at,source:'bleeding'}:null;
}
function writeLetter(state,operative,companion){
 const id=messageId(operative.id,companion.id);
 receiveCorrespondence(state,{id,sender:nameFor(state,operative),subject:'Una pérdida en el destacamento',
  text:`Lamento la muerte de ${nameFor(state,companion)}. Confiaba en su ayuda.`});
 return id;
}

export function cancelPendingCompanionLoss(state,id){delete state.operativeState[id].pendingCompanionLoss;}
export function renewPendingCompanionLossService(state,id){
 const record=state.operativeState[id];
 if(record.pendingCompanionLoss)record.pendingCompanionLoss=record.pendingCompanionLoss.map(receipt=>({...receipt,...serviceIdentity(state.contracts[id])}));
}

// Validation is read-only. Loading never creates, delivers or cancels a notice.
export function validatePendingCompanionLoss(state,roster){
 const known=new Map(roster.map(operative=>[operative.id,operative]));
 for(const [rawId,record]of Object.entries(state.operativeState??{})){
  if(!record||typeof record!=='object')continue;
  if(own(record,'companionLossConfirmation')||own(record,'pendingCompanionLoss'))need(String(Number(rawId))===rawId);
  if(own(record,'companionLossConfirmation')){
   const source=record.companionLossConfirmation;
   need(known.has(Number(rawId))&&record.alive===false&&record.hp===0&&date(source)&&now(source)<=now(state));
   need(source.source==='return'?exact(source,['hour','secondOfHour','source','battleId'])&&typeof source.battleId==='string'&&source.battleId.length>0&&source.battleId.length<100&&!/[<>\x00-\x1f]/u.test(source.battleId):
    source.source==='bleeding'&&exact(source,['hour','secondOfHour','source'])&&record.deathMinute===source.hour*60+Math.floor(source.secondOfHour/60));
  }
  if(!own(record,'pendingCompanionLoss'))continue;
  const id=Number(rawId),operative=known.get(id),rows=record.pendingCompanionLoss,contract=state.contracts?.[id];
  need(operative&&livingService(state,id)&&Array.isArray(rows)&&rows.length>0&&rows.length<=PREFERRED_COMPANION_LIMIT&&Object.keys(rows).length===rows.length);
  const preferences=new Set(preferredCompanions(state,operative).map(preference=>preference.companionId)),seen=new Set();
  for(const receipt of rows){
   need(exact(receipt,['companionId','hour','secondOfHour','serviceKind','serviceStarted','serviceStartedSecond'])&&numericId(receipt.companionId)&&receipt.companionId!==id&&!seen.has(receipt.companionId)&&date(receipt)&&now(receipt)<=now(state));
   need(preferences.has(receipt.companionId)&&known.has(receipt.companionId)&&sameService(receipt,contract)&&Number.isSafeInteger(receipt.serviceStarted)&&receipt.serviceStarted>=0&&second(receipt.serviceStartedSecond));
   const companion=state.operativeState[receipt.companionId],source=companion?.companionLossConfirmation;
   need(companion?.alive===false&&companion.hp===0&&source&&source.hour===receipt.hour&&source.secondOfHour===receipt.secondOfHour&&!(state.correspondence??[]).some(message=>message.id===messageId(id,receipt.companionId)));
   seen.add(receipt.companionId);
  }
 }
}

export function deliverPendingCompanionLossCorrespondence(state,roster,{settledIds=[]}={}){
 const known=new Map(roster.map(operative=>[operative.id,operative])),settled=new Set(settledIds),received=[];
 for(const [id,operative]of known){
  const record=state.operativeState?.[id];if(!record?.pendingCompanionLoss)continue;
  if(!livingService(state,id)){cancelPendingCompanionLoss(state,id);continue;}
  if(!canWrite(state,id,settled))continue;
  for(const receipt of record.pendingCompanionLoss){
   // An ordinary renewal explicitly rebinds receipts. A different service
   // without that accepted transition cannot revive a former term's notice.
   if(!sameService(receipt,state.contracts[id]))continue;
   const companion=known.get(receipt.companionId);
   if(!(state.correspondence??[]).some(message=>message.id===messageId(id,receipt.companionId)))received.push(writeLetter(state,operative,companion));
  }
  cancelPendingCompanionLoss(state,id);
 }
 return received;
}

// The caller supplies newly confirmed military casualties only. This helper
// neither discovers civilian deaths nor backfills older saved losses. Text is
// a fictional written reaction. Only an actual new confirmation can defer it.
export function receiveCompanionLossCorrespondence(state,roster,casualtyIds,{settledIds=[],battleId}={}){
 if(!Array.isArray(roster)||!Array.isArray(casualtyIds)||!Number.isSafeInteger(state.hour)||state.hour<0||!second(state.secondOfHour??0))return [];
 const casualties=new Set(casualtyIds.filter(id=>numericId(id)&&state.operativeState?.[id]?.alive===false&&state.operativeState[id].hp===0));
 const settled=new Set(Array.isArray(settledIds)?settledIds.filter(numericId):[]);
 const known=new Map(roster.filter(operative=>numericId(operative.id)).map(operative=>[operative.id,operative]));
 const received=[];
 for(const [id,operative]of known){
  const record=state.operativeState?.[id];if(!livingService(state,id))continue;
  for(const preference of preferredCompanions(state,operative)){
   const deadId=preference.companionId,companion=known.get(deadId);
   if(deadId===id||!casualties.has(deadId)||!companion)continue;
   if(state.correspondence?.some(message=>message.id===messageId(id,deadId))||record.pendingCompanionLoss?.some(receipt=>receipt.companionId===deadId))continue;
   if(canWrite(state,id,settled)){received.push(writeLetter(state,operative,companion));continue;}
   const confirmation=confirmationFor(state,deadId,battleId);if(!confirmation)continue;
   const casualty=state.operativeState[deadId];
   if(casualty.companionLossConfirmation&&JSON.stringify(casualty.companionLossConfirmation)!==JSON.stringify(confirmation))continue;
   casualty.companionLossConfirmation??=confirmation;
   record.pendingCompanionLoss=[...(record.pendingCompanionLoss??[]),{companionId:deadId,hour:confirmation.hour,secondOfHour:confirmation.secondOfHour,...serviceIdentity(state.contracts[id])}];
  }
 }
 return [...received,...deliverPendingCompanionLossCorrespondence(state,roster,{settledIds})];
}
