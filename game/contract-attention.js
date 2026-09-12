// The classic renewal warning covers contracts ending within two hours.
// Only explicit campaign waits pause; tactical time and blocking travel finish.
export const CONTRACT_WARNING_HOURS=2;
export const initialContractAttention=()=>({version:1,reported:{},notice:null});
export function migrateContractAttention(s){s.contractAttention??=initialContractAttention();return s;}
export function reconcileContractAttention(s){
 migrateContractAttention(s);
 for(const [id,marker] of Object.entries(s.contractAttention.reported)){
  if(!s.recruited.includes(Number(id))||!s.operativeState[id]?.alive||s.operativeState[id].captured||s.contracts[id]?.expiresAt!==marker.expiresAt)delete s.contractAttention.reported[id];
 }
}
export function contractAttentionStates(s){
 return s.recruited.flatMap(id=>{
  const r=s.operativeState[id],expiresAt=s.contracts[id]?.expiresAt;
  if(!r?.alive||r.captured||!Number.isInteger(expiresAt)||expiresAt-s.hour>CONTRACT_WARNING_HOURS)return [];
  return [{operativeId:id,expiresAt,code:expiresAt>s.hour?'expiring':'expired'}];
 });
}
export function collectContractAttention(s,extra=[]){
 reconcileContractAttention(s);
 const candidates=new Map([...contractAttentionStates(s),...extra].map(e=>[e.operativeId,e]));
 return [...candidates.values()].sort((a,b)=>a.operativeId-b.operativeId).filter(event=>{
  const old=s.contractAttention.reported[event.operativeId];
  if(old?.expiresAt===event.expiresAt&&old.code===event.code)return false;
  s.contractAttention.reported[event.operativeId]={expiresAt:event.expiresAt,code:event.code};return true;
 });
}
export function publicContractNotice(s){
 const n=s.contractAttention?.notice;
 return n?{hour:n.hour,requestedHours:n.requestedHours,advancedHours:n.advancedHours,events:n.events.map(e=>({operativeId:e.operativeId,expiresAt:e.expiresAt,code:e.code}))}:null;
}
export function validateContractAttention(s,roster){
 if(s.contractAttention===undefined)s.contractAttention=initialContractAttention();
 const ids=new Set(roster.map(o=>o.id)),a=s.contractAttention;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const need=v=>{if(!v)throw Error('Los avisos de contratos guardados son inválidos.');};
 const marker=e=>exact(e,['expiresAt','code'])&&int(e.expiresAt,1,1e9)&&['expiring','expired'].includes(e.code);
 need(exact(a,['version','reported','notice'])&&a.version===1&&object(a.reported)&&Object.keys(a.reported).length<=ids.size);
 for(const [id,e] of Object.entries(a.reported))need(String(Number(id))===id&&ids.has(Number(id))&&marker(e));
 const n=a.notice;
 if(n!==null){
  need(exact(n,['hour','requestedHours','advancedHours','events'])&&int(n.hour,0,s.hour)&&int(n.requestedHours,1,240)&&int(n.advancedHours,0,Math.min(n.hour,n.requestedHours))&&Array.isArray(n.events)&&n.events.length>0&&n.events.length<=ids.size);
  const seen=new Set();
  for(const e of n.events){
   need(exact(e,['operativeId','expiresAt','code'])&&ids.has(e.operativeId)&&!seen.has(e.operativeId)&&marker({expiresAt:e.expiresAt,code:e.code}));seen.add(e.operativeId);
   need(e.code==='expiring'?e.expiresAt>n.hour&&e.expiresAt-n.hour<=CONTRACT_WARNING_HOURS:e.expiresAt<=n.hour);
  }
 }
 return s;
}
