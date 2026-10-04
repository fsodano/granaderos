import {operativeLocation} from './squads.js';
import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';
import {CRITICAL_HEALTH,isUnconscious} from './actor-condition.js';
import {preferredCompanions,PREFERRED_COMPANION_MORALE} from './service-relationships.js';

const clamp=n=>Math.max(0,Math.min(100,n));
const deployed=(s,id)=>Boolean(s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id)));
const pairKey=(a,b)=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const originals=new Map([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,o]));
const preferences=(s,id)=>preferredCompanions(s,originals.get(Number(id))??{id:Number(id)});
const ableCompanion=r=>Boolean(r&&r.alive!==false&&!r.asleep&&!r.captured&&!r.departure&&!r.surrendered&&r.hp>=CRITICAL_HEALTH&&!isUnconscious(r));
export const COHESION_HOURS=120;
export const baseMorale=op=>Math.min(100,(op.personality==='optimistic'?90:op.personality==='pessimistic'?70:80)+(op.traits?.includes('steadfast')?10:0));

export function migrateMorale(s,roster){
  if(s.cohesion===undefined)s.cohesion={};
  for(const op of roster){const r=s.operativeState[op.id];if(!r)continue;
    if(r.morale===undefined)r.morale=baseMorale(op);
    if(r.moraleRestHours===undefined)r.moraleRestHours=0;
    if(r.lastMoralePayAt===undefined)r.lastMoralePayAt=null;
  }
  for(const unit of s.pendingBattle?.squad??[]){
    if(unit.personalMorale===undefined)unit.personalMorale=unit.morale??s.operativeState[Number(unit.id)]?.morale;
    if(unit.cohesionBonus===undefined)unit.cohesionBonus=0;
    if(unit.morale===undefined)unit.morale=unit.personalMorale;
    // Earlier deployments subtracted fractional morale to recover the bonus.
    // Accept only that calculation's roundoff, with the exact capped total.
    if(unit.cohesionBonus>5&&unit.cohesionBonus<=5+Number.EPSILON*100&&unit.morale===unit.personalMorale+5)unit.cohesionBonus=5;
  }
  return s;
}

export function cohesionBonus(s,id){
  const squad=s.squads?.find(q=>q.members.includes(Number(id)));
  const partners=(squad?.members??[]).filter(other=>other!==Number(id)&&s.recruited.includes(other)&&s.operativeState[other]?.alive);
  return Math.min(5,Math.floor(Math.max(0,...partners.map(other=>s.cohesion?.[pairKey(id,other)]??0))/24));
}

export function deploymentMorale(s,id,cohortIds=[]){
  const personalMorale=s.operativeState[id].morale;
  const bonus=Math.min(cohesionBonus(s,id),100-personalMorale);
  const available=Math.min(PREFERRED_COMPANION_MORALE,5-bonus,100-personalMorale-bonus);
  const cohort=new Set(cohortIds.map(Number));
  const companion=available>0&&preferences(s,id).find(p=>p.companionId!==Number(id)&&cohort.has(p.companionId)&&s.recruited.includes(p.companionId)&&ableCompanion(s.operativeState[p.companionId]));
  // This receipt is fixed at issue. Later joins, wounds or contract expiry do
  // not refresh it or alter the personal morale returned from this deployment.
  const companionBonus=companion?available:0;
  return {morale:personalMorale+bonus+companionBonus,personalMorale,cohesionBonus:bonus,...(companion?{companionBonus,companionId:companion.companionId}:{})};
}

export function returnMorale(s,id,report,issued){
  const r=s.operativeState[id],reported=report.morale??issued?.morale??r.morale;
  need(Number.isFinite(reported)&&reported>=0&&reported<=100,'La moral del parte es inválida.');
  const bonus=(issued?.cohesionBonus??0)+(issued?.companionBonus??0),personal=issued?.personalMorale??r.morale;
  // Preserve strategic events (such as pay) that occurred while this soldier was
  // deployed, and remove only the actual bonus added to this deployment.
  // Apply the tactical change to the current personal value. Returning an
  // unchanged deployment must not introduce a subtraction rounding error.
  r.morale=clamp(r.morale+(reported-(issued?.morale??personal+bonus)));r.moraleRestHours=0;
}

export function recordPayMorale(s,ids,paid){
  for(const id of ids){const r=s.operativeState[id];if(!r?.alive)continue;
    if(paid){if(r.lastMoralePayAt!==null&&s.hour-r.lastMoralePayAt<24)continue;r.morale=clamp(r.morale+2);r.lastMoralePayAt=s.hour;}
    else r.morale=clamp(r.morale-10);
  }
}

export function recordCasualtyMorale(s,casualties,companions=null){
  for(const id of s.recruited){const r=s.operativeState[id];if(!r?.alive||casualties.includes(id))continue;
    const squad=s.squads?.find(q=>q.members.includes(id));
    if(companions&&!companions.includes(id))continue;
    const losses=casualties.filter(dead=>companions?companions.includes(dead):squad?.members.includes(dead));
    const penalty=losses.reduce((sum,dead)=>sum+6+Math.floor((s.cohesion?.[pairKey(id,dead)]??0)/40),0);
    r.morale=clamp(r.morale-Math.min(18,penalty));
  }
}

