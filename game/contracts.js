import {contractRules} from './contract-rules.js';
const termName=days=>days===1?'Un día':days===7?'Una semana':days===30?'Un mes':`${days} días`;
export function contractTermsFor(state){return Object.fromEntries(Object.entries(contractRules(state).days).map(([id,days])=>[id,{name:termName(days),hours:days*24,days}]));}
export const CONTRACT_TERMS=Object.freeze(Object.fromEntries(Object.entries(contractTermsFor()).map(([id,period])=>[id,Object.freeze(period)])));
export function contractQuote(state,operative,term='day'){
 const rules=contractRules(state),terms=contractTermsFor(state),period=Object.hasOwn(terms,term)?terms[term]:undefined;const xp=state.operativeState?.[operative.id]?.xp??0;
 const topTier=operative.tier==='elite'||operative.marksmanship>=90||(operative.level??1)>=5;
 const permanent=operative.service===undefined?(operative.id<100||operative.id===1000||operative.monthlyPay===0):operative.service==='permanent';
 const reason=state.operativeState?.[operative.id]?.alive===false?'Un combatiente fallecido no puede volver a contratarse.':state.operativeState?.[operative.id]?.serviceEquipmentReturn?'Recogé todo el equipo que dejó esta persona antes de volver a contratarla.':!period?'Elegí uno de los plazos de contrato disponibles.':null;
 const daily=Math.max(operative.service==='contract'?0:1,Math.ceil((operative.monthlyPay??0)/rules.salaryMonthDays*(1+Math.floor(xp/rules.xpStep)*(rules.xpRaisePercent/100))));
 const now=Number.isFinite(state.hour)?state.hour:0;
 return {expiresAt:permanent?null:Math.max(now,state.contracts?.[operative.id]?.expiresAt??now)+(period?.hours??0),available:!reason,reason,topTier,permanent,term,hours:permanent?null:period?.hours??0,price:permanent?0:daily*(period?.days??0),daily:permanent?0:daily};
}
export function contractStatus(state,id){const c=state.contracts?.[id];return c?{...c,remaining:c.expiresAt===null?null:Math.max(0,c.expiresAt-state.hour),active:c.expiresAt===null||c.expiresAt>state.hour}:null;}
export function migrateContracts(state){
 if(!state.contracts)state.contracts=Object.fromEntries(state.recruited.map(id=>[id,{kind:id===1000?'patriot':'legacy',term:'month',started:state.hour,expiresAt:null,paid:0}]));
 return state;
}
