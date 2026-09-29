import {AMMUNITION_FAMILIES} from './ammunition-families.js';
import {arrivalFacilityOptions} from './arrival-sites.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {cartridgePrice} from './campaign-rules.js';

const keys=Object.keys(AMMUNITION_FAMILIES);
export const AMMUNITION_MARKET_LOCATIONS=CAMPAIGN_SECTORS.filter(s=>arrivalFacilityOptions(s.id).length>0);
export const DEFAULT_AMMUNITION_MARKET=Object.freeze({
 enabled:true,automaticPurchase:true,restockHours:24,
 families:Object.freeze(Object.fromEntries(keys.map(key=>{const n=AMMUNITION_FAMILIES[key].legacyTypes.length;return [key,Object.freeze({initial:60*n,capacity:60*n,replenish:6*n,price:null})];}))),
});
export const ammunitionMarketRules=(s,at)=>{
 const authored=s?.contentCampaign?.package.ammunitionMarket;
 return authored?.locations?.[at]??authored?.defaults??DEFAULT_AMMUNITION_MARKET;
};
export const ammunitionUnitPrice=(s,at,key)=>ammunitionMarketRules(s,at).families[key]?.price??cartridgePrice(s);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const shape=(v,fields)=>object(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
function profileErrors(p,label){
 if(!shape(p,['enabled','automaticPurchase','restockHours','families']))return [`${label}: completá las reglas sin campos adicionales.`];
 const errors=[];
 if(typeof p.enabled!=='boolean'||typeof p.automaticPurchase!=='boolean')errors.push(`${label}: los permisos deben estar activados o desactivados.`);
 if(!Number.isSafeInteger(p.restockHours)||p.restockHours<1||p.restockHours>720)errors.push(`${label}: la reposición requiere entre 1 y 720 horas.`);
 if(!shape(p.families,keys))return [...errors,`${label}: configurá las cuatro familias de munición.`];
 for(const key of keys){const f=p.families[key];if(!shape(f,['initial','capacity','replenish','price'])||!['initial','capacity','replenish'].every(k=>count(f[k]))||f.initial>f.capacity||!(f.price===null||count(f.price)))errors.push(`${label}, ${AMMUNITION_FAMILIES[key].name}: usá cantidades enteras de 0 a 1000000, existencias iniciales no mayores que el máximo y un precio válido.`);}
 return errors;
}
export function validateAmmunitionMarket(value){
 if(value===undefined)return [];
 if(!shape(value,['defaults','locations'])||!object(value.locations))return ['Proveedores de munición: configurá las reglas generales y las localidades.'];
 const errors=profileErrors(value.defaults,'Proveedores de munición');
 for(const [at,p]of Object.entries(value.locations)){
  const place=AMMUNITION_MARKET_LOCATIONS.find(s=>s.id===at);
  if(!place)errors.push(`Proveedor de munición: la localidad ${at} no admite abastecimiento.`);
  errors.push(...profileErrors(p,place?.name??at));
 }
 return errors;
}
