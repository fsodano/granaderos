import {AMMUNITION_TYPES,validateAmmunitionStack,isAmmunitionStack} from './ammunition-types.js';
import {GRENADE_TYPES,validateGrenadeStack,isGrenadeStack} from './grenades.js';
import {OUTFITS,validateOutfit,wornOutfit} from './outfits.js';
import {handLayout,handsRequired,selectMainHand} from './hand-layout.js';
import {allocatePockets,rearrangePockets,pocketOrderFromSlots,validatePocketOrder} from './inventory-pockets.js';
import {lowerWeapon} from './weapon-readiness.js';
import {validateReloadProgress} from './weapon-reload.js';
import {WEAPONS} from './data.js';
import {clearEmptySupply} from './held-supplies.js';
import {validateFitting,validateFittingPattern,validateWeaponFittings,validateUnitFittings,fittingItemIds,heldItemIds,fittingWeight,weaponItemWeight,fittingLabel,fittingFromItem,fittingToItem} from './weapon-fittings.js';

// JA2 manual pp. 21–25: separate hands and pack, finite inventory slots,
// selectable quantities, passing, dropping, and retained weapon contents.
// Four large and eight small pockets share the same layout for every soldier.
// Supply stack limits and bulk classifications are period-game tuning.
export const INVENTORY_CAPACITY = 12;
export const SUPPLY_ITEMS = Object.freeze(Object.fromEntries([
  ['ammo', 'Cartuchos', 20, .04], ['priming', 'Pólvora de cebar', 50, .01],
  ['flints', 'Piedras de chispa', 4, .05], ['rations', 'Raciones', 2, .5],
  ['medkits', 'Vendas', 5, .2], ['boleadoras', 'Boleadoras', 2, .8], ['torches', 'Antorchas', 2, .4],
].map(([item, label, stackLimit, weight]) => [item, Object.freeze({item, label, name: label, stackLimit, slotSize: 1, weight, kind: 'supply'})])));

