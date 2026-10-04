// The default renewal warning covers contracts ending within two hours.
// Only explicit campaign waits pause; tactical time and blocking travel finish.
import {contractRules,DEFAULT_CONTRACT_RULES} from './contract-rules.js';
import {contractExpiresSeconds} from './contracts.js';
const seconds=s=>s.hour*3600+(s.secondOfHour??0);
const expiryFields=e=>({expiresAt:e.expiresAt,...(e.expiresSecond?{expiresSecond:e.expiresSecond}:{})});
export const CONTRACT_WARNING_HOURS=DEFAULT_CONTRACT_RULES.warningHours;
export const initialContractAttention=()=>({version:1,reported:{},notice:null});
export function migrateContractAttention(s){if(s.contractAttention===undefined)s.contractAttention=initialContractAttention();return s;}
export function reconcileContractAttention(s){
 migrateContractAttention(s);
 for(const [id,marker] of Object.entries(s.contractAttention.reported)){
  if(!s.recruited.includes(Number(id))||!s.operativeState[id]?.alive||s.operativeState[id].captured||contractExpiresSeconds(s.contracts[id])!==contractExpiresSeconds(marker))delete s.contractAttention.reported[id];
 }
}
function attentionContracts(s){
 return s.recruited.flatMap(id=>{
  const r=s.operativeState[id],contract=s.contracts[id];
  return !r?.alive||r.captured||!Number.isInteger(contract?.expiresAt)?[]:[{id,contract,expiry:contractExpiresSeconds(contract)}];
 });
}
export function contractAttentionStates(s){
 const now=seconds(s),window=contractRules(s).warningHours*3600;
 return attentionContracts(s).flatMap(({id,contract,expiry})=>expiry-now>window?[]:[{operativeId:id,...expiryFields(contract),code:expiry>now?'expiring':'expired'}]);
}
// Acknowledged warnings do not stop the clock again. A warning at the current
// time is handled by admission, so this countdown is always positive.
export function nextContractWarningSeconds(s){
 const now=seconds(s),window=contractRules(s).warningHours*3600;
 const future=attentionContracts(s).flatMap(({id,expiry})=>{
  const old=s.contractAttention?.reported?.[id];
  if(old?.code==='expiring'&&contractExpiresSeconds(old)===expiry)return [];
  const due=expiry-window-now;return due>0?[due]:[];
 });
 return future.length?Math.min(...future):null;
}
export function collectContractAttention(s,extra=[]){
 reconcileContractAttention(s);
 const candidates=new Map([...contractAttentionStates(s),...extra].map(e=>[e.operativeId,e]));
 return [...candidates.values()].sort((a,b)=>a.operativeId-b.operativeId).filter(event=>{
  const old=s.contractAttention.reported[event.operativeId];
  if(old&&contractExpiresSeconds(old)===contractExpiresSeconds(event)&&old.code===event.code)return false;
  s.contractAttention.reported[event.operativeId]={...expiryFields(event),code:event.code};return true;
 });
}
export function publicContractNotice(s){
 const n=s.contractAttention?.notice;
 return n?{hour:n.hour,...(n.secondOfHour?{secondOfHour:n.secondOfHour}:{}),requestedHours:n.requestedHours,advancedHours:n.advancedHours,events:n.events.map(e=>({operativeId:e.operativeId,...expiryFields(e),code:e.code}))}:null;
}
export function validateContractAttention(s,roster){
 if(s.contractAttention===undefined)s.contractAttention=initialContractAttention();
 const ids=new Set(roster.map(o=>o.id)),a=s.contractAttention;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const optional=(v,keys,extra)=>object(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||extra.includes(k));
 const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const need=v=>{if(!v)throw Error('Los avisos de contratos guardados son inválidos.');};
 const marker=e=>optional(e,['expiresAt','code'],['expiresSecond'])&&int(e.expiresAt,1,1e9)&&(!Object.hasOwn(e,'expiresSecond')||int(e.expiresSecond,0,3599))&&['expiring','expired'].includes(e.code);
 need(exact(a,['version','reported','notice'])&&a.version===1&&object(a.reported)&&Object.keys(a.reported).length<=ids.size);
 for(const [id,e] of Object.entries(a.reported))need(String(Number(id))===id&&ids.has(Number(id))&&marker(e));
 const n=a.notice;
 if(n!==null){
  need(optional(n,['hour','requestedHours','advancedHours','events'],['secondOfHour'])&&int(n.hour,0,s.hour)&&(!Object.hasOwn(n,'secondOfHour')||int(n.secondOfHour,0,3599))&&seconds(n)<=seconds(s)&&int(n.requestedHours,1,240)&&int(n.advancedHours,0,Math.min(n.hour,n.requestedHours))&&Array.isArray(n.events)&&n.events.length>0&&n.events.length<=ids.size);
  const seen=new Set();
  for(const e of n.events){
   need(optional(e,['operativeId','expiresAt','code'],['expiresSecond'])&&ids.has(e.operativeId)&&!seen.has(e.operativeId)&&marker({...expiryFields(e),...(Object.hasOwn(e,'expiresSecond')?{expiresSecond:e.expiresSecond}:{}),code:e.code}));seen.add(e.operativeId);
   const remaining=contractExpiresSeconds(e)-seconds(n);
   need(e.code==='expiring'?remaining>0&&remaining<=contractRules(s).warningHours*3600:remaining<=0);
  }
 }
 return s;
}
