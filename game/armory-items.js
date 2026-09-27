import {WEAPONS} from './data.js';
import {contentWeaponOf,weaponRecord,validateWeaponCarrier,setWeaponDefinition} from './weapon-definition.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const usesAuthoredEquipment=s=>s.contentCampaign?.adapter==='character-weapons-v2';
export const equipmentKey=value=>contentWeaponOf(value)?.id??String(value.weapon??value.item??value);
export function storeArmoryItem(s,record){
 need(s.armoryItems.length<10000,'La armería está llena.');
 validateWeaponCarrier(record);
 const item={...structuredClone(record),count:1,id:`armory-${s.nextArmoryItemId++}`};
 s.armoryItems.push(item);const key=equipmentKey(item);s.armory[key]=(s.armory[key]??0)+1;return item;
}
export function addArmoryStock(s,item,quantity){
 if(!usesAuthoredEquipment(s)||item.category==='artillery'){const key=item.stockKey??item.item;s.armory[key]=(s.armory[key]??0)+quantity;return;}
 for(let i=0;i<quantity;i++)storeArmoryItem(s,{weapon:item.id,count:1,weight:item.contentWeapon?.weight??(item.category==='firearm'?4:1.3),condition:100,jammed:false,loaded:0,...(item.contentWeapon?{contentWeapon:item.contentWeapon}:{})});
}
export function equipArmoryItem(s,op,action){
 const key=String(action.itemId),index=s.armoryItems.findIndex(i=>(action.instanceId?i.id===action.instanceId:equipmentKey(i)===key));
 need(index>=0,'No quedan ejemplares de esa arma en la armería.');
 const item=s.armoryItems[index],slot=action.slot;
 need(equipmentKey(item)===key,'El ejemplar no corresponde al arma elegida.');
 need(WEAPONS[item.weapon]&&item.weapon>=1800&&item.weapon<=1813&&(slot!=='blade'||item.weapon>=1809),'Esta arma no corresponde a ese espacio.');
 const record=s.operativeState[op.id];
 s.armoryItems.splice(index,1);s.armory[equipmentKey(item)]--;
 if(op[slot])storeArmoryItem(s,weaponRecord({...op,...record,loaded:0},slot==='blade'?'blade':'primary'));
 s.loadouts[op.id]={...s.loadouts[op.id],[slot]:item.weapon};
 if(slot==='weapon'){setWeaponDefinition(record,item);record.condition=item.condition;record.jammed=item.jammed;}
 return item;
}
export function validateArmoryItems(s){
 if(!usesAuthoredEquipment(s))return;
 const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 need(Array.isArray(s.armoryItems)&&s.armoryItems.length<=10000&&integer(s.nextArmoryItemId,1,1e9),'Los ejemplares de la armería son inválidos.');
 const ids=new Set(),counts={};
 for(const item of s.armoryItems){
  need(item&&typeof item==='object'&&typeof item.id==='string'&&/^armory-[1-9][0-9]*$/.test(item.id)&&Number(item.id.slice(7))<s.nextArmoryItemId&&!ids.has(item.id)&&integer(item.weapon,1800,1813)&&item.count===1&&Number.isFinite(item.condition)&&item.condition>=0&&item.condition<=100&&typeof item.jammed==='boolean'&&item.loaded===0,'El ejemplar de la armería es inválido.');
  need(Number.isFinite(item.weight)&&item.weight>=.1&&item.weight<=30,'El peso almacenado es inválido.');
  validateWeaponCarrier(item);ids.add(item.id);const key=equipmentKey(item);counts[key]=(counts[key]??0)+1;
 }
 for(const key of new Set([...Object.keys(counts),...Object.keys(s.armory).filter(k=>!['bronze4','field8','swivel'].includes(k))]))need((counts[key]??0)===(s.armory[key]??0),'Las cantidades de la armería no coinciden con sus ejemplares.');
}
