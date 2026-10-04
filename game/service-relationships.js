import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';
import {characterForOperative,legacyOperativeId,operativeIdForCharacter} from './content-character-ids.js';

export const SERVICE_REFUSAL_LIMIT=3;
export const SERVICE_REFUSAL_REASON_LIMIT=300;
export const PREFERRED_COMPANION_MORALE=3;
export const PREFERRED_COMPANION_LIMIT=3;

// Preferences belong to definitions, not changing morale or a rolled event.
// An older pinned package without this field remains neutral.
export function serviceRelationships(state,operative){
 const content=state?.contentCampaign?.package;
 const definition=content?(Array.isArray(content.characters)?characterForOperative(state,operative.id):null):operative;
 return (definition?.serviceRefusals??[]).map(preference=>{
  const rivalId=content?operativeIdForCharacter(content,preference.character):legacyOperativeId(preference.character);
  const rival=content?content.characters.find(c=>c.id===preference.character):[...OPERATIVES,...CIVIC_RECRUITS].find(o=>o.id===rivalId);
  return {...preference,rivalId,rivalName:rival?.name??preference.character};
 });
}

export function preferredCompanions(state,operative){
 if(!operative)return [];
 const content=state?.contentCampaign?.package;
 const definition=content?(Array.isArray(content.characters)?characterForOperative(state,operative.id):null):operative;
 return (definition?.preferredCompanions??[]).map(preference=>{
  const companionId=content?operativeIdForCharacter(content,preference.character):legacyOperativeId(preference.character);
  const companion=content?content.characters.find(c=>c.id===preference.character):[...OPERATIVES,...CIVIC_RECRUITS].find(o=>o.id===companionId);
  return {...preference,companionId,companionName:companion?.name??preference.character};
 });
}

export function serviceRelationshipRefusal(state,operative){
 if(!operative)return null;
 const now=(state?.hour??0)*3600+(state?.secondOfHour??0);
 for(const relationship of serviceRelationships(state,operative)){
  const id=relationship.rivalId,record=state?.operativeState?.[id],contract=state?.contracts?.[id];
  if(!state?.recruited?.includes(id)||!record?.alive||record.hp<=0||record.captured||!contract)continue;
  const expiry=contract.expiresAt==null?null:contract.expiresAt*3600+(contract.expiresSecond??0);
  if(expiry!==null&&expiry<=now)continue;
  return {...relationship,reason:`${operative.name} no acepta contratarse ni renovar mientras ${relationship.rivalName} siga en servicio. ${relationship.reason}`};
 }
 return null;
}

export function validateServiceRefusals(character,characters){
 const preferences=character.serviceRefusals;
 if(preferences===undefined)return [];
 const fail=message=>[`${character.id}: ${message}`];
 if(!Array.isArray(preferences)||preferences.length>SERVICE_REFUSAL_LIMIT)return fail(`elegí hasta ${SERVICE_REFUSAL_LIMIT} rechazos de servicio.`);
 const seen=new Set();
 for(const preference of preferences){
  if(!preference||typeof preference!=='object'||Array.isArray(preference)||Object.keys(preference).length!==2||!Object.hasOwn(preference,'character')||!Object.hasOwn(preference,'reason')||!characters.has(preference.character)||preference.character===character.id||seen.has(preference.character))return fail('el rechazo necesita otro personaje existente, sin repetir.');
  if(typeof preference.reason!=='string'||!preference.reason.trim()||preference.reason.length>SERVICE_REFUSAL_REASON_LIMIT||/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(preference.reason))return fail(`el motivo del rechazo debe tener de 1 a ${SERVICE_REFUSAL_REASON_LIMIT} caracteres, sin símbolos de marcado.`);
  seen.add(preference.character);
 }
 return [];
}

export function validatePreferredCompanions(character,characters){
 const preferences=character.preferredCompanions;
 if(preferences===undefined)return [];
 const fail=message=>[`${character.id}: ${message}`];
 if(!Array.isArray(preferences)||preferences.length>PREFERRED_COMPANION_LIMIT)return fail(`elegí hasta ${PREFERRED_COMPANION_LIMIT} compañeros preferidos.`);
 const seen=new Set();
 for(const preference of preferences){
  if(!preference||typeof preference!=='object'||Array.isArray(preference)||Object.keys(preference).length!==2||!Object.hasOwn(preference,'character')||!Object.hasOwn(preference,'reason')||!characters.has(preference.character)||preference.character===character.id||seen.has(preference.character))return fail('la preferencia necesita otro personaje existente, sin repetir.');
  if(typeof preference.reason!=='string'||!preference.reason.trim()||preference.reason.length>SERVICE_REFUSAL_REASON_LIMIT||/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(preference.reason))return fail(`el motivo de la preferencia debe tener de 1 a ${SERVICE_REFUSAL_REASON_LIMIT} caracteres, sin símbolos de marcado.`);
  if(Array.isArray(character.serviceRefusals)&&character.serviceRefusals.some(refusal=>refusal?.character===preference.character))return fail('la misma persona no puede ser un compañero preferido y un rechazo de servicio.');
  seen.add(preference.character);
 }
 return [];
}
