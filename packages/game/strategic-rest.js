import {sleepNeed} from './sleep-needs.js';
import {recoverFatigue} from './fatigue.js';
import {careRules,DEFAULT_CARE_RULES} from './campaign-care-rules.js';
// Explicit strategic rest. Automatic sleep and the global fatigue/energy-capacity
// model are separate integrations; the existing daily recovery is unchanged.
export const REST_HEALING_HOURS=DEFAULT_CARE_RULES.restHealingHours;
export function restRecovery(op,record,state){
 const {hours}=sleepNeed({...op,...record});
 return {hours,energy:Math.floor(careRules(state).restEnergy*8/hours),fatigue:Math.floor(careRules(state).restFatigue*8/hours)};
}
export function recoverAtRest(record,op,{heal=false,state,recover=true}={}){
 const rate=restRecovery(op,record,state),maxHp=record.maxHp??op.maxHp;
 if(recover)recoverFatigue(record,rate.fatigue,rate.energy);
 if(heal&&!record.bleeding&&record.hp>=15&&record.hp<maxHp){
  record.recoveryHours=(record.recoveryHours??0)+1;
  if(record.recoveryHours>=careRules(state).restHealingHours){record.hp++;record.recoveryHours=0;if(record.bandaged!==undefined)record.bandaged=Math.min(record.bandaged,maxHp-record.hp);}
 }else if(record.recoveryHours!==undefined||heal)record.recoveryHours=0;
}
