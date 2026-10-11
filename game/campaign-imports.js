import {campaignSectors,campaignDefinitions} from './campaign-definition.js';
import {DEFAULT_CONTENT} from '../campaigns/default.js';
import {arrivalFacilityOptions} from './arrival-sites.js';

export const importPortsFor=context=>campaignSectors(context).filter(s=>arrivalFacilityOptions(s.id,context).includes('port'));
export const IMPORT_PORTS=Object.freeze(importPortsFor());
export const DEFAULT_IMPORT_RULES=Object.freeze(DEFAULT_CONTENT.imports);
export const importRulesFor=state=>campaignDefinitions(state)?.imports??(campaignDefinitions(state)?.scenario==='generic-v1'?{port:null,minHours:72,maxHours:120}:DEFAULT_IMPORT_RULES);
export const importPortName=state=>{const port=importPortsFor(state).find(s=>s.id===importRulesFor(state).port);return port?.shortName??port?.name;};
export function validateImportRules(value,context=null){
 if(value===undefined)return [];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==3||!['port','minHours','maxHours'].every(k=>Object.hasOwn(value,k)))return ['Importaciones: configurá el puerto y los dos plazos de entrega.'];
 const errors=[];
 if(value.port!==null&&!importPortsFor(context).some(s=>s.id===value.port))errors.push('Importaciones: elegí un puerto con acceso al río navegable, o deshabilitá los pedidos.');
 if(!Number.isInteger(value.minHours)||!Number.isInteger(value.maxHours)||value.minHours<1||value.maxHours>720||value.minHours>value.maxHours)errors.push('Importaciones: los plazos deben ser horas enteras entre 1 y 720, con el mínimo no mayor que el máximo.');
 return errors;
}
export function importOrderReason(state){
 if(importRulesFor(state).port===null)return 'Esta campaña no permite pedidos de armas importadas.';
 if(state.sectors[importRulesFor(state).port]?.owner!=='patriot')return `Las importaciones requieren ${importPortName(state)} bajo control patriota.`;
 if(state.reputation.foreign<0)return 'Los comerciantes extranjeros no están dispuestos a negociar.';
 return null;
}
export function importDelayReason(state){
 if(importRulesFor(state).port===null)return 'Importaciones deshabilitadas';
 if(state.sectors[importRulesFor(state).port]?.owner!=='patriot')return 'Demorado por ocupación del puerto';
 if(state.blockade)return 'Demorado por bloqueo';
 return null;
}
