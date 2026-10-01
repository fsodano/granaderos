import {equipmentCatalogItem,equipmentKey,usesAuthoredEquipment} from './equipment-catalog.js';
import {handMetadata,handRecord} from './tactical-inventory.js';
import {validateReloadProgress} from './weapon-reload.js';
import {validateWeaponReferences,weaponSpecification} from './weapon-definition.js';
import {validateFittingPattern,validateWeaponFittings,validItemIdentity,fittingItemIds} from './weapon-fittings.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const isHandheldEquipment=item=>integer(Number(item),1800,1813);
const artillery=key=>['bronze4','field8','swivel'].includes(key);
const canonicalFields=new Set(['item','weapon','count','loaded','condition','jammed','instanceId','fittingPattern','fittings','reloadProgress','ammunitionChoice']);

// The row ID belongs to storage. Custom IDs and labels belong to the object.
export function storedEquipmentMetadata(instance){
 const {id,item,itemMetadata,...data}=instance;
 need(itemMetadata===undefined||object(itemMetadata),'Los metadatos del arma guardada son inválidos.');
 need(!Object.keys(itemMetadata??{}).some(key=>canonicalFields.has(key)),'Los metadatos del arma guardada no pueden reemplazar su estado.');
 return {...handMetadata({...data,weapon:Number(item)}),...structuredClone(itemMetadata??{})};
}
export function storedEquipmentStack(instance){
 need(object(instance)&&typeof instance.item==='number'&&isHandheldEquipment(instance.item),'El arma almacenada es inválida.');
 const metadata=storedEquipmentMetadata(instance);
 return handRecord({weapon:instance.item,weaponMetadata:metadata,loaded:instance.loaded??0,reloadProgress:instance.reloadProgress,ammunitionChoice:instance.ammunitionChoice,condition:instance.condition,jammed:instance.jammed,weaponInstanceId:instance.instanceId,weaponFittingPattern:instance.fittingPattern,weaponFittings:instance.fittings},'primary');
}
export function validateStoredEquipment(instance,s){
 need(object(instance)&&Number.isFinite(instance.condition)&&instance.condition>=0&&instance.condition<=100&&typeof instance.jammed==='boolean','El arma almacenada es inválida.');
 need(instance.weapon===undefined&&instance.contentWeapon===undefined&&instance.count===undefined,'El arma guardada mezcla formatos.');
 const stack=storedEquipmentStack(instance),capacity=weaponSpecification(stack)?.capacity??0;
 need(instance.loaded===undefined||integer(instance.loaded,0,capacity),'La carga del arma guardada es inválida.');
 validateReloadProgress(instance.reloadProgress,capacity,instance.loaded??0);
 validateFittingPattern(instance.fittingPattern,instance.item,instance.instanceId);validateWeaponFittings(instance.fittings,instance.item);
 need(instance.instanceId===undefined||validItemIdentity(instance.instanceId),'La identidad del arma almacenada es inválida.');
 const ids=fittingItemIds(instance);need(new Set(ids).size===ids.length,'La identidad del equipo está duplicada.');
 if(s&&usesAuthoredEquipment(s))validateWeaponReferences(s,instance);
 return stack;
}
function storageRecord(item,{condition=100,jammed=false,instanceId,fittingPattern=null,fittings={},loaded,reloadProgress,ammunitionChoice,itemMetadata,...extensions}={}){
 need(isHandheldEquipment(item),'El arma almacenada es inválida.');
 need((extensions.weapon===undefined||extensions.weapon===Number(item))&&(extensions.count===undefined||extensions.count===1),'El ejemplar no corresponde al arma elegida.');
 const metadata={...handMetadata({...extensions,weapon:Number(item)}),...storedEquipmentMetadata({item:Number(item),itemMetadata})};
 const row={item:Number(item),condition,jammed,...(loaded===undefined?{}:{loaded}),...(reloadProgress===undefined?{}:{reloadProgress}),...(ammunitionChoice===undefined?{}:{ammunitionChoice}),...(instanceId===undefined?{}:{instanceId}),...(fittingPattern===null?{}:{fittingPattern}),...(Object.keys(fittings).length?{fittings:structuredClone(fittings)}:{})};
 if(Object.keys(metadata).length)row.itemMetadata=metadata;
 validateStoredEquipment(row);return row;
}
export function storeEquipment(s,item,record={}){
 const row=storageRecord(item,record);validateStoredEquipment(row,s);
 need(Array.isArray(s.armoryItems)&&s.armoryItems.length<10000,'La armería está llena.');
 need(integer(s.nextArmoryItemId,1,1e9-1),'La secuencia de la armería es inválida.');
 const key=equipmentKey(row);need(integer(s.armory?.[key]??0,0,99999),'Las existencias de la armería son inválidas.');
 row.id=`armory-${s.nextArmoryItemId++}`;s.armoryItems.push(row);s.armory[key]=(s.armory[key]??0)+1;return row;
}
export function addEquipment(s,key,quantity){
 const item=equipmentCatalogItem(key,s);need(item,'El equipo solicitado no existe.');
 need(integer(quantity,1,100000),'La cantidad de equipo es inválida.');
 if(item.category==='artillery'){need(integer(s.armory[key]??0,0,100000-quantity),'Las existencias de la armería son inválidas.');s.armory[key]=(s.armory[key]??0)+quantity;return;}
 need(s.armoryItems.length+quantity<=10000,'La armería está llena.');
 need(integer(s.armory[equipmentKey(item)]??0,0,100000-quantity),'Las existencias de la armería son inválidas.');
 need(integer(s.nextArmoryItemId,1,1e9-quantity),'La secuencia de la armería es inválida.');
 if(item.fittingPattern)need(integer(s.nextEquipmentInstanceId,1,1e9-quantity),'La secuencia del equipo es inválida.');
 for(let i=0;i<quantity;i++)storeEquipment(s,item.id,{loaded:0,...(item.contentWeapon?{itemMetadata:{contentWeapon:item.contentWeapon}}:{}),...(item.fittingPattern?{instanceId:`equipment-${s.nextEquipmentInstanceId++}`,fittingPattern:item.fittingPattern}:{})});
}
export function takeEquipment(s,key,instanceId){
 const index=s.armoryItems.findIndex(row=>equipmentKey(row)===String(key)&&(instanceId===undefined||row.id===instanceId));
 need(index>=0,'Ese ejemplar ya no está disponible en la armería.');
 const instance=s.armoryItems[index];validateStoredEquipment(instance,s);
 need(integer(s.armory[equipmentKey(instance)],1,100000),'Las cantidades de la armería no coinciden con sus ejemplares.');
 s.armoryItems.splice(index,1);s.armory[equipmentKey(instance)]--;return instance;
}
export function validateEquipmentStorage(s){
 need(s.equipmentStorageVersion===1,'La versión de la armería es inválida.');
 need(Array.isArray(s.armoryItems)&&s.armoryItems.length<=10000&&integer(s.nextArmoryItemId,1,1e9),'Los ejemplares de la armería son inválidos.');
 const ids=new Set(),counts={};
 const check=row=>{need(object(row)&&typeof row.id==='string'&&/^armory-[1-9][0-9]*$/.test(row.id)&&Number(row.id.slice(7))<s.nextArmoryItemId&&!ids.has(row.id),'La identidad del ejemplar guardado es inválida.');validateStoredEquipment(row,s);ids.add(row.id);};
 for(const row of s.armoryItems){check(row);const key=equipmentKey(row);counts[key]=(counts[key]??0)+1;}
 for(const merchant of Object.values(s.merchants??{})){need(merchant.usedItems===undefined||Array.isArray(merchant.usedItems)&&merchant.usedItems.length<=1000,'Las armas usadas del comerciante son inválidas.');for(const row of merchant.usedItems??[])check(row);}
 need(object(s.armory),'Las existencias de la armería son inválidas.');
 for(const key of new Set([...Object.keys(counts),...Object.keys(s.armory).filter(key=>!artillery(key))]))need(integer(s.armory[key]??0,0,100000)&&(counts[key]??0)===(s.armory[key]??0),'Las cantidades de la armería no coinciden con sus ejemplares.');
 return true;
}

