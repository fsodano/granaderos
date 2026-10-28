import {formatAP} from './action-points.js';
import {CRITICAL_HEALTH} from './tactical-condition.js';
import {civilianMaxHp} from './civilian-harm.js';

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const maxHealth=(patient,kind)=>kind==='npc'?civilianMaxHp(patient):patient?.maxHp??100;
export const criticalFirstAidNeeded=(patient,{targetKind='unit'}={})=>Boolean(patient&&patient.hp>0&&patient.hp<Math.min(CRITICAL_HEALTH,maxHealth(patient,targetKind)));

// Classic first aid spends two work points per restored critical HP, then
// one per remaining bleed point. Its 12-point real-time work budget supplies
// one local stroke in both modes. The existing 25/20/18 AP costs stay intact;
// an AP discount never reduces the work a skilled medic can perform.
// A linen dressing is indivisible: one effective stroke consumes one piece.
// This is the period supply adaptation, not a JA2 kit with condition points.
export function firstAidPlan(doctor,patient,{baseCost=25,budgetAP=Infinity,targetKind='unit'}={}){
 const maxHp=maxHealth(patient,targetKind),hp=patient?.hp??(targetKind==='npc'?maxHp:0),targetHP=Math.min(CRITICAL_HEALTH,maxHp);
 const bleeding=patient?.bleeding??0,wounds=Math.max(0,maxHp-hp),bandaged=clamp(patient?.bandaged??(bleeding?0:wounds),0,wounds);
 const critical=hp>0&&hp<targetHP,deficit=critical?targetHP-hp:0;
 const skill=Math.floor((3*clamp(doctor?.medical??0,0,100)+200+10*clamp(doctor?.experienceLevel??4,1,10)+clamp(doctor?.dexterity??75,0,100))/7);
 const capacity=critical?Math.floor(12*skill/50):0;
 // Saved fractional HP still costs a whole two-point stabilization unit.
 // Only whole restored HP reduces the integer bleeding rate.
 const needed=critical?2*Math.ceil(deficit)+Math.max(0,bleeding-Math.floor(deficit)):0;
 const minimumAP=baseCost;
 const result=(values={})=>({critical,targetHP,hpGain:0,hpAfter:hp,work:0,remainingWork:needed,capacity,skill,dressingsUsed:0,bleedingAfter:bleeding,bandagedAfter:bandaged,complete:false,partial:critical,paCost:minimumAP,minimumAP,valid:false,reason:null,...values});
 if(hp<=0)return result({reason:'El herido debe estar vivo.'});
 if(!(doctor?.medical>0))return result({reason:'Este soldado no tiene conocimientos de primeros auxilios.'});
 if(!(doctor?.medkits>0))return result({reason:'No quedan vendas.'});
 if(budgetAP<baseCost)return result({reason:`${critical?'Estabilizar':'Vendar'} requiere ${formatAP(baseCost)} PA.`});
 if(!critical){
  if(!bleeding&&bandaged>=wounds)return result({reason:'Las heridas ya están vendadas. Necesita recuperación en campaña.'});
  return result({paCost:baseCost,dressingsUsed:1,bleedingAfter:0,bandagedAfter:wounds,complete:true,partial:false,valid:true});
 }
 const available=Math.min(capacity,needed);
 const hpGain=Math.min(deficit,Math.floor(available/2)),healthWork=2*Math.ceil(hpGain);
 const bleedFromHealth=Math.min(bleeding,Math.floor(hpGain)),bleedWork=Math.min(bleeding-bleedFromHealth,available-healthWork);
 const work=healthWork+bleedWork;
 if(!(work>0))return result({reason:'Este sanitario no puede avanzar con el tratamiento.'});
 const hpAfter=hp+hpGain,bleedingAfter=bleeding-bleedFromHealth-bleedWork,remainingDeficit=Math.max(0,targetHP-hpAfter);
 const remainingWork=2*Math.ceil(remainingDeficit)+Math.max(0,bleedingAfter-Math.floor(remainingDeficit));
 const complete=remainingWork===0;
 return result({hpGain,hpAfter,work,remainingWork,dressingsUsed:1,bleedingAfter,bandagedAfter:complete?maxHp-hpAfter:Math.min(bandaged,maxHp-hpAfter),complete,partial:!complete,paCost:baseCost,valid:true});
}
