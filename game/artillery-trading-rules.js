import {CAMPAIGN_SECTORS} from './data.js';
export const DEFAULT_ARTILLERY_TRADING=Object.freeze({enabled:true,initialCash:1200,buyPercent:40,resalePercent:80,buyingOverrides:Object.freeze({cordoba:30,mendoza:50})});
export const ARTILLERY_TRADING_FIELDS=Object.freeze([
 ['initialCash','Fondos iniciales de cada taller (pesos)',0,1000000],
 ['buyPercent','Pago general del taller (% del precio)',0,100],
 ['resalePercent','Precio de recompra (% del precio)',0,100],
]);
export const artilleryTradingRules=s=>s?.contentCampaign?.package.artilleryTrading??DEFAULT_ARTILLERY_TRADING;
export const artilleryBuyingPercent=s=>artilleryTradingRules(s).buyingOverrides[s.location]??artilleryTradingRules(s).buyPercent;
export function validateArtilleryTradingRules(value){
 if(value===undefined)return [];
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),keys=['enabled','initialCash','buyPercent','resalePercent','buyingOverrides'];
 if(!object(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))return ['Comercio de artillería: configurá todas las reglas, sin campos adicionales.'];
 const errors=typeof value.enabled==='boolean'?[]:['Comercio de artillería: el permiso debe estar activado o desactivado.'];
 for(const [key,label,min,max]of ARTILLERY_TRADING_FIELDS)if(!Number.isSafeInteger(value[key])||value[key]<min||value[key]>max)errors.push(`${label}: elegí un entero de ${min} a ${max}.`);
 if(!object(value.buyingOverrides)||Object.entries(value.buyingOverrides).some(([id,n])=>!CAMPAIGN_SECTORS.some(s=>s.id===id)||!Number.isSafeInteger(n)||n<0||n>100))errors.push('Comercio de artillería: cada precio local necesita una localidad existente y un porcentaje de 0 a 100.');
 return errors;
}
