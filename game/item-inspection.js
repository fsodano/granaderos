import {equipmentEndpoint,itemDescriptor,itemQuantity} from './tactical-inventory.js';
import {WEAPONS} from './data.js';
import {AMMUNITION_TYPES} from './ammunition-types.js';

// A physical pocket contains one stack, not the aggregate carried quantity.
export function inspectEquipmentItem(unit,reference,slotId=''){
 const endpoint=slotId?equipmentEndpoint(unit,slotId):null;
 const item=endpoint?endpoint.item:reference;
 if(!item||item.startsWith('inventory:')&&!Object.hasOwn(unit.inventory??{},item.slice(10))||itemQuantity(unit,item)<1)return null;
 const description=itemDescriptor(unit,item),count=endpoint?endpoint.count:itemQuantity(unit,item);
 const weapon=WEAPONS[description.weapon],ammunition=AMMUNITION_TYPES[description.ammoType];
 return {...description,count,totalWeight:description.weight*count,
  ...(weapon?{capacity:weapon.capacity,damage:weapon.damage,range:weapon.range}:{}),
  help:(description.description?`${description.description} `:'')+(ammunition?'Colocá estos cartuchos sobre una pila compatible para combinarlos, o sobre un arma compatible para cargarla.':
   description.slotSize>1?'Necesita un bolsillo grande.':'Cabe en un bolsillo pequeño o grande.'),
 };
}
