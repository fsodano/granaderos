export const DEFAULT_CARE_RULES=Object.freeze({minimumSkill:20,baseHealing:2,skillStep:20,dressingPrice:10,energyCost:3,fatigueCost:2,restEnergy:12,restFatigue:8,restHealingHours:6});
export const CARE_RULE_FIELDS=Object.freeze([
 ['minimumSkill','Medicina mínima para atender',0,100],
 ['baseHealing','Salud recuperada por hora (base)',1,100],
 ['skillStep','Puntos de medicina por cada salud adicional',1,100],
 ['dressingPrice','Precio de cada venda (pesos)',0,10000],
 ['energyCost','Energía gastada por hora de atención',0,100],
 ['fatigueCost','Fatiga por hora de atención',0,100],
 ['restEnergy','Energía por hora de descanso (base)',0,100],
 ['restFatigue','Fatiga recuperada por hora de descanso (base)',0,100],
 ['restHealingHours','Horas de descanso por cada punto de salud',1,168],
]);
export const DEFAULT_STRATEGIC_BLEEDING_PERCENT=25;
export const STRATEGIC_BLEEDING_FIELD=['bleedingDamagePercent','Daño horario de hemorragia (%)',0,100];
export const strategicBleedingPercent=s=>careRules(s).bleedingDamagePercent??DEFAULT_STRATEGIC_BLEEDING_PERCENT;
export function validateCareRules(value){
 if(value===undefined)return [];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!CARE_RULE_FIELDS.some(([key])=>key===k)&&k!=='bleedingDamagePercent')||!CARE_RULE_FIELDS.every(([key])=>Object.hasOwn(value,key)))return ['Atención y descanso: configurá todas las reglas, sin campos adicionales.'];
 return [...CARE_RULE_FIELDS,...(Object.hasOwn(value,'bleedingDamagePercent')?[STRATEGIC_BLEEDING_FIELD]:[])].flatMap(([key,label,min,max])=>Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max?[]:[`${label}: elegí un entero de ${min} a ${max}.`]);
}
export const careRules=s=>s?.contentCampaign?.package.careRules??DEFAULT_CARE_RULES;
