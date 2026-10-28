import {applyItemQuantity,equipmentFingerprint,extractItemQuantity,inventoryUsage,itemQuantity,readItemStack,SUPPLY_ITEMS} from './tactical-inventory.js';
import {handLayout} from './hand-layout.js';

// Finite recipe and work cost are game tuning, not a historical medical claim.
export const FIELD_DRESSINGS_AP=20;
const fail=message=>{throw Error(message);};

function packedSource(unit,key){
 if(typeof key!=='string'||key.startsWith('inventory:'))fail('Seleccioná una camisa de lino guardada.');
 const item=`inventory:${key}`,count=itemQuantity(unit,item),stack=readItemStack(unit,item,count);
 if(stack.kind!=='outfit'||stack.outfit!=='linen_shirt'||count<1)fail('Seleccioná una camisa de lino guardada.');
 const hands=handLayout(unit);
 if(hands.right===item||hands.left===item)fail('Guardá la camisa de lino en un bolsillo antes de preparar vendas.');
 const slots=inventoryUsage(unit).slots.filter(slot=>slot.entry?.item===item);
 if(!slots.length)fail('Guardá la camisa de lino en un bolsillo antes de preparar vendas.');
 return {item,stack,slots};
}

// Use the same physical endpoint fingerprints as equipment moves, plus the
// complete stored quantity. A delayed inspection cannot consume a replacement
// shirt, or a different remainder of a legacy stack with the same key.
export function fieldDressingsSource(unit,key){
 const {stack,slots}=packedSource(unit,key);
 return JSON.stringify({unitId:String(unit.id),inventoryKey:key,stack,slots:slots.map(slot=>equipmentFingerprint(unit,slot.id))});
}

export function planFieldDressings(unit,key,expectedSource){
 const {item,stack}=packedSource(unit,key);
 if(expectedSource!==undefined&&(typeof expectedSource!=='string'||expectedSource!==fieldDressingsSource(unit,key)))fail('Cambió la camisa. Seleccioná el objeto de nuevo.');
 if(stack.condition<50)fail('La camisa de lino necesita al menos 50% de estado.');
 const taken=extractItemQuantity(unit,item,1);
 const next=applyItemQuantity(taken.unit,{item:'medkits',count:3,weight:SUPPLY_ITEMS.medkits.weight});
 return {unit:next,consumed:taken.stack};
}
