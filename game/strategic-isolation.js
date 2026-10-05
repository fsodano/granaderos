import {CRITICAL_HEALTH,isUnconscious} from './actor-condition.js';
import {contractExpiresSeconds} from './contracts.js';
import {operativeLocation} from './squads.js';

// Granaderos tuning, not a conversion of JA2's short-term morale modifier.
export const STRATEGIC_ISOLATION_LOSS=1;
export const STRATEGIC_ISOLATION_LIMIT=20;
const now=s=>s.hour*3600+(s.secondOfHour??0);
const deployed=(s,id)=>s.pendingBattle?.squad?.some(unit=>Number(unit.id)===id);
const capable=(s,id)=>{
 const r=s.operativeState?.[id],contract=s.contracts?.[id],expiry=contractExpiresSeconds(contract);
 return Boolean(s.recruited?.includes(id)&&contract&&(expiry===null||expiry>now(s))&&r?.alive&&
  r.hp>=CRITICAL_HEALTH&&(r.energy??100)>0&&!isUnconscious(r)&&!r.asleep&&!r.captured&&
  !r.captive&&!r.bound&&!r.detained&&!r.unconscious&&!r.knockedDown&&!r.routed&&!r.fled&&!r.departure&&
  !r.surrendered&&!deployed(s,id));
};
const authored=op=>Array.isArray(op?.abilities)&&op.abilities.includes('nervous_isolation');

function presence(s,id,traveling){
 // The immediate rural-travel order has one real party but no queued journey.
 if(traveling.has(id))return {moving:true,party:'immediate'};
 const squad=s.squads?.find(q=>q.members.includes(id)),journey=squad?.journey;
 if(journey?.status==='moving')return {moving:true,party:squad.id};
 // A ready assault has already completed its leg. Its stored squad location
 // still names the origin until the actual assault is issued.
 return {moving:false,sector:journey?.status==='ready'?journey.path.at(-1):operativeLocation(s,id)};
}

// Pure own-personnel status. No enemy, civilian, room or intelligence data.
export function strategicIsolationStatus(s,op,{strategicTraveling=[]}={}){
 if(!authored(op))return {eligible:false,active:false,reason:'ability'};
 if(!capable(s,op.id))return {eligible:false,active:false,reason:'incapable'};
 const traveling=new Set(strategicTraveling),at=presence(s,op.id,traveling);
 const companion=(s.recruited??[]).some(id=>{
  if(id===op.id||!capable(s,id))return false;
  const other=presence(s,id,traveling);
  return at.moving?other.moving&&other.party===at.party:!other.moving&&other.sector===at.sector;
 });
 if(companion)return {eligible:true,active:false,reason:'companion'};
 if(s.operativeState[op.id].morale>=50)return {eligible:true,active:false,reason:'morale'};
 return {eligible:true,active:true,reason:'isolated'};
}

// Call once inside the actual hourly morale transition. Only real regrouping
// clears an episode; sleep, treatment, pay and expiry never refund its loss.
export function advanceStrategicIsolation(s,roster,options={}){
 const active=new Set(),messages=[];
 for(const op of roster){
  const r=s.operativeState?.[op.id],status=strategicIsolationStatus(s,op,options);
  if(status.reason==='companion'){delete r.strategicIsolation;continue;}
  if(!status.active)continue;
  active.add(op.id);
  const receipt=r.strategicIsolation;
  if(receipt&&now(s)-(receipt.lastHour*3600+(receipt.lastSecond??0))<3600)continue;
  const loss=Math.min(STRATEGIC_ISOLATION_LOSS,r.morale,STRATEGIC_ISOLATION_LIMIT-(receipt?.loss??0));
  if(loss<=0)continue;
  r.morale=Math.max(0,r.morale-loss);
  r.strategicIsolation={loss:(receipt?.loss??0)+loss,lastHour:s.hour,...(s.secondOfHour?{lastSecond:s.secondOfHour}:{})};
  if(!receipt)messages.push(`${op.name} pierde ánimo al quedar sin compañía militar. Reunirse evita nuevas pérdidas; no devuelve la moral perdida.`);
 }
 return {active,messages};
}

export function validateStrategicIsolation(s,roster){
 for(const op of roster){
  const r=s.operativeState?.[op.id];if(!r||!Object.hasOwn(r,'strategicIsolation'))continue;
  const value=r.strategicIsolation;
  if(!authored(op)||!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).some(key=>!['loss','lastHour','lastSecond'].includes(key))||
     !Number.isFinite(value.loss)||value.loss<=0||value.loss>STRATEGIC_ISOLATION_LIMIT||
     !Number.isSafeInteger(value.lastHour)||value.lastHour<0||
     (Object.hasOwn(value,'lastSecond')&&(!Number.isInteger(value.lastSecond)||value.lastSecond<0||value.lastSecond>=3600))||
     value.lastHour*3600+(value.lastSecond??0)>now(s))throw Error('El temor estratégico guardado es inválido.');
 }
}
