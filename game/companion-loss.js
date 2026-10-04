import {receiveCorrespondence} from './correspondence.js';
import {contractExpiresSeconds} from './contracts.js';
import {isUnconscious} from './actor-condition.js';
import {characterForOperative} from './content-character-ids.js';
import {preferredCompanions} from './service-relationships.js';

const numericId=id=>Number.isSafeInteger(id)&&id>=0;
const second=value=>Number.isInteger(value)&&value>=0&&value<3600;
function servingContract(state,id){
 const contract=state.contracts?.[id],now=state.hour*3600+(state.secondOfHour??0);
 if(!contract||!['paid','patriot','legacy'].includes(contract.kind)||!['day','week','fortnight','month'].includes(contract.term)||!Number.isSafeInteger(contract.started)||contract.started<0||
   contract.departurePending!==undefined&&typeof contract.departurePending!=='boolean'||
   contract.startedSecond!==undefined&&!second(contract.startedSecond)||contract.expiresSecond!==undefined&&!second(contract.expiresSecond)||
   !Number.isSafeInteger(contract.paid)||contract.paid<0||contract.paid>1e9||contract.started*3600+(contract.startedSecond??0)>now)return false;
 if(contract.expiresAt===null)return contract.kind!=='paid'&&contract.expiresSecond===undefined;
 if(!Number.isSafeInteger(contract.expiresAt)||contract.expiresAt<0||contract.expiresAt>1e9)return false;
 return contractExpiresSeconds(contract)>now;
}
const nameFor=(state,operative)=>characterForOperative(state,operative.id)?.name??operative.name;

// The caller supplies newly confirmed military casualties only. This helper
// neither discovers civilian deaths nor backfills older saved losses. Text is
// a fictional written reaction; the existing inbox is its only saved receipt.
export function receiveCompanionLossCorrespondence(state,roster,casualtyIds,{settledIds=[]}={}){
 if(!Array.isArray(roster)||!Array.isArray(casualtyIds)||!Number.isSafeInteger(state.hour)||state.hour<0||!second(state.secondOfHour??0))return [];
 const casualties=new Set(casualtyIds.filter(id=>numericId(id)&&state.operativeState?.[id]?.alive===false&&state.operativeState[id].hp===0));
 if(!casualties.size)return [];
 const settled=new Set(Array.isArray(settledIds)?settledIds.filter(numericId):[]);
 const deployed=new Set((state.pendingBattle?.squad??[]).map(unit=>Number(unit.id)));
 const known=new Map(roster.filter(operative=>numericId(operative.id)).map(operative=>[operative.id,operative]));
 const received=[];
 for(const [id,operative]of known){
  const record=state.operativeState?.[id];
  if(!state.recruited?.includes(id)||record?.alive!==true||!(record.hp>0)||record.unconscious||isUnconscious(record)||record.asleep||record.sleepCollapsed||
    record.captured||record.surrendered||!servingContract(state,id)||deployed.has(id)&&!settled.has(id))continue;
  for(const preference of preferredCompanions(state,operative)){
   const deadId=preference.companionId,companion=known.get(deadId);
   if(deadId===id||!casualties.has(deadId)||!companion)continue;
   const messageId=`companion-loss:${id}:${deadId}`;
   if(state.correspondence?.some(message=>message.id===messageId))continue;
   receiveCorrespondence(state,{id:messageId,sender:nameFor(state,operative),subject:'Una pérdida en el destacamento',
    text:`Lamento la muerte de ${nameFor(state,companion)}. Confiaba en su ayuda.`});
   received.push(messageId);
  }
 }
 return received;
}