const own = (object, key) => Object.hasOwn(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const TOOL_LABELS = Object.freeze({key: 'Llave', lockpick: 'Ganzúas', crowbar: 'Barreta', pliers: 'Alicates'});
const isTool = value => value.itemType === 'tool' || value.kind === 'tool';
const fail = message => {throw new Error(message);};
function quantity(value, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 1000000) fail('La cantidad debe ser un entero válido.');
  return value;
}
function finite(value, minimum, maximum, message) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) fail(message);
  return value;
}
function safeKey(key) {
  if (typeof key !== 'string' || !key.length || key.length > 100 || /[<>\x00-\x1f]/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) fail('La clave del objeto no es válida.');
  return key;
}
function pack(unit) {
  const inventory = unit.inventory ?? {};
  if (!object(inventory)) fail('El inventario no es válido.');
  for (const key of Object.keys(inventory)) safeKey(key);
  return inventory;
}
function weapon(id, handheld = false) {
  if (!Number.isInteger(id) || id < 0 || id > 65535 || handheld && (id < 1800 || id > 1813 || !own(WEAPONS, id))) fail('El arma no es válida.');
  // Older saves also contain stored equipment IDs outside the handheld catalog.
  // Preserve those objects for carrying/dropping; this does not make them equipable.
  return WEAPONS[id] ?? {id, name: `Equipo ${id}`, capacity: 0, type: 'equipment'};
}
function record(value) {
  if (typeof value === 'number') return {count: quantity(value), weight: 0};
  if (!object(value)) fail('El objeto guardado no es válido.');
  const result = {...value, count: quantity(value.count), weight: finite(value.weight ?? 0, 0, 10000, 'El peso del objeto no es válido.')};
  for (const key of Object.keys(result)) if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Los datos del objeto no son válidos.');
  if(result.ammoType!==undefined&&!isAmmunitionStack(result))fail('El tipo de munición requiere una pila de cartuchos.');
  validateAmmunitionStack(result);
  if(result.grenadeType!==undefined&&!isGrenadeStack(result))fail('El tipo de granada requiere una pila de granadas.');
  validateGrenadeStack(result);
  if (result.weapon !== undefined) {
    const spec = weapon(result.weapon);
    result.loaded = quantity(result.loaded ?? 0);
    if (result.loaded > (spec.capacity ?? 0)) fail('La carga del arma no es válida.');
    result.condition = finite(result.condition ?? 100, 0, 100, 'La condición del arma no es válida.');
    if (result.jammed !== undefined && typeof result.jammed !== 'boolean') fail('El estado de la cazoleta no es válido.');
    result.jammed ??= false;
  }
  if(result.kind==='outfit'||result.outfit!==undefined)validateOutfit(result);
  validateReloadProgress(result.reloadProgress, result.weapon === undefined ? 0 : weapon(result.weapon).capacity ?? 0, result.loaded);
  if (result.weapon === undefined && result.loaded !== undefined && quantity(result.loaded) !== 0) fail('Un objeto sin arma no puede contener una carga.');
  if (result.condition !== undefined) finite(result.condition, 0, 100, 'La condición del objeto no es válida.');
  if (result.jammed !== undefined && typeof result.jammed !== 'boolean') fail('El estado de la cazoleta no es válido.');
  if (isTool(result)) {
    if (result.weapon !== undefined || !own(TOOL_LABELS, result.toolKey)) fail('La herramienta no es válida.');
    result.condition ??= 100;
    if (result.keyId !== undefined) safeKey(result.keyId);
  }
  if (result.instanceId !== undefined) {
    safeKey(result.instanceId);
    if (result.count > 1) fail('Un objeto identificado debe conservarse por separado.');
  }
  validateFittingPattern(result.fittingPattern,result.weapon,result.instanceId);
  validateWeaponFittings(result.fittings,result.weapon);
  if (result.fittings?.bayonet || result.fittingPattern != null) {
    if (result.count !== 1 || result.weight !== weaponItemWeight(result.weapon)) fail('El peso o la cantidad del arma con encastre no son válidos.');
  }
  const ids=fittingItemIds(result);
  if (new Set(ids).size!==ids.length) fail('La identidad del equipo está duplicada.');
  return result;
}
function resolve(unit, item, validatedPack) {
  if(item==='cursor'){validateEquipmentCursor(unit);return {kind:'cursor',key:item,item,record:unit.equipmentCursor?.stack??null};}
  if (typeof item !== 'string') fail('Seleccioná un objeto del inventario.');
  if (item.startsWith('inventory:')) {
    const key = safeKey(item.slice(10)), inventory = validatedPack??pack(unit);
    if (!own(inventory, key)) fail('Ese objeto ya no está en el inventario.');
    return {kind: 'inventory', key, item: `inventory:${key}`, record: record(inventory[key])};
  }
  if (item === 'ammo' && unit.ammunitionVersion === 1) fail('Seleccioná una pila de munición del calibre indicado.');
  if (own(SUPPLY_ITEMS, item)) return {kind: 'supply', key: item, item, count: quantity(unit[item] ?? 0)};
  if(item==='outfit')return {kind:'outfit',key:item,item,record:wornOutfit(unit)};
  if (item === 'primary' || item === 'blade' || item === 'offhand') return {kind: 'hand', key: item, item};
  const key = safeKey(item), inventory = validatedPack??pack(unit);
  if (!own(inventory, key)) fail('Ese objeto ya no está en el inventario.');
  return {kind: 'inventory', key, item: `inventory:${key}`, record: record(inventory[key])};
}
const HAND_CANONICAL_FIELDS=new Set(['item','count','weapon','loaded','condition','jammed','fittings','fittingPattern','instanceId','reloadProgress']);
export function handMetadata(stack){
 const metadata=structuredClone(Object.fromEntries(Object.entries(stack).filter(([key])=>!HAND_CANONICAL_FIELDS.has(key))));
 const spec=weapon(stack.weapon,true);if(metadata.weight===(spec.weight??(spec.type==='firearm'?4:1.3)))delete metadata.weight;
 return metadata;
}
export function droppedWeaponStack(drop){
 const {unitId,x,y,tacticalLevel,taken,knownToPlayer,weaponMetadata,...data}=drop;
 const metadata=weaponMetadata===undefined?{}:weaponMetadata;
 if(!object(metadata)||Object.keys(metadata).some(key=>HAND_CANONICAL_FIELDS.has(key)))fail('Los metadatos del arma abandonada no son válidos.');
 if(drop.weight!==undefined)finite(drop.weight,0,10000,'El peso del arma abandonada no es válido.');
 if(metadata.weight!==undefined)finite(metadata.weight,0,10000,'El peso del arma abandonada no es válido.');
 const stack={...structuredClone(data),...structuredClone(metadata),item:'weapon',count:1,weapon:drop.weapon,loaded:drop.loaded,condition:drop.condition,jammed:Boolean(drop.jammed),weight:drop.weight??metadata.weight??weaponItemWeight(drop.weapon)};
 validateItemStack(stack);return stack;
}
export function handRecord(unit, slot) {
  if(slot==='offhand'){if(!unit.offHand)fail('La mano secundaria está vacía.');return record(unit.offHand);}
  const raw = slot === 'primary' ? unit.weapon : unit.blade;
  const id = typeof raw === 'object' ? raw?.id : raw;
  const spec = weapon(id, true), primary = slot === 'primary', rawMetadata=unit[primary?'weaponMetadata':'bladeMetadata'], metadata=rawMetadata===undefined?{}:rawMetadata;
  if(!object(metadata)||Object.keys(metadata).some(key=>HAND_CANONICAL_FIELDS.has(key)))fail('Los metadatos del arma no son válidos.');
  if(metadata.weight!==undefined)finite(metadata.weight,0,10000,'El peso del arma no es válido.');
  const instanceId = primary ? unit.weaponInstanceId : unit.bladeInstanceId;
  return record({...structuredClone(metadata),count: 1, weight: metadata.weight??spec.weight ?? (spec.type === 'firearm' ? 4 : 1.3), weapon: id,
    ...(primary && unit.reloadProgress ? {reloadProgress:unit.reloadProgress} : {}),
    loaded: primary ? unit.loaded ?? 0 : 0, condition: primary ? unit.condition ?? 100 : unit.bladeCondition ?? 100,
    jammed: primary ? unit.jammed ?? false : false, ...(instanceId === undefined ? {} : {instanceId}),
    ...(primary && unit.weaponFittings?.bayonet ? {fittings:structuredClone(unit.weaponFittings)} : {}),
    ...((primary?unit.weaponFittingPattern:unit.bladeFittingPattern)!=null ? {fittingPattern:primary?unit.weaponFittingPattern:unit.bladeFittingPattern} : {})});
}
function recordDescriptor(item, value) {
  if (isAmmunitionStack(value)) {const spec=AMMUNITION_TYPES[value.ammoType];return {item,label:value.name,name:value.name,ammoType:value.ammoType,stackLimit:value.instanceId?1:spec.stackLimit,slotSize:1,weight:spec.weight,kind:'ammunition'};}
  if (isGrenadeStack(value)) {const spec=GRENADE_TYPES[value.grenadeType];return {item,label:value.name,name:value.name,grenadeType:value.grenadeType,condition:value.condition,stackLimit:value.instanceId?1:spec.stackLimit,slotSize:1,weight:spec.weight,kind:'grenade'};}
  const spec = value.weapon === undefined ? null : weapon(value.weapon);
  const handheld = spec && spec.id >= 1800 && spec.id <= 1813;
  const compactWeapon = handheld && [1805, 1806, 1808, 1811, 1813].includes(spec.id);
  const slotSize = value.kind==='outfit'?2:handheld ? compactWeapon ? 1 : 2 : value.weight > 2 ? 2 : 1;
  const label = value.kind==='outfit'?OUTFITS[value.outfit].name:value.fittingPattern != null ? fittingLabel(value.fittingPattern) : spec?.name ?? (isTool(value) ? TOOL_LABELS[value.toolKey] : typeof value.name==='string'&&value.name.trim()?value.name.trim().slice(0,100):item.replace(/^inventory:/, ''));
  return {item, label, name: label, ...(spec?{weapon:spec.id,loaded:value.loaded,condition:value.condition}:value.condition!==undefined?{condition:value.condition}:{}), stackLimit: spec || isTool(value) || value.instanceId ? 1 : slotSize === 2 ? 1 : 4, slotSize, weight: value.weight+fittingWeight(value), kind: value.kind==='outfit'?'outfit':spec ? 'weapon' : isTool(value) ? 'tool' : 'inventory'};
}

