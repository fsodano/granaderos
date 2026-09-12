import {OUTFITS,validateOutfit,wornOutfit} from './outfits.js';
import {handLayout,handsRequired} from './hand-layout.js';
import {allocatePockets,rearrangePockets} from './inventory-pockets.js';
import {lowerWeapon} from './weapon-readiness.js';
import {validateReloadProgress} from './weapon-reload.js';
import {WEAPONS} from './data.js';
import {clearEmptySupply} from './held-supplies.js';
import {FITTING_PATTERNS,validateFitting,validateFittingPattern,validateWeaponFittings,validateUnitFittings,fittingItemIds,heldItemIds,fittingWeight,weaponItemWeight,fittingLabel} from './weapon-fittings.js';

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
function resolve(unit, item) {
  if (typeof item !== 'string') fail('Seleccioná un objeto del inventario.');
  if (item.startsWith('inventory:')) {
    const key = safeKey(item.slice(10)), inventory = pack(unit);
    if (!own(inventory, key)) fail('Ese objeto ya no está en el inventario.');
    return {kind: 'inventory', key, item: `inventory:${key}`, record: record(inventory[key])};
  }
  if (own(SUPPLY_ITEMS, item)) return {kind: 'supply', key: item, item, count: quantity(unit[item] ?? 0)};
  if(item==='outfit')return {kind:'outfit',key:item,item,record:wornOutfit(unit)};
  if (item === 'primary' || item === 'blade' || item === 'offhand') return {kind: 'hand', key: item, item};
  const key = safeKey(item), inventory = pack(unit);
  if (!own(inventory, key)) fail('Ese objeto ya no está en el inventario.');
  return {kind: 'inventory', key, item: `inventory:${key}`, record: record(inventory[key])};
}
export function handRecord(unit, slot) {
  if(slot==='offhand'){if(!unit.offHand)fail('La mano secundaria está vacía.');return record(unit.offHand);}
  const raw = slot === 'primary' ? unit.weapon : unit.blade;
  const id = typeof raw === 'object' ? raw?.id : raw;
  const spec = weapon(id, true), primary = slot === 'primary';
  const instanceId = primary ? unit.weaponInstanceId : unit.bladeInstanceId;
  return record({count: 1, weight: spec.weight ?? (spec.type === 'firearm' ? 4 : 1.3), weapon: id,
    ...(primary && unit.reloadProgress ? {reloadProgress:unit.reloadProgress} : {}),
    loaded: primary ? unit.loaded ?? 0 : 0, condition: primary ? unit.condition ?? 100 : unit.bladeCondition ?? 100,
    jammed: primary ? unit.jammed ?? false : false, ...(instanceId === undefined ? {} : {instanceId}),
    ...(primary && unit.weaponFittings?.bayonet ? {fittings:structuredClone(unit.weaponFittings)} : {}),
    ...((primary?unit.weaponFittingPattern:unit.bladeFittingPattern)!=null ? {fittingPattern:primary?unit.weaponFittingPattern:unit.bladeFittingPattern} : {})});
}
function recordDescriptor(item, value) {
  const spec = value.weapon === undefined ? null : weapon(value.weapon);
  const handheld = spec && spec.id >= 1800 && spec.id <= 1813;
  const compactWeapon = handheld && [1805, 1806, 1808, 1811, 1813].includes(spec.id);
  const slotSize = value.kind==='outfit'?2:handheld ? compactWeapon ? 1 : 2 : value.weight > 2 ? 2 : 1;
  const label = value.kind==='outfit'?OUTFITS[value.outfit].name:value.fittingPattern != null ? fittingLabel(value.fittingPattern) : spec?.name ?? (isTool(value) ? TOOL_LABELS[value.toolKey] : item.replace(/^inventory:/, ''));
  return {item, label, name: label, ...(spec?{weapon:spec.id,loaded:value.loaded,condition:value.condition}:value.condition!==undefined?{condition:value.condition}:{}), stackLimit: spec || isTool(value) || value.instanceId ? 1 : slotSize === 2 ? 1 : 4, slotSize, weight: value.weight+fittingWeight(value), kind: value.kind==='outfit'?'outfit':spec ? 'weapon' : isTool(value) ? 'tool' : 'inventory'};
}