// Admit each old format once. Never add aggregate stock on top of its rows.
export function migrateEquipmentStorage(s){
 if(s.equipmentStorageVersion!==undefined){need(s.equipmentStorageVersion===1,'La versión de la armería es inválida.');return s;}
 const oldArmory=s.armory??{};need(object(oldArmory),'Las existencias de la armería son inválidas.');
 let rows=s.armoryItems,sequence=s.nextArmoryItemId;
 if(rows===undefined){
  rows=[];sequence=1;
  for(const [key,count]of Object.entries(oldArmory)){
   const item=equipmentCatalogItem(key,s);need(item&&integer(count,0,100000),'La armería antigua es inválida.');
   if(item.category==='artillery')continue;
   need(!item.fittingPattern&&rows.length+count<=10000,'La armería antigua no identifica sus ejemplares.');
   for(let n=0;n<count;n++)rows.push({id:`armory-${sequence++}`,item:item.id,condition:100,jammed:false,...(item.contentWeapon?{itemMetadata:{contentWeapon:item.contentWeapon}}:{})});
  }
 }
 need(Array.isArray(rows)&&rows.length<=10000,'Los ejemplares de la armería son inválidos.');
 const oldCounts={},counts={};
 const convert=row=>{
  need(object(row),'El arma almacenada es inválida.');
  if(row.weapon===undefined){validateStoredEquipment(row,s);return structuredClone(row);}
  need(row.item===undefined&&row.itemMetadata===undefined&&row.count===1,'El arma guardada mezcla formatos.');
  const {id,weapon,count,...data}=row;const next={id,...storageRecord(weapon,{...data,itemMetadata:handMetadata({...data,weapon})})};validateStoredEquipment(next,s);return next;
 };
 const nextRows=rows.map(row=>{
  const next=convert(row),key=equipmentKey(next),oldKey=row.weapon!==undefined?equipmentKey(row):usesAuthoredEquipment(s)?key:String(row.item);
  oldCounts[oldKey]=(oldCounts[oldKey]??0)+1;counts[key]=(counts[key]??0)+1;return next;
 });
 for(const key of new Set([...Object.keys(oldCounts),...Object.keys(oldArmory).filter(key=>!artillery(key))]))need(integer(oldArmory[key]??0,0,100000)&&(oldCounts[key]??0)===(oldArmory[key]??0),'Las cantidades de la armería no coinciden con sus ejemplares.');
 const merchants=Object.fromEntries(Object.entries(s.merchants??{}).map(([at,merchant])=>[at,{...merchant,...(merchant.usedItems!==undefined?{usedItems:merchant.usedItems.map(convert)}:{})}]));
 const next={...s,equipmentStorageVersion:1,armory:Object.assign(Object.fromEntries(Object.entries(oldArmory).filter(([key])=>artillery(key))),counts),armoryItems:nextRows,nextArmoryItemId:sequence,merchants};
 validateEquipmentStorage(next);
 s.equipmentStorageVersion=1;s.armory=next.armory;s.armoryItems=nextRows;s.nextArmoryItemId=sequence;if(s.merchants!==undefined)s.merchants=merchants;
 return s;
}