export function itemQuantity(unit, item) {return resolvedQuantity(unit,resolve(unit,item));}
function resolvedQuantity(unit,entry){
  if(entry.kind==='cursor')return entry.record?.count??0;
  if(entry.kind==='outfit')return entry.record?1:0;
  if (entry.kind === 'supply') return entry.count;
  if (entry.kind === 'inventory') return entry.record.count;
  return entry.key==='offhand'?unit.offHand?1:0:entry.key === 'primary' ? unit.weapon && !unit.weaponDropped ? 1 : 0 : unit.blade ? 1 : 0;
}
export function itemDescriptor(unit, item) {return resolvedDescriptor(unit,resolve(unit,item));}
function resolvedDescriptor(unit,entry){
  const item=entry.item;
  if(entry.kind==='cursor')return entry.record?{...itemStackDescriptor(entry.record),item:'cursor'}:{item:'cursor',label:'Cursor vacío',weight:0,stackLimit:1,slotSize:0,kind:'inventory'};
  if(entry.kind==='outfit')return entry.record?recordDescriptor(item,entry.record):{item,label:'Sin vestimenta equipada',weight:0,stackLimit:1,slotSize:2,kind:'outfit'};
  if (entry.kind === 'supply') return SUPPLY_ITEMS[item];
  if (entry.kind === 'inventory') return recordDescriptor(entry.item, entry.record);
  if (!resolvedQuantity(unit,entry)) return {item, label: 'Mano vacía', name: 'Mano vacía', stackLimit: 1, slotSize: 0, weight: 0, kind: 'weapon'};
  return recordDescriptor(item, handRecord(unit, item));
}
// Objects without a contextual use still occupy a physical hand. Useful
// supplies and tools retain their existing active modes instead.
export function carriedObject(unit,item=unit.activeItem){
 try{
  if(typeof item!=='string')return null;
  const entry=resolve(unit,item);
  if(entry.item!==item||!['supply','inventory'].includes(entry.kind)||itemQuantity(unit,item)<1)return null;
  if(entry.kind==='supply'&&!['ammo','priming','flints'].includes(item))return null;
  if(entry.kind==='inventory'&&(entry.record.weapon!==undefined||isTool(entry.record)))return null;
  return itemDescriptor(unit,item);
 }catch{return null;}
}
export function validateHands(unit) {
  wornOutfit(unit);validateEquipmentCursor(unit);
  for(const [slot,key]of [['primary','weaponMetadata'],['blade','bladeMetadata']])if(unit[key]!==undefined){if(!itemQuantity(unit,slot))fail('Un arma ausente no puede conservar metadatos.');handRecord(unit,slot);}
  if(unit.activeSlot==='item'?!carriedObject(unit):unit.activeItem!==undefined)fail('El objeto de la mano principal no es válido.');
  if(unit.leftHandItem!=null){
    const entry=resolve(unit,unit.leftHandItem);
    const handWeapon=entry.kind==='hand'&&itemQuantity(unit,entry.item)>0?handRecord(unit,entry.item).weapon:null;
    if(unit.leftHandItem===handLayout(unit).right&&itemQuantity(unit,unit.leftHandItem)<2||entry.item!==unit.leftHandItem||!['inventory','supply','hand'].includes(entry.kind)||entry.kind==='inventory'&&entry.record.weapon!==undefined||entry.kind==='hand'&&(!handWeapon||handsRequired(handWeapon)!==1))fail('El objeto de la segunda mano no es válido.');
  }
  if(unit.offHand!==undefined){
    const value=handRecord(unit,'offhand');
    if(value.count!==1||value.weapon<1800||value.weapon>1813||!WEAPONS[value.weapon]||handsRequired(value.weapon)!==1)fail('El arma de la segunda mano no es válida.');
  }
  return true;
}
export function inventoryUsage(unit) {
  validateHands(unit);
  validatePocketOrder(unit.pocketOrder);
  const inventory=pack(unit);
  for(const slot of unit.pocketOrder??[]){
    const item=slot.item,known=(own(SUPPLY_ITEMS,item)&&(item!=='ammo'||unit.ammunitionVersion!==1))||['primary','blade','offhand','outfit'].includes(item)||item.startsWith('inventory:')&&own(inventory,item.slice(10));
    // Known depleted or held items still have a limit. A stale oversized hint
    // must not pass save admission and then prevent the next real pickup.
    if(slot.count!==undefined&&known&&slot.count>resolvedDescriptor(unit,resolve(unit,item,inventory)).stackLimit)fail('La cantidad del bolsillo supera el límite de la pila.');
  }
  const items = [],hands=handLayout(unit);
  for (const item of [...Object.keys(SUPPLY_ITEMS).filter(item=>item!=='ammo'||unit.ammunitionVersion!==1), ...Object.keys(inventory).sort().map(key => `inventory:${key}`),...hands.stowed]) {
    const entry=resolve(unit,item,inventory),count=resolvedQuantity(unit,entry)-hands.held.filter(held=>held===item).length;
    if (!count) continue;
    const descriptor=resolvedDescriptor(unit,entry),stacks=Math.ceil(count/descriptor.stackLimit);
    items.push({...descriptor, count, stacks, slots: stacks});
  }
  const layout=allocatePockets(items,unit.pocketOrder);
  // Partial stacks occupy real pockets even when their combined quantity would fit in one.
  const used = layout.slots.filter(slot=>slot.entry).length+layout.overflow.reduce((total,entry)=>total+Math.ceil(entry.count/entry.stackLimit),0);
  const slotCounts=new Map(),overflowCounts=new Map();
  for(const slot of layout.slots)if(slot.entry)slotCounts.set(slot.entry.item,(slotCounts.get(slot.entry.item)??0)+1);
  for(const entry of layout.overflow)if(!overflowCounts.has(entry.item))overflowCounts.set(entry.item,entry.count);
  for(const item of items){item.stacks=(slotCounts.get(item.item)??0)+Math.ceil((overflowCounts.get(item.item)??0)/item.stackLimit);item.slots=item.stacks;}
  return {used, capacity: INVENTORY_CAPACITY, free: layout.slots.filter(slot=>!slot.entry).length, overloaded: layout.overflow.length>0, items,...layout};
}

