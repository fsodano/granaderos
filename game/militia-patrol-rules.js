// Optional authoring preserves the content identity of older campaigns.
export const DEFAULT_MILITIA_PATROL=Object.freeze({enabled:true,waypointTicks:8,energyReserve:50,restEnergy:10});
export const MILITIA_PATROL_FIELDS=Object.freeze([
 ['waypointTicks','Intervalos por punto de patrulla',1,60],
 ['energyReserve','Energía que reserva la patrulla',0,95],
 ['restEnergy','Energía recuperada al descansar la patrulla',1,100],
]);
export const militiaPatrolRules=s=>s?.contentCampaign?.package.militiaPatrol??s?.militiaPatrol??DEFAULT_MILITIA_PATROL;
export function validateMilitiaPatrol(value){
 if(value===undefined)return [];
 const keys=['enabled',...MILITIA_PATROL_FIELDS.map(([key])=>key)];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))return ['Patrullas de milicias: configurá todas las reglas, sin campos adicionales.'];
 const errors=typeof value.enabled==='boolean'?[]:['Patrullas de milicias: el estado debe estar activado o desactivado.'];
 return errors.concat(MILITIA_PATROL_FIELDS.flatMap(([key,label,min,max])=>Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max?[]:[`${label}: elegí un entero de ${min} a ${max}.`]));
}
export function validateCampaignPatrol(campaign,scene){
 if(!scene)return;
 const expected=campaign.contentCampaign?.package.militiaPatrol??DEFAULT_MILITIA_PATROL,actual=scene.militiaPatrol??DEFAULT_MILITIA_PATROL;
 if(validateMilitiaPatrol(scene.militiaPatrol).length||!Object.keys(DEFAULT_MILITIA_PATROL).every(key=>actual[key]===expected[key]))throw Error('Las reglas de patrulla no coinciden con la campaña.');
}
