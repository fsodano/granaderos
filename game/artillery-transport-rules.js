// Transport rates and charges are game tuning. Omission retains older packages.
export const DEFAULT_ARTILLERY_TRANSPORT=Object.freeze({enabled:true,cartsHours:18,flotillaHours:5,cartsFee:0,flotillaFee:0});
export const ARTILLERY_TRANSPORT_FIELDS=Object.freeze([
 ['cartsHours','Horas por tramo en carreta',1,168],
 ['flotillaHours','Horas por tramo en flotilla',1,168],
 ['cartsFee','Precio por pieza enviada en carreta (pesos)',0,1000000],
 ['flotillaFee','Precio por pieza enviada en flotilla (pesos)',0,1000000],
]);
export const artilleryTransportRules=s=>s?.contentCampaign?.package.artilleryTransport??DEFAULT_ARTILLERY_TRANSPORT;
export function validateArtilleryTransportRules(value){
 if(value===undefined)return [];
 const keys=['enabled',...ARTILLERY_TRANSPORT_FIELDS.map(([key])=>key)];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))return ['Traslado de artillería: configurá todas las reglas, sin campos adicionales.'];
 const errors=typeof value.enabled==='boolean'?[]:['Traslado de artillería: el permiso debe estar activado o desactivado.'];
 return errors.concat(ARTILLERY_TRANSPORT_FIELDS.flatMap(([key,label,min,max])=>Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max?[]:[`${label}: elegí un entero de ${min} a ${max}.`]));
}