// Return an independent payload without planning a removal. Cursor previews
// read each physical stack; they must not clone the complete soldier per read.
export function readItemStack(unit,item,count=1){return stackFromEntry(unit,resolve(unit,item),count);}
// Batch reads share key admission only within this call; each selected record
// and quantity is still validated, and returned payloads share no mutable data.
export function readItemStacks(unit,selections){
 const inventory=pack(unit);return selections.map(({item,count=1})=>stackFromEntry(unit,resolve(unit,item,inventory),count));
}
function stackFromEntry(unit,entry,count){
 quantity(count,1);const item=entry.item;
 if(resolvedQuantity(unit,entry)<count)fail('No queda esa cantidad del objeto.');
 if(entry.kind==='cursor')return {...structuredClone(entry.record),count};
 if(entry.kind==='supply')return {item,count,weight:SUPPLY_ITEMS[item].weight};
 if(entry.kind==='outfit')return {item:'outfit',...structuredClone(entry.record),count:1};
 if(entry.kind==='hand')return {item:'weapon',...structuredClone(handRecord(unit,entry.key))};
 return {...structuredClone(entry.record),item:entry.item,count};
}

export function extractItemQuantity(unit, item, count = 1, {keepOtherHand=true}={}) {
  quantity(count, 1);
  const entry = resolve(unit, item);
  if (itemQuantity(unit, item) < count) fail('No queda esa cantidad del objeto.');
  const next = structuredClone(unit);
  let stack;
  if(entry.kind==='cursor'){
    stack=structuredClone(entry.record);stack.count=count;
    if(entry.record.count===count)delete next.equipmentCursor;else next.equipmentCursor.stack.count-=count;
  } else if (entry.kind === 'supply') {
    next[item] = entry.count - count;
    clearEmptySupply(next);
    stack = {item, count, weight: SUPPLY_ITEMS[item].weight};
  } else if(entry.kind==='outfit'){stack={item:'outfit',...entry.record,count:1};next.outfit=null;delete next.poncho;
  } else if (entry.kind === 'hand') {
    stack = {item: 'weapon', ...handRecord(unit, entry.key)};
    if (entry.key === 'primary') {lowerWeapon(next); next.weaponDropped = true; next.loaded = 0; delete next.reloadProgress; next.jammed = false; delete next.weaponInstanceId; delete next.weaponMetadata; next.weaponFittings={}; next.weaponFittingPattern=null;}
    else if(entry.key==='offhand')delete next.offHand;
    else {delete next.blade; delete next.bladeInstanceId; delete next.bladeCondition; delete next.bladeMetadata; next.bladeFittingPattern=null;}
    if ((next.activeSlot ?? 'primary') === entry.key) next.activeSlot = 'unarmed';
    next.braced = false; next.overwatch = false; next.momentum = 0;
    delete next.lastTargetId; delete next.lastShotPosition;
  } else {
    stack = {...structuredClone(entry.record), item: entry.item, count};
    const remaining = entry.record.count - count;
    if (!remaining) delete next.inventory[entry.key];
    else if (typeof unit.inventory[entry.key] === 'number') next.inventory[entry.key] = remaining;
    else next.inventory[entry.key].count = remaining;
    if (!remaining && next.activeTool === entry.item) {
      delete next.activeTool;
      if (next.activeSlot === 'tool') next.activeSlot = 'unarmed';
    }
  }
  if(next.activeItem===entry.item&&(entry.kind==='inventory'?!next.inventory?.[entry.key]:itemQuantity(next,entry.item)===0)){delete next.activeItem;if(next.activeSlot==='item')next.activeSlot='unarmed';}
  if(next.leftHandItem===entry.item&&(entry.kind==='inventory'?!next.inventory?.[entry.key]||!(typeof next.inventory[entry.key]==='number'?next.inventory[entry.key]:next.inventory[entry.key].count):itemQuantity(next,entry.item)===0))next.leftHandItem=null;
  if(next.leftHandItem&&next.leftHandItem===handLayout(next).right&&itemQuantity(next,next.leftHandItem)<2)next.leftHandItem=null;
  return {unit: keepOtherHand?retainOtherHand(unit,next):next, stack};
}
// Removing the selected item does not put the other held weapon into a full pack.
// Corpse searches and atomic equipment swaps retain their explicit ownership order.
function retainOtherHand(before,next){
  if(!(before.hp>0)||before.unconscious||before.surrendered||before.activeSlot==='unarmed'||next.activeSlot!=='unarmed')return next;
  const other=handLayout(before).left;
  if(other==='blade'&&next.blade)next.activeSlot='blade';
  else if(other==='primary'&&!next.weaponDropped)next.activeSlot='primary';
  else if(other==='offhand'&&next.offHand){
    const held=next.offHand;delete next.offHand;
    if(next.weapon&&!next.weaponDropped){const stored=extractItemQuantity(next,'primary',1,{keepOtherHand:false});next=applyItemQuantity(stored.unit,stored.stack,{deferCapacity:true});}
    next.weapon=held.weapon;next.loaded=held.loaded??0;next.condition=held.condition??100;next.jammed=held.jammed??false;next.weaponDropped=false;
    delete next.reloadProgress;if(held.reloadProgress)next.reloadProgress=held.reloadProgress;
    const metadata=handMetadata(held);if(Object.keys(metadata).length)next.weaponMetadata=metadata;else delete next.weaponMetadata;
    next.weaponFittings=structuredClone(held.fittings??{});next.weaponFittingPattern=held.fittingPattern??null;delete next.weaponInstanceId;if(held.instanceId)next.weaponInstanceId=held.instanceId;
    next.activeSlot='primary';lowerWeapon(next);
  }
  return next.activeSlot==='unarmed'?next:selectMainHand(next,{activeSlot:next.activeSlot});
}
function incoming(stack) {
  if (!object(stack) || typeof stack.item !== 'string') fail('El objeto transferido no es válido.');
  quantity(stack.count, 1);
  if (own(SUPPLY_ITEMS, stack.item)) {
    if (isAmmunitionStack(stack)||stack.ammoType!==undefined) fail('La munición debe conservar su pila de inventario.');
    if (isGrenadeStack(stack)||stack.grenadeType!==undefined) fail('La granada debe conservar su pila de inventario.');
    if (['weapon', 'loaded', 'reloadProgress', 'condition', 'jammed', 'instanceId','fittings','fittingPattern'].some(key => stack[key] !== undefined)) fail('Los suministros no pueden contener datos de un arma.');
    return {kind: 'supply', key: stack.item, value: {count: stack.count, weight: SUPPLY_ITEMS[stack.item].weight}};
  }
  const value = record(stack); delete value.item;
  if (stack.item === 'weapon' && value.weapon === undefined) fail('Falta el arma transferida.');
  const key = stack.item === 'weapon' ? `weapon:${value.weapon}` : stack.item.startsWith('inventory:') ? stack.item.slice(10) : stack.item;
  safeKey(key);
  return {kind: 'inventory', key, value};
}
// Validate a ground/transfer payload without assuming it already fits a pack.
// Depleted ground entries can be checked by the caller with count: 1.
export function validateItemStack(stack) {incoming(stack); return true;}
export function itemStackDescriptor(stack){
 const value=incoming(stack);return value.kind==='supply'?SUPPLY_ITEMS[value.key]:recordDescriptor(stack.item,value.value);
}
export function equipmentStacksMerge(left,right){
 const a=incoming(left),b=incoming(right);if(a.kind!==b.kind)return false;
 if(a.kind==='supply')return a.key===b.key;
 if(a.value.weapon!==undefined||a.value.kind==='outfit'||a.value.instanceId||isTool(a.value)||a.key!==b.key&&!a.value.name)return false;
 return sameMetadata(a.value,b.value);
}
const physicalEquipmentSlot=id=>id==='outfit'||id==='hand:right'||id==='hand:left'||/^large-[1-4]$/.test(id)||/^small-[1-8]$/.test(id);
const equipmentCursorSource=id=>physicalEquipmentSlot(id)||id.startsWith('attachment:')&&id.slice(11)!=='outfit'&&physicalEquipmentSlot(id.slice(11));
export function validateEquipmentCursor(unit){
 const cursor=unit.equipmentCursor;if(cursor===undefined)return true;
 if(!object(cursor)||Object.keys(cursor).some(key=>!['sourceId','stack'].includes(key))||typeof cursor.sourceId!=='string'||!equipmentCursorSource(cursor.sourceId)||!object(cursor.stack)||cursor.stack.item==='cursor')fail('El objeto del cursor no es válido.');
 if(unit.ammunitionVersion===1&&cursor.stack.item==='ammo')fail('La munición del cursor necesita un tipo de carga definido.');
 const descriptor=itemStackDescriptor(cursor.stack);if(cursor.stack.count>descriptor.stackLimit)fail('La cantidad del cursor supera el límite de la pila.');
 const existing=[...heldItemIds(unit),...Object.values(pack(unit)).filter(value=>object(value)&&value.count>0).flatMap(fittingItemIds)],ids=fittingItemIds(cursor.stack);
 if(new Set(ids).size!==ids.length||ids.some(id=>existing.includes(id)))fail('La identidad del objeto del cursor está duplicada.');
 return true;
}
function uniqueKey(inventory, base) {
  if (!own(inventory, base)) return base;
  const stem = base.slice(0, 88);
  for (let index = 1; index <= 1000000; index++) {
    const key = `${stem}:${index}`;
    if (!own(inventory, key)) return key;
  }
  fail('No queda una ubicación para el objeto.');
}
function sameMetadata(left, right) {
  const a = Object.keys(left).filter(key => key !== 'count').sort(), b = Object.keys(right).filter(key => key !== 'count').sort();
  return a.length === b.length && a.every((key, index) => key === b[index] && JSON.stringify(left[key]) === JSON.stringify(right[key]));
}
// Deferred checks are only for atomic equipment planners, which validate the final layout.
export function applyItemQuantity(unit, stack, {deferCapacity=false}={}) {
  if (stack.item==='ammo'&&unit.ammunitionVersion===1) fail('La munición necesita un tipo de carga definido.');
  const entry = incoming(stack), usage = inventoryUsage(unit);
  if (!deferCapacity && usage.overloaded) fail('El inventario está sobrecargado. Retirá objetos antes de recibir más.');
  const next = structuredClone(unit); next.inventory ??= {};
  if (entry.kind === 'supply') next[entry.key] = quantity((next[entry.key] ?? 0) + entry.value.count);
  else {
    const value = entry.value;
    const owned=new Set([...heldItemIds(unit),...Object.values(pack(unit)).filter(item=>object(item)&&item.count>0).flatMap(fittingItemIds)]);
    if (fittingItemIds(value).some(id=>owned.has(id))) fail('Ese objeto identificado ya está en el inventario.');
    if (value.weapon !== undefined || isTool(value)) {
      // Legacy stacked weapons all retain their contents; split only when moved.
      // Bound allocation before generating individual destination records.
      if (value.count > (deferCapacity ? INVENTORY_CAPACITY : INVENTORY_CAPACITY - usage.used)) fail('No queda espacio para esa cantidad de objetos.');
      for (let i = 0; i < value.count; i++) next.inventory[uniqueKey(next.inventory, entry.key)] = {...structuredClone(value), count: 1};
    } else {
      const previous = own(next.inventory, entry.key) ? record(next.inventory[entry.key]) : null;
      if (previous && sameMetadata(previous, value)) next.inventory[entry.key] = {...previous, count: quantity(previous.count + value.count)};
      else next.inventory[uniqueKey(next.inventory, entry.key)] = structuredClone(value);
    }
  }
  if(unit.pocketOrder?.some(slot=>slot.count!==undefined)){
    const slots=structuredClone(usage.slots);
    for(const item of new Set(slots.flatMap(slot=>slot.entry?[slot.entry.item]:[]))){
      let added=itemQuantity(next,item)-itemQuantity(unit,item);
      for(const slot of slots){if(added<=0)break;if(slot.entry?.item!==item)continue;const amount=Math.min(added,slot.entry.stackLimit-slot.entry.count);slot.entry.count+=amount;added-=amount;}
    }
    next.pocketOrder=pocketOrderFromSlots(slots);
  }
  if (!deferCapacity && inventoryUsage(next).overloaded) fail('No queda espacio en el inventario.');
  return next;
}
export function canCarryTransfer(unit, stack) {
  try {applyItemQuantity(unit, stack); return true;} catch {return false;}
}
export function transferItemQuantity(source, target, item, count = 1) {
  if (source === target || source.id !== undefined && target.id !== undefined && String(source.id) === String(target.id)) fail('Elegí otro combatiente para recibir el objeto.');
  const extracted = extractItemQuantity(source, item, count), received = applyItemQuantity(target, extracted.stack);
  return {source: extracted.unit, target: received, stack: extracted.stack};
}

