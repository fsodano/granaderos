import {detentionId} from './capture-identity.js';
import {contractExpiresSeconds} from './contracts.js';
// Capture pauses the unused portion of a contract. Neither the status panel
// nor release may charge for, or grant service during, detention.
export function captiveServiceHours(record){
 if(!record?.captured||!record.capturedContract)return undefined;
 const expiry=contractExpiresSeconds(record.capturedContract);
 return expiry===null?null:Math.max(0,expiry-record.capturedAt*3600-(record.capturedAtSecond??0))/3600;
}
export function restoredCaptiveContract(record,hour,secondOfHour=0){
 const remaining=captiveServiceHours(record);
 if(remaining===undefined)throw Error('El combatiente no tiene un contrato en cautiverio.');
 if(remaining===0)return null;
 const contract=structuredClone(record.capturedContract);delete contract.departurePending;
 if(remaining!==null){
  const expiry=hour*3600+secondOfHour+Math.round(remaining*3600);
  contract.expiresAt=Math.floor(expiry/3600);
  if(expiry%3600||contract.expiresSecond!==undefined)contract.expiresSecond=expiry%3600;
 }
 return contract;
}
export function prisonerStatus(state,operative){
 const record=state.operativeState[operative.id];
 if(!record?.captured)return null;
 const care=state.detentionRecords?.[detentionId(operative.id,record)]?.care??[];
 return {id:operative.id,name:operative.name,sector:record.capturedSector,hp:record.hp,maxHp:record.maxHp??operative.maxHp,
  capturedAt:record.capturedAt,capturedAtSecond:record.capturedAtSecond??0,heldHours:Math.max(0,state.hour*3600+(state.secondOfHour??0)-record.capturedAt*3600-(record.capturedAtSecond??0))/3600,serviceHours:captiveServiceHours(record),
  careDressings:care.reduce((sum,event)=>sum+event.dressings,0),lastCareHour:care.at(-1)?.hour??null,
  needsCare:record.hp<(record.maxHp??operative.maxHp)||Boolean(record.bleeding),critical:record.hp<15};
}
