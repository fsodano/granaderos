import {allocatePockets, rearrangePockets} from './inventory-pockets.js';
import {DEFAULT_CHARACTER_SUPPLIES, TRANSFER_SUPPLY_LABELS} from './character-supplies.js';
import {weaponSpecification, weaponRecord} from './weapon-definition.js';

// Quantities remain in their existing save records. These descriptors allocate
// those same objects to physical pockets; they never create another inventory.
export const SUPPLY_STACKS=Object.freeze({ammo:20,priming:50,flints:4,rations:2,medkits:5,boleadoras:2,torches:2});
const compactWeapons=new Set([1805,1806,1808,1811,1813]);
export const POCKET_FULL='No queda un bolsillo del tamaño necesario. Dejá o entregá equipo antes de recoger más.';
export function pocketItems(unit){
 const items=Object.entries(SUPPLY_STACKS).map(([item,stackLimit])=>({item,kind:'supply',name:TRANSFER_SUPPLY_LABELS[item],count:unit[item]??DEFAULT_CHARACTER_SUPPLIES[item]??0,stackLimit,slotSize:1}));
 const describe=(item,record,extra={})=>{
  const spec=weaponSpecification(record),money=item.startsWith('inventory:cash:');
  return {...record,...extra,item,name:spec?.name??(money?'Pesos encontrados':record.name??'Pertrechos'),art:spec?.art,weapon:spec?.id,count:record.count??0,stackLimit:spec?1:money?1000000:(record.weight??0)>2?1:4,slotSize:spec?(compactWeapons.has(spec.id)?1:2):(record.weight??0)>2?2:1};
 };
 for(const [key,value]of Object.entries(unit.inventory??{})){
  const record=typeof value==='number'?{count:value,weight:0}:value;
  if(record?.count>0)items.push(describe(`inventory:${key}`,record,{kind:'inventory',key}));
 }
 for(const slot of ['primary','blade']){
  if((unit.activeSlot??'primary')===slot||slot==='primary'&&unit.weaponDropped)continue;
  if(weaponSpecification(unit,slot))items.push(describe(`stowed:${slot}`,weaponRecord(unit,slot),{kind:'stowed',slot}));
 }
 return items.filter(item=>item.count>0);
}
export function personalPockets(unit){return allocatePockets(pocketItems(unit),unit.pocketOrder);}
export function pocketsFit(unit){return personalPockets(unit).overflow.length===0;}
// A legacy overfilled save must still allow removal and consumption. It cannot
// use its existing excess as permission to acquire additional objects.
export function pocketChangeReason(before,after){
 if(pocketsFit(after))return null;
 const previous=new Map(pocketItems(before).map(item=>[item.item,item.count]));
 return pocketItems(after).every(item=>item.count<=(previous.get(item.item)??0))?null:POCKET_FULL;
}
export function supplyRoom(unit,item,maximum){
 let low=0,high=Math.max(0,Math.floor(maximum));
 while(low<high){const middle=Math.ceil((low+high)/2);if(pocketsFit({...unit,[item]:(unit[item]??DEFAULT_CHARACTER_SUPPLIES[item]??0)+middle}))low=middle;else high=middle-1;}
 return low;
}
export function inventoryRoom(unit,key,record,maximum=record.count??1){
 let low=0,high=Math.max(0,Math.floor(maximum));
 while(low<high){const middle=Math.ceil((low+high)/2),candidate={...unit,inventory:{...unit.inventory,[key]:{...record,count:middle}}};if(pocketsFit(candidate))low=middle;else high=middle-1;}
 return low;
}
export function movePocket(unit,source,destination){return rearrangePockets(personalPockets(unit),source,destination);}