function fittingHost(unit) {
  validateUnitFittings(unit);
  if (unit.weaponDropped || (unit.activeSlot??'primary')!=='primary' || WEAPONS[unit.weapon]?.type!=='firearm') fail('Prepará el fusil antes de cambiar su bayoneta.');
}
function clearFittingGuard(unit) {
  lowerWeapon(unit);
  unit.braced=false;unit.overwatch=false;unit.momentum=0;
  delete unit.lastTargetId;delete unit.lastShotPosition;
  return unit;
}
// These planners change only cloned ownership. The reducer preflights and pays
// AP/time before committing their result. They never allocate identities or RNG.
export function planFitBayonet(unit,item) {
  fittingHost(unit);
  if (unit.weaponFittings?.bayonet) fail('El fusil ya tiene una bayoneta fijada.');
  if (item!=='blade' && !(typeof item==='string'&&item.startsWith('inventory:'))) fail('Seleccioná una bayoneta de la secundaria o de la mochila.');
  const extracted=extractItemQuantity(unit,item,1),stack=extracted.stack;
  const fitting=fittingFromItem(stack,unit.weapon);
  if (fitting.condition<=0) fail('La bayoneta está rota.');
  if (heldItemIds(extracted.unit).includes(fitting.instanceId) || Object.values(extracted.unit.inventory??{}).some(r=>r?.count>0&&fittingItemIds(r).includes(fitting.instanceId))) fail('La identidad del equipo está duplicada.');
  const next=extracted.unit;next.weaponFittings={bayonet:structuredClone(fitting)};
  return {unit:clearFittingGuard(next),fitting:structuredClone(fitting),source:item,host:unit.weapon};
}
export function planRemoveBayonet(unit,destination='inventory') {
  fittingHost(unit);
  const fitting=unit.weaponFittings?.bayonet;
  validateFitting(fitting,unit.weapon);
  if (!['inventory','blade'].includes(destination)) fail('Seleccioná mochila o mano secundaria.');
  let next=structuredClone(unit);next.weaponFittings={};
  const stack=fittingToItem(fitting);
  if (destination==='inventory') next=applyItemQuantity(next,stack);
  else {
    if (next.blade || next.offHand) fail('La mano secundaria está ocupada.');
    next.blade=fitting.weapon;next.bladeCondition=fitting.condition;next.bladeInstanceId=fitting.instanceId;next.bladeFittingPattern=fitting.fittingPattern;
    const metadata=handMetadata(stack);delete next.bladeMetadata;if(Object.keys(metadata).length)next.bladeMetadata=metadata;
  }
  if(inventoryUsage(next).overloaded)fail('No queda espacio para guardar la bayoneta retirada.');
  return {unit:clearFittingGuard(next),fitting:structuredClone(fitting),destination,host:unit.weapon};
}