export function itemQuantity(unit, item) {
  const entry = resolve(unit, item);
  if(entry.kind==='outfit')return entry.record?1:0;
  if (entry.kind === 'supply') return entry.count;
  if (entry.kind === 'inventory') return entry.record.count;
  return entry.key==='offhand'?unit.offHand?1:0:entry.key === 'primary' ? unit.weapon && !unit.weaponDropped ? 1 : 0 : unit.blade ? 1 : 0;
}
export function itemDescriptor(unit, item) {
  const entry = resolve(unit, item);
  if(entry.kind==='outfit')return entry.record?recordDescriptor(item,entry.record):{item,label:'Sin vestimenta equipada',weight:0,stackLimit:1,slotSize:2,kind:'outfit'};
  if (entry.kind === 'supply') return SUPPLY_ITEMS[item];
  if (entry.kind === 'inventory') return recordDescriptor(entry.item, entry.record);
  if (!itemQuantity(unit, item)) return {item, label: 'Mano vacía', name: 'Mano vacía', stackLimit: 1, slotSize: 0, weight: 0, kind: 'weapon'};
  return recordDescriptor(item, handRecord(unit, item));
}
export function validateHands(unit) {
  wornOutfit(unit);
  if(unit.leftHandItem!=null){
    const entry=resolve(unit,unit.leftHandItem);
    if(entry.item!==unit.leftHandItem||!['inventory','supply'].includes(entry.kind)||entry.kind==='inventory'&&entry.record.weapon!==undefined)fail('El objeto de la segunda mano no es válido.');
  }
  if(unit.offHand!==undefined){
    const value=handRecord(unit,'offhand');
    if(value.count!==1||value.weapon<1800||value.weapon>1813||!WEAPONS[value.weapon]||handsRequired(value.weapon)!==1)fail('El arma de la segunda mano no es válida.');
  }
  return true;
}
export function inventoryUsage(unit) {
  validateHands(unit);
  const items = [],hands=handLayout(unit);
  for (const item of [...Object.keys(SUPPLY_ITEMS), ...Object.keys(pack(unit)).sort().map(key => `inventory:${key}`),...hands.stowed]) {
    const count = itemQuantity(unit, item)-(hands.held.includes(item)?1:0);
    if (!count) continue;
    const descriptor = itemDescriptor(unit, item), stacks = Math.ceil(count / descriptor.stackLimit);
    items.push({...descriptor, count, stacks, slots: stacks});
  }
  const used = items.reduce((total, entry) => total + entry.slots, 0);
  const layout=allocatePockets(items,unit.pocketOrder);
  return {used, capacity: INVENTORY_CAPACITY, free: layout.slots.filter(slot=>!slot.entry).length, overloaded: layout.overflow.length>0, items,...layout};
}

export function extractItemQuantity(unit, item, count = 1, {keepOtherHand=true}={}) {
  quantity(count, 1);
  const entry = resolve(unit, item);
  if (itemQuantity(unit, item) < count) fail('No queda esa cantidad del objeto.');
  const next = structuredClone(unit);
  let stack;
  if (entry.kind === 'supply') {
    next[item] = entry.count - count;
    clearEmptySupply(next);
    stack = {item, count, weight: SUPPLY_ITEMS[item].weight};
  } else if(entry.kind==='outfit'){stack={item:'outfit',...entry.record,count:1};next.outfit=null;delete next.poncho;
  } else if (entry.kind === 'hand') {
    stack = {item: 'weapon', ...handRecord(unit, entry.key)};
    if (entry.key === 'primary') {lowerWeapon(next); next.weaponDropped = true; next.loaded = 0; delete next.reloadProgress; next.jammed = false; delete next.weaponInstanceId; next.weaponFittings={}; next.weaponFittingPattern=null;}
    else if(entry.key==='offhand')delete next.offHand;
    else {delete next.blade; delete next.bladeInstanceId; delete next.bladeCondition; next.bladeFittingPattern=null;}
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
  if(next.leftHandItem===entry.item&&(entry.kind==='inventory'?!next.inventory?.[entry.key]||!(typeof next.inventory[entry.key]==='number'?next.inventory[entry.key]:next.inventory[entry.key].count):itemQuantity(next,entry.item)===0))next.leftHandItem=null;
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
    next.weaponFittings=structuredClone(held.fittings??{});next.weaponFittingPattern=held.fittingPattern??null;delete next.weaponInstanceId;if(held.instanceId)next.weaponInstanceId=held.instanceId;
    next.activeSlot='primary';lowerWeapon(next);
  }
  return next;
}
function incoming(stack) {
  if (!object(stack) || typeof stack.item !== 'string') fail('El objeto transferido no es válido.');
  quantity(stack.count, 1);
  if (own(SUPPLY_ITEMS, stack.item)) {
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
  const fitting={weapon:stack.weapon,fittingPattern:stack.fittingPattern,instanceId:stack.instanceId,condition:stack.condition};
  validateFitting(fitting,unit.weapon);
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
  const stack={item:'weapon',count:1,weight:FITTING_PATTERNS[fitting.fittingPattern].weight,weapon:fitting.weapon,loaded:0,jammed:false,condition:fitting.condition,instanceId:fitting.instanceId,fittingPattern:fitting.fittingPattern};
  if (destination==='inventory') next=applyItemQuantity(next,stack);
  else {
    if (next.blade || next.offHand) fail('La mano secundaria está ocupada.');
    next.blade=fitting.weapon;next.bladeCondition=fitting.condition;next.bladeInstanceId=fitting.instanceId;next.bladeFittingPattern=fitting.fittingPattern;
  }
  if(inventoryUsage(next).overloaded)fail('No queda espacio para guardar la bayoneta retirada.');
  return {unit:clearFittingGuard(next),fitting:structuredClone(fitting),destination,host:unit.weapon};
}

export function planPocketMove(unit,sourceId,destinationId,expectedSource,expectedDestination){
 const layout=inventoryUsage(unit),next=structuredClone(unit);
 for(const [id,expected]of [[sourceId,expectedSource],[destinationId,expectedDestination]])if(expected!==undefined&&expected!==pocketFingerprint(layout.slots.find(slot=>slot.id===id)))throw Error('Cambió el contenido del bolsillo. Seleccioná el objeto de nuevo.');
 next.pocketOrder=rearrangePockets(layout,sourceId,destinationId);
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
