// Optional content keeps existing campaign packages and their saved identities intact.
export const DEFAULT_CONTRACT_RULES=Object.freeze({days:Object.freeze({day:1,week:7,month:30}),salaryMonthDays:30,xpStep:100,xpRaisePercent:10,warningHours:2});
export const CONTRACT_RULE_FIELDS=Object.freeze([
 ['salaryMonthDays','Días usados para calcular la paga diaria',1,90],
 ['xpStep','Experiencia necesaria para cada aumento de paga',1,10000],
 ['xpRaisePercent','Aumento por tramo de experiencia (%)',0,100],
 ['warningHours','Aviso antes del vencimiento (horas)',0,24],
]);
export const contractRules=s=>s?.contentCampaign?.package.contractRules??DEFAULT_CONTRACT_RULES;
export function validateContractRules(value){
 if(value===undefined)return [];
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(!exact(value,['days',...CONTRACT_RULE_FIELDS.map(([key])=>key)])||!exact(value.days,['day','week','month']))return ['Contratos: configurá los tres plazos y todas las reglas, sin campos adicionales.'];
 const errors=CONTRACT_RULE_FIELDS.flatMap(([key,label,min,max])=>integer(value[key],min,max)?[]:[`${label}: elegí un entero de ${min} a ${max}.`]);
 for(const term of ['day','week','month'])if(!integer(value.days[term],1,90))errors.push(`Contratos.${term}: elegí un plazo de 1 a 90 días.`);
 if(!(value.days.day<value.days.week&&value.days.week<value.days.month))errors.push('Contratos: los plazos corto, medio y largo deben aumentar.');
 return errors;
}
