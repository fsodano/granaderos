import {OPERATIVES} from './data.js';
import {operativeIdForCharacter} from './content-character-ids.js';

export const ORIGINAL_CAMPAIGN_ROLES=Object.freeze({foundryEngineer:'person-2',marchCommander:'person-57'});
export function rolesForContent(content){
 if(content?.campaignRoles!==undefined)return content.campaignRoles;
 return Object.fromEntries(Object.entries(ORIGINAL_CAMPAIGN_ROLES).map(([role,id])=>[role,!content||content.characters.some(c=>c.id===id)?id:null]));
}
export function validateCampaignRoles(value,characters){
 if(value===undefined)return [];
 const keys=Object.keys(ORIGINAL_CAMPAIGN_ROLES);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))return ['Funciones de campaña: elegí el responsable de fundición y de marcha, o ninguno.'];
 return keys.flatMap(key=>value[key]===null||typeof value[key]==='string'&&characters.some(c=>c?.id===value[key])?[]:['Funciones de campaña: el personaje asignado no existe.']);
}
export function campaignRole(state,key){
 const content=state.contentCampaign?.package,character=rolesForContent(content)[key];
 if(!character)return null;
 const id=content?operativeIdForCharacter(content,character):Number(character.slice(7));
 const definition=content?content.characters.find(c=>c.id===character):OPERATIVES.find(c=>c.id===id);
 return definition?{id,character,name:definition.nickname||definition.name}:null;
}
export function campaignRoleActive(state,key){
 const role=campaignRole(state,key),record=role&&state.operativeState[role.id],contract=role&&state.contracts?.[role.id];
 return Boolean(role&&state.recruited.includes(role.id)&&record?.alive&&record.hp>0&&!record.captured&&!contract?.departurePending&&(contract?.expiresAt==null||contract.expiresAt>state.hour));
}
export function foundryReason(state){
 const role=campaignRole(state,'foundryEngineer');
 if(!role)return 'Esta campaña no tiene responsable de fundición.';
 if(state.sectors.mendoza.owner!=='patriot')return 'La fundición necesita Mendoza bajo control patriota.';
 if(!campaignRoleActive(state,'foundryEngineer'))return `Incorporá a ${role.name}; debe estar con vida, libre y en servicio.`;
 return null;
}
