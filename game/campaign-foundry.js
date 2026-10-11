import {campaignWorld,campaignSectors,campaignDefinitions} from './campaign-definition.js';
import {arrivalFacilityOptions} from './arrival-sites.js';

export const foundryLocations=context=>campaignSectors(context).filter(s=>arrivalFacilityOptions(s.id,context).includes('barracks'));
export const FOUNDRY_LOCATIONS=Object.freeze(foundryLocations());
export const DEFAULT_FOUNDRY=Object.freeze(campaignWorld().defaultFoundry);
export const foundryFor=state=>{const content=campaignDefinitions(state);if(content?.foundry)return content.foundry;if(content?.world?.defaultFoundry)return content.world.defaultFoundry;if(content?.scenario==='generic-v1'||content?.campaignStory)return {sector:content.headquarters??content.world?.defaultHeadquarters??campaignSectors(state)[0]?.id,name:'Taller del cuartel',armyName:'Fuerza de campaña',setupCost:0,fundingCost:0};return campaignWorld(state).defaultFoundry??DEFAULT_FOUNDRY;};
export const foundryLocationName=state=>foundryLocations(state).find(s=>s.id===foundryFor(state).sector)?.name;
export function validateFoundry(value,context=null){
 if(value===undefined)return [];
 const keys=Object.keys(DEFAULT_FOUNDRY);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))return ['Fundición: configurá su ubicación, nombres y dos costos.'];
 const errors=[];
 if(!foundryLocations(context).some(s=>s.id===value.sector))errors.push('Fundición: elegí una localidad terrestre con instalaciones, no un paso ni una celda de agua.');
 for(const key of ['name','armyName'])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>100)errors.push('Fundición: cada nombre necesita entre 1 y 100 caracteres.');
 for(const key of ['setupCost','fundingCost'])if(!Number.isSafeInteger(value[key])||value[key]<0||value[key]>1000000)errors.push('Fundición: cada costo debe ser un número entero entre 0 y 1000000 pesos.');
 return errors;
}
