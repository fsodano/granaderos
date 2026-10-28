import {equipmentKey} from './equipment-catalog.js';
import {storeEquipment,takeEquipment,addEquipment,storedEquipmentStack,storedEquipmentMetadata,validateEquipmentStorage,migrateEquipmentStorage} from './stored-equipment.js';
import {handRecord,handMetadata,inventoryUsage} from './tactical-inventory.js';
import {syncCarriedAmmunition} from './physical-ammunition.js';

export {usesAuthoredEquipment,equipmentKey} from './equipment-catalog.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function storeArmoryItem(s,record){
 const {weapon,item,count,...data}=record;
 need(count===undefined||count===1,'Guardá un solo ejemplar de arma.');
 return storeEquipment(s,weapon??item,data);
}
export function addArmoryStock(s,item,quantity){return addEquipment(s,item.stockKey??item.item,quantity);}

// Plan the whole exchange before committing either custodian. Loaded rounds
// move with their weapon; changing a gun never creates or refunds cartridges.
export function equipArmoryItem(s,op,action){
 const slot=action.slot;need(['weapon','blade'].includes(slot),'Este espacio de equipo no existe.');
 const key=String(action.itemId),row=s.armoryItems.find(i=>equipmentKey(i)===key&&(action.instanceId===undefined||i.id===action.instanceId));
 need(row,'No quedan ejemplares de esa arma en la armería.');
 const incoming=storedEquipmentStack(row);need(slot!=='blade'||incoming.weapon>=1809,'Esta arma no corresponde a ese espacio.');
 const original=s.operativeState[op.id],record=structuredClone(original),actor={...op,...record,loaded:record.carriedLoaded??0,reloadProgress:record.carriedReloadProgress};
 const outgoing=op[slot]&&!(slot==='weapon'&&record.weaponDropped)?handRecord(actor,slot==='blade'?'blade':'primary'):null;
 const trial={...s,armory:{...s.armory},armoryItems:[...s.armoryItems]};
 takeEquipment(trial,key,row.id);
 if(outgoing)storeEquipment(trial,outgoing.weapon,{...outgoing,itemMetadata:handMetadata(outgoing)});
 const metadata=storedEquipmentMetadata(row);
 if(Object.keys(metadata).length)record[`${slot}Metadata`]=metadata;else delete record[`${slot}Metadata`];
 for(const [source,destination]of [['instanceId',`${slot}InstanceId`],['fittingPattern',`${slot}FittingPattern`]]){
  if(incoming[source]!==undefined)record[destination]=structuredClone(incoming[source]);else delete record[destination];
 }
 if(slot==='weapon'){
  delete record.contentWeapon;record.condition=incoming.condition;record.jammed=incoming.jammed;record.weaponDropped=false;record.weaponFittings=structuredClone(incoming.fittings??{});
  if(record.activeSlot==='unarmed')record.activeSlot='primary';
  if(incoming.ammunitionChoice!==undefined)record.ammunitionChoice=incoming.ammunitionChoice;else delete record.ammunitionChoice;
  record.carriedLoaded=incoming.loaded??0;
  if(incoming.reloadProgress!==undefined)record.carriedReloadProgress=incoming.reloadProgress;else delete record.carriedReloadProgress;
 }else {record.bladeCondition=incoming.condition;record.bladeJammed=incoming.jammed;}
 const next={...op,...record,[slot]:incoming.weapon,loaded:record.carriedLoaded??0,reloadProgress:record.carriedReloadProgress};
 for(const field of slot==='weapon'?['contentWeapon','weaponMetadata','ammunitionChoice','weaponInstanceId','weaponFittingPattern']:['bladeMetadata','bladeInstanceId','bladeFittingPattern'])if(record[field]===undefined)delete next[field];
 need(!inventoryUsage(next).overloaded,'No quedan bolsillos para el equipo guardado.');
 syncCarriedAmmunition(record,next.weapon);
 s.armory=trial.armory;s.armoryItems=trial.armoryItems;s.nextArmoryItemId=trial.nextArmoryItemId;
 s.operativeState[op.id]=record;s.loadouts[op.id]={...s.loadouts[op.id],[slot]:incoming.weapon};
 return row;
}
export function validateArmoryItems(s){migrateEquipmentStorage(s);validateEquipmentStorage(s);}