// Only interchangeable loose objects combine. Weapons, outfits, tools and
// identified quest objects keep their individual condition and identity.
export function pocketMergeCount(unit,sourceId,destinationId,layout=inventoryUsage(unit)){
 const source=layout.slots.find(slot=>slot.id===sourceId)?.entry,destination=layout.slots.find(slot=>slot.id===destinationId)?.entry;
 if(!source||!destination)return 0;
 if(source.item!==destination.item){
  if(!source.item.startsWith('inventory:')||!destination.item.startsWith('inventory:'))return 0;
  const a=record(unit.inventory[source.item.slice(10)]),b=record(unit.inventory[destination.item.slice(10)]);
  if(!a.name||a.weapon!==undefined||a.kind==='outfit'||a.instanceId||isTool(a)||!sameMetadata(a,b))return 0;
 }
 return Math.max(0,Math.min(source.count,destination.stackLimit-destination.count));
}

export function planPocketMove(unit,sourceId,destinationId,expectedSource,expectedDestination,count){
 const layout=inventoryUsage(unit),source=layout.slots.find(slot=>slot.id===sourceId),destination=layout.slots.find(slot=>slot.id===destinationId);
 for(const [id,expected]of [[sourceId,expectedSource],[destinationId,expectedDestination]])if(expected!==undefined&&expected!==pocketFingerprint(layout.slots.find(slot=>slot.id===id)))fail('Cambió el contenido del bolsillo. Seleccioná el objeto de nuevo.');
 if(!source?.entry||!destination||source===destination)fail('Seleccioná un objeto y otro bolsillo.');
 if(count!==undefined){quantity(count,1);if(count>source.entry.count)fail('No queda esa cantidad en el bolsillo de origen.');}
 const requested=count??source.entry.count;
 if(source.entry.slotSize>1&&destination.size!=='large')fail('Ese objeto necesita un bolsillo grande.');
 const merging=pocketMergeCount(unit,sourceId,destinationId,layout);
 let next=structuredClone(unit),slots=structuredClone(layout.slots),from=slots.find(slot=>slot.id===sourceId),to=slots.find(slot=>slot.id===destinationId);
 if(merging){
  const moved=Math.min(requested,merging);
  if(source.entry.item!==destination.entry.item){
   next=extractItemQuantity(unit,source.entry.item,moved).unit;
   const key=destination.entry.item.slice(10),value=record(next.inventory[key]);
   next.inventory[key]={...value,count:quantity(value.count+moved)};
  }
  from.entry.count-=moved;to.entry.count+=moved;if(!from.entry.count)from.entry=null;
 }else if(!destination.entry){
  to.entry={...from.entry,count:requested};from.entry.count-=requested;if(!from.entry.count)from.entry=null;
 }else{
  if(requested!==source.entry.count)fail('Elegí un bolsillo vacío o una pila del mismo objeto para separar la cantidad.');
  if(source.entry.item===destination.entry.item&&count!==undefined)fail('Esa pila ya está completa.');
  next.pocketOrder=rearrangePockets(layout,sourceId,destinationId);return next;
 }
 next.pocketOrder=pocketOrderFromSlots(slots);
 if(inventoryUsage(next).overloaded&&!layout.overloaded)fail('No queda espacio para separar los objetos.');
 return next;
}

