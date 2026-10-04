import {hiringPriceMultiplier} from './economy-balance.js';
import {contractRules} from './contract-rules.js';
import {serviceRelationshipRefusal} from './service-relationships.js';
import {serviceObjectionReason} from './service-objections.js';
const termName=days=>days===1?'Un día':days===7?'Una semana':days===14?'Dos semanas':days===30?'Un mes':`${days} días`;
export function contractTermsFor(state){return Object.fromEntries(Object.entries({...contractRules(state).days,fortnight:14}).map(([id,days])=>[id,{name:termName(days),hours:days*24,days}]));}
export const CONTRACT_TERMS=Object.freeze(Object.fromEntries(Object.entries(contractTermsFor()).map(([id,period])=>[id,Object.freeze(period)])));
const campaignSeconds=state=>(Number.isFinite(state.hour)?state.hour:0)*3600+(state.secondOfHour??0);
export function contractExpiresSeconds(contract){return contract?.expiresAt===null||contract?.expiresAt===undefined?null:contract.expiresAt*3600+(contract.expiresSecond??0);}
// Keep old whole-hour save records unchanged; preserve seconds when they matter.
export function contractStartedFields(state,expiresSecond=state.secondOfHour??0){
 const second=state.secondOfHour??0;
 return {started:state.hour,...(second?{startedSecond:second}:{}),...(expiresSecond?{expiresSecond}: {})};
}
export function contractQuote(state,operative,term='day'){
 const rules=contractRules(state),terms=contractTermsFor(state),period=Object.hasOwn(terms,term)?terms[term]:undefined;const xp=state.operativeState?.[operative.id]?.xp??0;
 const topTier=operative.tier==='elite'||operative.marksmanship>=90||(operative.level??1)>=5;
 const permanent=operative.service===undefined?(operative.id<100||operative.id===1000||operative.monthlyPay===0):operative.service==='permanent';
 const refusal=serviceRelationshipRefusal(state,operative),objection=serviceObjectionReason(state,operative);
 const reason=state.operativeState?.[operative.id]?.alive===false?'Un combatiente fallecido no puede volver a contratarse.':state.operativeState?.[operative.id]?.serviceEquipmentReturn?'Recogé todo el equipo que dejó esta persona antes de volver a contratarla.':!period?'Elegí uno de los plazos de contrato disponibles.':objection??refusal?.reason??null;
 const salaryPercent=100+Math.floor(xp/rules.xpStep)*rules.xpRaisePercent;
 const daily=Math.max(operative.service==='contract'?0:1,Math.ceil((operative.monthlyPay??0)*hiringPriceMultiplier(state)*salaryPercent/(rules.salaryMonthDays*100)));
 const now=campaignSeconds(state),expiry=Math.max(now,contractExpiresSeconds(state.contracts?.[operative.id])??now)+(period?.hours??0)*3600;
 return {expiresAt:permanent?null:Math.floor(expiry/3600),expiresSecond:permanent?null:expiry%3600,available:!reason,reason,...(reason===refusal?.reason?{serviceRefusal:refusal}:{}),topTier,permanent,term,hours:permanent?null:period?.hours??0,price:permanent?0:daily*(period?.days??0),daily:permanent?0:daily};
}
export function contractStatus(state,id){const c=state.contracts?.[id],expiry=contractExpiresSeconds(c),now=campaignSeconds(state);return c?{...c,remaining:expiry===null?null:Math.max(0,(expiry-now)/3600),active:expiry===null||expiry>now}:null;}
export function migrateContracts(state){
 if(!state.contracts)state.contracts=Object.fromEntries(state.recruited.map(id=>[id,{kind:id===1000?'patriot':'legacy',term:'month',started:state.hour,expiresAt:null,paid:0}]));
 return state;
}
