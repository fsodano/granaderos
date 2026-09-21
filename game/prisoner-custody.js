// Capture pauses the unused portion of a contract. Neither the status panel
// nor release may charge for, or grant service during, detention.
export function captiveServiceHours(record){
 if(!record?.captured||!record.capturedContract)return undefined;
 return record.capturedContract.expiresAt===null?null:Math.max(0,record.capturedContract.expiresAt-record.capturedAt);
}
export function restoredCaptiveContract(record,hour){
 const remaining=captiveServiceHours(record);
 if(remaining===undefined)throw Error('El combatiente no tiene un contrato en cautiverio.');
 if(remaining===0)return null;
 const contract=structuredClone(record.capturedContract);delete contract.departurePending;
 if(remaining!==null)contract.expiresAt=hour+remaining;
 return contract;
}
export function prisonerStatus(state,operative){
 const record=state.operativeState[operative.id];
 if(!record?.captured)return null;
 const care=state.detentionRecords?.[`captive:${operative.id}:${record.capturedAt}`]?.care??[];
 return {id:operative.id,name:operative.name,sector:record.capturedSector,hp:record.hp,maxHp:record.maxHp??operative.maxHp,
  capturedAt:record.capturedAt,heldHours:Math.max(0,state.hour-record.capturedAt),serviceHours:captiveServiceHours(record),
  careDressings:care.reduce((sum,event)=>sum+event.dressings,0),lastCareHour:care.at(-1)?.hour??null,
  needsCare:record.hp<(record.maxHp??operative.maxHp)||Boolean(record.bleeding),critical:record.hp<15};
}