export const pocketFingerprint=slot=>JSON.stringify(slot?.entry?{item:slot.entry.item,index:slot.entry.index,count:slot.entry.count}:null);

export function planEquipOutfit(unit,key){
 const value=unit.inventory?.[key];if(!value||value.kind!=='outfit')fail('Seleccioná una vestimenta guardada.');validateOutfit(value);
 const taken=extractItemQuantity(unit,`inventory:${key}`,1);let next=taken.unit;const old=wornOutfit(next);next.outfit=null;delete next.poncho;
 if(old)next=applyItemQuantity(next,{item:'outfit',...old},{deferCapacity:true});
 const {item,...outfit}=taken.stack;next.outfit=outfit;validateOutfit(outfit,{worn:true});
 if(inventoryUsage(next).overloaded)fail('No queda un bolsillo grande para la vestimenta retirada.');return next;
}
export function planStowOutfit(unit){const taken=extractItemQuantity(unit,'outfit',1);return applyItemQuantity(taken.unit,taken.stack);}

export function planHoldOffhand(unit,item){
 const next=structuredClone(unit);
 if(item===null){if(unit.leftHandItem==null)fail('La segunda mano no tiene un objeto seleccionado.');next.leftHandItem=null;}
 else {
  const entry=resolve(unit,item);
  if(!['inventory','supply'].includes(entry.kind)||entry.kind==='inventory'&&entry.record.weapon!==undefined)fail('Elegí un pertrecho o un objeto guardado; las armas se equipan en su ranura.');
  if(itemQuantity(unit,entry.item)<1)fail('No queda ese objeto.');
  const hands=handLayout(unit);if(hands.twoHanded)fail('El arma principal ocupa las dos manos.');
  if(hands.right===entry.item)fail('Ese objeto ya está en la mano principal.');
  if(hands.left===entry.item)fail('Ese objeto ya está en la segunda mano.');
  next.leftHandItem=entry.item;
 }
 if(inventoryUsage(next).overloaded)fail('No queda espacio para guardar el objeto desplazado.');
 return next;
}

