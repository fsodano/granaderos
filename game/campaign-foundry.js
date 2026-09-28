import {CAMPAIGN_SECTORS} from './data.js';
import {arrivalFacilityOptions} from './arrival-sites.js';

export const FOUNDRY_LOCATIONS=Object.freeze(CAMPAIGN_SECTORS.filter(s=>arrivalFacilityOptions(s.id).includes('barracks')));
export const DEFAULT_FOUNDRY=Object.freeze({sector:'mendoza',name:'El Plumerillo',armyName:'Ejército de los Andes',setupCost:500,fundingCost:3000});
export const foundryFor=state=>state?.contentCampaign?.package.foundry??DEFAULT_FOUNDRY;
export const foundryLocationName=state=>FOUNDRY_LOCATIONS.find(s=>s.id===foundryFor(state).sector)?.name;
export function validateFoundry(value){
 if(value===undefined)return [];
 const keys=Object.keys(DEFAULT_FOUNDRY);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))return ['Fundición: configurá su ubicación, nombres y dos costos.'];
 const errors=[];
 if(!FOUNDRY_LOCATIONS.some(s=>s.id===value.sector))errors.push('Fundición: elegí una localidad terrestre con instalaciones, no un paso ni una celda de agua.');
 for(const key of ['name','armyName'])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>100)errors.push('Fundición: cada nombre necesita entre 1 y 100 caracteres.');
 for(const key of ['setupCost','fundingCost'])if(!Number.isSafeInteger(value[key])||value[key]<0||value[key]>1000000)errors.push('Fundición: cada costo debe ser un número entero entre 0 y 1000000 pesos.');
 return errors;
}
