import {AMMUNITION_FAMILIES} from './ammunition-families.js';
import {groupUnitAmmunition} from './ammunition-family-migration.js';
import {AMMUNITION_TYPES, AMMUNITION_STACK_LIMIT, addAmmunition, consumeAmmunition,
  weaponAmmoType, isAmmunitionStack, validateAmmunitionStack, ammunitionByType, availableAmmunition} from './ammunition-types.js';
import {validatePocketOrder} from './inventory-pockets.js';
import {handLayout} from './hand-layout.js';

export const AMMUNITION_VERSION = 2;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (condition, message) => {if (!condition) throw Error(message);};
const countValid = count => Number.isSafeInteger(count) && count >= 0 && count <= 1000000;
const reference = key => `inventory:${key}`;
const keyOf = item => typeof item === 'string' && item.startsWith('inventory:') ? item.slice(10) : null;
const recordAt = (unit, item) => {const key=keyOf(item);return key !== null && Object.hasOwn(unit.inventory??{},key) ? unit.inventory[key] : undefined;};
const staleItem = (unit, item) => keyOf(item) !== null && (!recordAt(unit,item) || isAmmunitionStack(recordAt(unit,item)) && recordAt(unit,item).count === 0);
const ownFields = ['inventory','ammunition','ammunitionVersion','ammo','activeSlot','activeItem','leftHandItem','pocketOrder','equipmentCursor'];
function commit(unit, next) {
  for (const key of ownFields) {
    if (Object.hasOwn(next,key)) unit[key]=next[key];else if (Object.hasOwn(unit,key)) delete unit[key];
  }
  return unit;
}

function synchronized(unit) {
  need(object(unit),'El propietario de la munición no es válido.');
  // Read admission before changing any fields. Other inventory kinds are owned
  // and validated by the shared inventory model, not this ammunition helper.
  const ammo=availableAmmunition(unit,unit.weapon),next={...unit};
  validatePocketOrder(unit.pocketOrder);
  if(next.activeSlot==='item'&&(next.activeItem==='ammo'||staleItem(next,next.activeItem))){next.activeSlot='unarmed';delete next.activeItem;}
  if(next.leftHandItem==='ammo'||staleItem(next,next.leftHandItem))next.leftHandItem=null;
  const right=next.activeSlot==='item'?next.activeItem:null;
  if(right&&right===next.leftHandItem&&isAmmunitionStack(recordAt(next,right))&&recordAt(next,right).count<2)next.leftHandItem=null;
  const counts=new Map(),heldItems=handLayout(next).held;
  for(const [key,stack] of Object.entries(next.inventory??{}))if(isAmmunitionStack(stack)){
    const item=reference(key),held=heldItems.filter(held=>held===item).length;
    counts.set(item,Math.max(0,stack.count-held));
  }
  const partitions=new Map();
  for(const hint of unit.pocketOrder??[])if(counts.has(hint.item)){
    need(hint.count===undefined||hint.count<=AMMUNITION_STACK_LIMIT,'La cantidad del bolsillo supera el límite de la pila.');
    if(hint.count!==undefined)partitions.set(JSON.stringify([hint.item,hint.index]),hint.count);
  }
  const actual=new Map();
  for(const [item,total] of counts){
    let remaining=total;
    for(let index=0;index<12&&remaining>0;index++){
      const key=JSON.stringify([item,index]),count=Math.min(partitions.get(key)??AMMUNITION_STACK_LIMIT,remaining);
      actual.set(key,count);remaining-=count;
    }
  }
  if(unit.pocketOrder!==undefined)next.pocketOrder=unit.pocketOrder.flatMap(hint=>{
    if(hint.item==='ammo'||staleItem(next,hint.item))return [];
    if(!counts.has(hint.item))return [hint];
    const count=actual.get(JSON.stringify([hint.item,hint.index]));
    if(!count)return [];
    return [hint.count!==undefined&&hint.count!==count?{...hint,count}:hint];
  });
  next.ammo=ammo;
  return next;
}

// This projection never creates inventory, including when an old scalar was
// large or the player switches to a gun using a different prepared load.
export function syncUnitAmmunition(unit) {return commit(unit,synchronized(unit));}