// Read a physical endpoint. Fingerprints include contents, owner and metadata,
// so a delayed drag cannot silently equip a changed item or overwrite a slot.
export function equipmentEndpoint(unit,slotId){
 if(slotId==='cursor'){validateEquipmentCursor(unit);return {id:slotId,kind:'cursor',item:unit.equipmentCursor?'cursor':null,count:unit.equipmentCursor?.stack.count??0};}
 if(slotId==='outfit'){const item=wornOutfit(unit)?'outfit':null;return {id:slotId,kind:'outfit',item,count:item?1:0};}
 const layout=handLayout(unit);
 if(slotId==='hand:right'||slotId==='hand:left'){
  const side=slotId.slice(5),item=layout[side];return {id:slotId,kind:'hand',side,item,count:item?1:0,blocked:side==='left'&&layout.twoHanded};
 }
 const pocket=inventoryUsage(unit).slots.find(slot=>slot.id===slotId);
 if(!pocket)fail('La ranura de equipo no existe.');
 return {...pocket,kind:'pocket',item:pocket.entry?.item??null,count:pocket.entry?.count??0};
}
export function equipmentFingerprint(unit,slotId){
 const endpoint=equipmentEndpoint(unit,slotId),item=endpoint.item;
 const contents=item?readItemStack(unit,item,1):null;
 return JSON.stringify({unitId:String(unit.id),slotId,item,count:endpoint.count,index:endpoint.entry?.index??0,blocked:Boolean(endpoint.blocked),contents});
}
// Slot selections name physical equipment. The virtual cursor endpoint refers
// to the exact object removed from a slot and held in saved cursor custody.
// Aggregate extraction alone would consume a different partial pocket or leave
// a selected hand occupied by an unselected copy of the same item record.
export function extractEquipmentSelection(unit,{sourceId,expectedSource,count=1}={}, {promoteOtherHand=true}={}){
 const source=equipmentEndpoint(unit,sourceId);
 if(typeof expectedSource!=='string'||equipmentFingerprint(unit,sourceId)!==expectedSource)fail('Cambió el equipo. Seleccioná el objeto de nuevo.');
 quantity(count,1);
 if(source.blocked||!source.item||count>source.count)fail('No queda esa cantidad en la ranura de origen.');
 const hands=handLayout(unit),slots=structuredClone(inventoryUsage(unit).slots);
 const extracted=extractItemQuantity(unit,source.item,count,{keepOtherHand:false});
 let next=extracted.unit;
 if(source.kind==='pocket'){
  const slot=slots.find(slot=>slot.id===sourceId);slot.entry.count-=count;
  if(!slot.entry.count)slot.entry=null;
 }else if(source.kind==='hand'){
  if(source.side==='right'){
   next.activeSlot='unarmed';delete next.activeItem;delete next.activeTool;delete next.activeSupply;
   next.leftHandItem=hands.left;
  }else next.leftHandItem=null;
  clearFittingGuard(next);lowerWeapon(next);
 }
 next.pocketOrder=pocketOrderFromSlots(slots);
 if(promoteOtherHand&&source.kind==='hand'&&source.side==='right')next=retainOtherHand(unit,next);
 // Overloaded legacy packs can still discard their contents. Validate the
 // resulting layout without requiring a free pocket for the removed item.
 inventoryUsage(next);
 return {unit:next,stack:extracted.stack,source};
}
// Clothing exchanges use the selected physical slot, even with full pockets.
// Keep the outgoing garment separate from equivalent packed garments so it
// cannot merge into an item held in the other hand or claim another pocket.
export function planOutfitPlacement(unit,source,destination){
 const other=source.kind==='outfit'?destination:source;
 if(!['pocket','hand'].includes(other.kind))fail('Elegí una mano o un bolsillo para la vestimenta.');
 if(other.blocked)fail('El arma principal ocupa las dos manos.');
 if(other.kind==='pocket'&&other.size!=='large')fail('La vestimenta necesita un bolsillo grande.');
 if(other.item&&itemDescriptor(unit,other.item).kind!=='outfit')fail('Solo podés equipar una vestimenta en esa ranura.');
 const layout=inventoryUsage(unit),hands=handLayout(unit),outgoing=wornOutfit(unit);
 let next=structuredClone(unit),incoming=null;
 if(other.item){const taken=extractItemQuantity(next,other.item,1,{keepOtherHand:false});next=taken.unit;incoming=taken.stack;}
 next.outfit=null;delete next.poncho;
 if(other.kind==='hand'){
  if(other.side==='right'){next.activeSlot='unarmed';delete next.activeItem;delete next.activeTool;delete next.activeSupply;next.leftHandItem=hands.left;}
  else next.leftHandItem=null;
 }
 if(incoming){const {item,...outfit}=incoming;validateOutfit(outfit,{worn:true});next.outfit=outfit;}
 let stored=null;
 if(outgoing){
  stored=`inventory:${uniqueKey(next.inventory??{},'outfit')}`;
  next=applyItemQuantity(next,{...outgoing,item:stored,count:1},{deferCapacity:true});
 }
 if(other.kind==='hand'){
  if(stored){if(other.side==='right'){next.activeSlot='item';next.activeItem=stored;}else next.leftHandItem=stored;}
  lowerWeapon(next);next.braced=false;next.overwatch=false;next.momentum=0;delete next.lastTargetId;delete next.lastShotPosition;
 }
 next.pocketOrder=layout.slots.flatMap(slot=>{
  if(!slot.entry||other.kind==='pocket'&&slot.id===other.id)return [];
  const {item,index}=slot.entry;
  // One packed garment has left this stack. Later equivalent garments retain
  // their own pockets while their record's stack indices close the gap.
  return [{slotId:slot.id,item,index:other.kind==='pocket'&&item===other.item&&index>other.entry.index?index-1:index,count:slot.entry.count}];
 });
 if(stored&&other.kind==='pocket')next.pocketOrder.push({slotId:other.id,item:stored,index:0});
 if(inventoryUsage(next).overloaded)fail('No queda un bolsillo grande para la vestimenta retirada.');
 return next;
}
export function placeStoredItem(unit,item,destinationId){
 const layout=inventoryUsage(unit),entry=layout.slots.find(slot=>slot.entry?.item===item);
 if(!entry)fail('El objeto no tiene un bolsillo disponible.');
 if(entry.id===destinationId)return unit;
 return planPocketMove(unit,entry.id,destinationId);
}
