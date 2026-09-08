export const CONTRACT_TERMS={day:{name:'Un día',hours:24,days:1},week:{name:'Una semana',hours:168,days:7},month:{name:'Un mes',hours:720,days:30}};
export function contractQuote(state,operative,term='day'){
 const period=CONTRACT_TERMS[term];const xp=state.operativeState?.[operative.id]?.xp??0;
 const topTier=operative.tier==='elite'||operative.marksmanship>=90||(operative.level??1)>=5;
 const permanent=operative.id<100||operative.id===1000||operative.monthlyPay===0;
 const reason=state.operativeState?.[operative.id]?.alive===false?'Un combatiente fallecido no puede volver a contratarse.':!period?'Elegí un contrato diario, semanal o mensual.':null;
 const daily=Math.max(1,Math.ceil((operative.monthlyPay??0)/30*(1+Math.floor(xp/100)*.1)));
 return {expiresAt:permanent?null:Math.max(state.hour,state.contracts?.[operative.id]?.expiresAt??state.hour)+(period?.hours??0),available:!reason,reason,topTier,permanent,term,hours:permanent?null:period?.hours??0,price:permanent?0:daily*(period?.days??0)};
}
export function contractStatus(state,id){const c=state.contracts?.[id];return c?{...c,remaining:c.expiresAt===null?null:Math.max(0,c.expiresAt-state.hour),active:c.expiresAt===null||c.expiresAt>state.hour}:null;}
export function migrateContracts(state){
 if(!state.contracts)state.contracts=Object.fromEntries(state.recruited.map(id=>[id,{kind:id===1000?'patriot':'legacy',term:'month',started:state.hour,expiresAt:null,paid:0}]));
 return state;
}
