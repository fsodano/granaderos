// Optional package field: old campaigns retain their original content identity.
export const DEFAULT_MILITIA_PROGRESSION=Object.freeze({regularThreshold:2,veteranThreshold:5,marksmanshipGain:8,leadershipGain:5,levelGain:1});
export const MILITIA_PROGRESSION_FIELDS=Object.freeze([
 ['regularThreshold','Puntos para ascender a montonero',1,99],
 ['veteranThreshold','Puntos para ascender a veterano',2,100],
 ['marksmanshipGain','Puntería ganada por ascenso',0,100],
 ['leadershipGain','Liderazgo ganado por ascenso',0,100],
 ['levelGain','Niveles de experiencia ganados por ascenso',0,9],
]);
export const militiaProgression=s=>s?.contentCampaign?.package.militiaProgression??DEFAULT_MILITIA_PROGRESSION;
export function validateMilitiaProgression(value){
 if(value===undefined)return [];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!MILITIA_PROGRESSION_FIELDS.some(([key])=>key===k))||!MILITIA_PROGRESSION_FIELDS.every(([key])=>Object.hasOwn(value,key)))return ['Ascensos de milicias: configurá todas las reglas, sin campos adicionales.'];
 const errors=MILITIA_PROGRESSION_FIELDS.flatMap(([key,label,min,max])=>Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max?[]:[`${label}: elegí un entero de ${min} a ${max}.`]);
 if(value.veteranThreshold<=value.regularThreshold)errors.push('El ascenso a veterano necesita más puntos que el ascenso a montonero.');
 return errors;
}
