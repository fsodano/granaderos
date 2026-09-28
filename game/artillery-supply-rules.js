// Optional campaign data keeps older content identities unchanged. These prices
// and the reserve limit are Granaderos tuning, not historical market values.
export const DEFAULT_ARTILLERY_SUPPLY=Object.freeze({enabled:true,bronze4:20,field8:30,swivel:10,reserveLimit:6});
export const ARTILLERY_SUPPLY_FIELDS=Object.freeze([
 ['bronze4','Munición de 4 libras (pesos)',0,1000000],
 ['field8','Munición de 8 libras (pesos)',0,1000000],
 ['swivel','Munición de pedrero (pesos)',0,1000000],
 ['reserveLimit','Máximo de reserva para reposición',1,1000],
]);
export const artillerySupplyRules=s=>s?.contentCampaign?.package.artillerySupply??DEFAULT_ARTILLERY_SUPPLY;
export function validateArtillerySupply(value){
 if(value===undefined)return [];
 const keys=['enabled',...ARTILLERY_SUPPLY_FIELDS.map(([key])=>key)];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))return ['Munición de artillería: configurá todas las reglas, sin campos adicionales.'];
 const errors=typeof value.enabled==='boolean'?[]:['Munición de artillería: el permiso debe estar activado o desactivado.'];
 return errors.concat(ARTILLERY_SUPPLY_FIELDS.flatMap(([key,label,min,max])=>Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max?[]:[`${label}: elegí un entero de ${min} a ${max}.`]));
}