export function initializeUnitAmmunition(unit,{legacy=false,defaultCount=12}={}) {
  need(object(unit),'El propietario de la munición no es válido.');
  need(typeof legacy==='boolean'&&countValid(defaultCount),'La provisión inicial de munición no es válida.');
  need(unit.ammunitionVersion===undefined||[1,AMMUNITION_VERSION].includes(unit.ammunitionVersion),'La versión de munición no es compatible.');
  if(unit.ammunitionVersion===AMMUNITION_VERSION){need(unit.ammunition===undefined,'La partida contiene dos reservas de munición para el mismo propietario.');return syncUnitAmmunition(unit);}
  if(unit.ammunitionVersion===1){const next=groupUnitAmmunition(unit);next.ammunitionVersion=AMMUNITION_VERSION;return commit(unit,synchronized(next));}
  const next={...unit};ammunitionByType(next);
  let type=legacy?'musket_75':weaponAmmoType(next);
  const typed=Object.values(next.inventory??{}).some(isAmmunitionStack);
  let item=null;
  if(next.ammunition !== undefined){
    const stock=next.ammunition;
    need(object(stock)&&Object.entries(stock).every(([key,n])=>Object.hasOwn(AMMUNITION_FAMILIES,key)&&countValid(n)), 'La reserva de munición no es válida.');
    need(!typed,'La partida contiene dos reservas de munición para el mismo propietario.');
    need(next.ammo===undefined||next.ammo===Object.values(stock).reduce((n,q)=>n+q,0),'El total de munición no coincide con sus tipos.');
    const references=new Map();
    for(const [family,count]of Object.entries(stock))if(count){
      const type=AMMUNITION_FAMILIES[family].type;
      addAmmunition(next,type,count);
      const key=Object.keys(next.inventory).find(key=>isAmmunitionStack(next.inventory[key])&&next.inventory[key].ammoType===type);
      references.set(family,reference(key));
    }
    if(next.pocketOrder)next.pocketOrder=next.pocketOrder.flatMap(hint=>Object.hasOwn(AMMUNITION_FAMILIES,hint.item)?(references.has(hint.item)?[{...hint,item:references.get(hint.item)}]:[]):[hint]);
    delete next.ammunition;
  }else if(!typed){
    const count=next.ammo===undefined?(type?defaultCount:0):next.ammo;
    need(countValid(count),'La reserva inicial de cartuchos no es válida.');
    // Explicit old untyped spare rounds can belong to an unarmed carrier.
    // Retain them as musket loads once; never retag them for a future gun.
    if(count&&!type)type='musket_75';
    if(count){
      const previous=new Set(Object.keys(next.inventory??{}));addAmmunition(next,type,count);
      item=reference(Object.keys(next.inventory).find(key=>!previous.has(key)));
    }
  }else if(type){
    const key=Object.keys(next.inventory).sort().find(key=>isAmmunitionStack(next.inventory[key])&&next.inventory[key].ammoType===type&&next.inventory[key].count>0);
    if(key!==undefined)item=reference(key);
  }
  if(next.activeItem==='ammo'){
    if(item)next.activeItem=item;else {delete next.activeItem;if(next.activeSlot==='item')next.activeSlot='unarmed';}
  }
  if(next.leftHandItem==='ammo')next.leftHandItem=item;
  if(next.pocketOrder!==undefined){
    validatePocketOrder(next.pocketOrder);
    next.pocketOrder=next.pocketOrder.flatMap(hint=>hint.item==='ammo'?(item?[{...hint,item}]:[]):[hint]);
  }
  if(legacy&&next.equipmentCursor?.stack?.item==='ammo'){
    const old=next.equipmentCursor.stack,spec=AMMUNITION_TYPES.musket_75;
    need(countValid(old.count)&&old.count>0&&old.count<=spec.stackLimit,'La munición del cursor no es válida.');
    need(!isAmmunitionStack(old),'La munición tipada no puede usar la referencia antigua.');
    const stack={...old,item:reference('ammo:musket_75'),kind:'ammunition',ammoType:'musket_75',weight:spec.weight,name:old.name??spec.name};
    validateAmmunitionStack(stack);next.equipmentCursor={...next.equipmentCursor,stack};
  }
  next.ammunitionVersion=AMMUNITION_VERSION;
  return commit(unit,synchronized(next));
}

export function consumeWeaponAmmunition(unit,weapon,count) {
  const type=weaponAmmoType(weapon===unit.weapon?unit:weapon);need(type,'El arma no usa una carga de munición reconocida.');
  const next={...unit};consumeAmmunition(next,type,count);
  return commit(unit,synchronized(next));
}