function addCohesion(s,a,b,hours){const key=pairKey(a,b);s.cohesion[key]=Math.min(COHESION_HOURS,(s.cohesion[key]??0)+hours);}

export function recordBattleMorale(s,request,outcome,snapshot){
  const ids=request.squad.map(u=>Number(u.id)),living=ids.filter(id=>s.operativeState[id]?.alive),dead=ids.filter(id=>!s.operativeState[id]?.alive);
  for(const id of living)s.operativeState[id].morale=clamp(s.operativeState[id].morale+({victory:6,retreat:-5,defeat:-10}[outcome]??0));
  recordCasualtyMorale(s,dead,ids);
  if((snapshot?.elapsedSeconds??0)>0)for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++)addCohesion(s,living[i],living[j],12);
}

export function advanceMorale(s,roster,{traveling=[]}={}){
  const moving=new Set(traveling);
  const safe=id=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&!deployed(s,id)&&!moving.has(id)&&s.sectors[operativeLocation(s,id)]?.owner==='patriot'&&s.pendingBattle?.sector!==operativeLocation(s,id);
  for(const op of roster){const r=s.operativeState[op.id];if(!r)continue;
    if(safe(op.id)&&['rest','patient'].includes(r.assignment)&&r.hp>=15&&!r.bleeding&&r.energy>=60&&r.morale<baseMorale(op)){
      r.moraleRestHours++;
      if(r.moraleRestHours>=6){r.morale=Math.min(baseMorale(op),r.morale+1);r.moraleRestHours=0;}
    }else r.moraleRestHours=0;
  }
  for(const squad of s.squads??[]){const ids=squad.members.filter(safe);
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)addCohesion(s,ids[i],ids[j],1);
  }
}

export function moraleStatus(s,id){
  const r=s.operativeState[id],bonus=cohesionBonus(s,id);
  return `Moral ${Math.round(r.morale)} · ${r.morale<30?'ánimo bajo':r.morale<65?'ánimo moderado':'ánimo firme'}${bonus?` · compañerismo +${bonus} al desplegar`:''}`;
}

export function validateMorale(s,roster){
  migrateMorale(s,roster);const ids=new Set(roster.map(o=>o.id));
  need(s.cohesion&&typeof s.cohesion==='object'&&!Array.isArray(s.cohesion)&&Object.keys(s.cohesion).length<=4000,'El compañerismo guardado es inválido.');
  for(const [key,hours] of Object.entries(s.cohesion)){
    const pair=key.split(':').map(Number);
    need(/^\d+:\d+$/.test(key)&&pair.length===2&&pair[0]<pair[1]&&pair.every(id=>ids.has(id))&&key===pairKey(...pair)&&Number.isInteger(hours)&&hours>0&&hours<=COHESION_HOURS,'El servicio compartido guardado es inválido.');
  }
  for(const op of roster){const r=s.operativeState[op.id];
    need(Number.isFinite(r.morale)&&r.morale>=0&&r.morale<=100,'La moral guardada es inválida.');
    need(Number.isInteger(r.moraleRestHours)&&r.moraleRestHours>=0&&r.moraleRestHours<6,'La recuperación de moral guardada es inválida.');
    need(r.lastMoralePayAt===null||(Number.isInteger(r.lastMoralePayAt)&&r.lastMoralePayAt>=0&&r.lastMoralePayAt<=s.hour),'El pago de moral guardado es inválido.');
  }
  for(const unit of s.pendingBattle?.squad??[]){
    if(unit.morale!==undefined)need(Number.isFinite(unit.morale)&&unit.morale>=0&&unit.morale<=100,'La moral del despliegue es inválida.');
    const hasCompanion=Object.hasOwn(unit,'companionBonus');
    need(hasCompanion===Object.hasOwn(unit,'companionId'),'El apoyo del compañero desplegado está incompleto.');
    if(hasCompanion){
      const companion=s.pendingBattle.squad.find(other=>Number(other.id)===unit.companionId);
      need(Number.isInteger(unit.companionId)&&unit.companionId!==Number(unit.id)&&Number.isFinite(unit.companionBonus)&&unit.companionBonus>0&&unit.companionBonus<=PREFERRED_COMPANION_MORALE&&ableCompanion(companion)&&preferences(s,unit.id).some(p=>p.companionId===unit.companionId),'El apoyo del compañero desplegado es inválido.');
    }
    if(unit.personalMorale!==undefined||unit.cohesionBonus!==undefined)need(Number.isFinite(unit.personalMorale)&&unit.personalMorale>=0&&unit.personalMorale<=100&&Number.isFinite(unit.cohesionBonus)&&unit.cohesionBonus>=0&&unit.cohesionBonus+(unit.companionBonus??0)<=5&&unit.morale===unit.personalMorale+unit.cohesionBonus+(unit.companionBonus??0),'El compañerismo del despliegue es inválido.');
  }
}
