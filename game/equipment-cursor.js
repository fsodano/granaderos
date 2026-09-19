import {syncUnitAmmunition} from './tactical-ammunition.js';
import {isAmmunitionStack,weaponAmmoType} from './ammunition-types.js';
import {planReload,reloadRoundCost} from './weapon-reload.js';
import {WEAPONS} from './data.js';
import {FITTING_PATTERNS,FIT_BAYONET_AP,REMOVE_BAYONET_AP,fittingFromItem,fittingToItem} from './weapon-fittings.js';
import {handsRequired,handLayout} from './hand-layout.js';
import {HELD_SUPPLIES} from './held-supplies.js';
import {POCKETS,pocketOrderFromSlots} from './inventory-pockets.js';
import {wornOutfit,validateOutfit} from './outfits.js';
import {lowerWeapon} from './weapon-readiness.js';
import {SUPPLY_ITEMS,inventoryUsage,equipmentEndpoint,equipmentFingerprint,readItemStack,readItemStacks,itemStackDescriptor,equipmentStacksMerge,validateItemStack,validateEquipmentCursor,handMetadata} from './tactical-inventory.js';
export {validateEquipmentCursor} from './tactical-inventory.js';
const copy=value=>structuredClone(value);
const need=(ok,text)=>{if(!ok)throw Error(text);};
const physical=id=>id==='outfit'||id==='hand:right'||id==='hand:left'||POCKETS.some(slot=>slot.id===id);
const qty=(value,max)=>need(Number.isSafeInteger(value)&&value>0&&value<=max,'No queda esa cantidad del objeto.');
const stackAt=(unit,item,count)=>item?readItemStack(unit,item,count):null;
function model(unit){
 validateEquipmentCursor(unit);const usage=inventoryUsage(unit),hands=handLayout(unit);
 const entries=[...usage.slots.flatMap(slot=>slot.entry?[slot.entry]:[]),...usage.overflow,...[hands.right,hands.left].filter(Boolean).map(item=>({item,count:1}))];
 const stacks=readItemStacks(unit,entries);let index=0;
 return {slots:usage.slots.map(slot=>({...slot,stack:slot.entry?stacks[index++]:null})),overflow:usage.overflow.map(()=>stacks[index++]),right:hands.right?stacks[index++]:null,left:hands.left?stacks[index++]:null,outfit:wornOutfit(unit)?{item:'outfit',...copy(wornOutfit(unit))}:null,cursor:copy(unit.equipmentCursor)};
}
const metadata=stack=>JSON.stringify(Object.fromEntries(Object.entries(stack).filter(([key])=>key!=='count'&&key!=='item').sort(([a],[b])=>a.localeCompare(b))));
// The model owns exact physical stacks. Rebuild aggregate records once, after
// the complete exchange is legal; never hide an outgoing item in another slot.
function materialize(before,m){
 const next=copy(before);delete next.equipmentCursor;next.inventory={};for(const key of Object.keys(SUPPLY_ITEMS))next[key]=0;
 next.weapon=0;next.weaponDropped=true;next.loaded=0;next.jammed=false;delete next.reloadProgress;delete next.weaponInstanceId;delete next.weaponMetadata;next.weaponFittings={};next.weaponFittingPattern=null;
 next.blade=0;delete next.bladeInstanceId;delete next.bladeCondition;delete next.bladeMetadata;next.bladeFittingPattern=null;delete next.offHand;next.outfit=null;delete next.poncho;
 next.activeSlot='unarmed';delete next.activeItem;delete next.activeTool;delete next.activeSupply;next.leftHandItem=null;
 const store=stack=>{
  validateItemStack(stack);
  if(Object.hasOwn(SUPPLY_ITEMS,stack.item)){next[stack.item]+=stack.count;need(Number.isSafeInteger(next[stack.item])&&next[stack.item]<=1000000,'La cantidad del objeto no es válida.');return stack.item;}
  const {item,...record}=copy(stack);let base=item.startsWith('inventory:')?item.slice(10):item==='weapon'?`weapon:${record.weapon}`:item;
  let key=base,index=1;
  while(next.inventory[key]&&(record.instanceId||metadata(next.inventory[key])!==metadata(record)))key=`${base.slice(0,88)}:${index++}`;
  if(next.inventory[key])next.inventory[key].count+=record.count;else next.inventory[key]=record;
  validateItemStack({...next.inventory[key],item:`inventory:${key}`});return `inventory:${key}`;
 };
 const slots=m.slots.map(slot=>({...slot,entry:slot.stack?{...itemStackDescriptor(slot.stack),item:store(slot.stack),count:slot.stack.count}:null}));
 for(const stack of m.overflow)store(stack);
 if(m.outfit){const {item,...outfit}=copy(m.outfit);validateOutfit(outfit,{worn:true});next.outfit=outfit;}
 const originalHands=handLayout(before);
 const install=(stack,side)=>{
  if(!stack)return;
  if(stack.weapon!==undefined){
   need(Object.hasOwn(WEAPONS,stack.weapon)&&stack.weapon>=1800&&stack.weapon<=1813,'Ese equipo no se puede usar en una mano.');
   need(stack.count===1,'Las manos admiten un objeto por ranura.');
   if(side==='right'&&stack.weapon>=1809&&!stack.jammed&&!stack.reloadProgress&&!stack.fittings){
    const metadata=handMetadata(stack);if(Object.keys(metadata).length)next.bladeMetadata=metadata;
    next.blade=stack.weapon;next.bladeCondition=stack.condition??100;if(stack.instanceId)next.bladeInstanceId=stack.instanceId;next.bladeFittingPattern=stack.fittingPattern??null;next.activeSlot='blade';
   }else if(side==='right'){
    const metadata=handMetadata(stack);if(Object.keys(metadata).length)next.weaponMetadata=metadata;
    next.weapon=stack.weapon;next.weaponDropped=false;next.loaded=stack.loaded??0;next.condition=stack.condition??100;next.jammed=Boolean(stack.jammed);if(stack.reloadProgress)next.reloadProgress=stack.reloadProgress;
    if(stack.instanceId)next.weaponInstanceId=stack.instanceId;next.weaponFittings=copy(stack.fittings??{});next.weaponFittingPattern=stack.fittingPattern??null;next.activeSlot='primary';
   }else if(next.activeSlot!=='blade'&&originalHands.left==='blade'&&stack.weapon>=1809&&metadata(stack)===metadata(stackAt(before,'blade',1))){
    const metadata=handMetadata(stack);if(Object.keys(metadata).length)next.bladeMetadata=metadata;
    next.blade=stack.weapon;next.bladeCondition=stack.condition??100;if(stack.instanceId)next.bladeInstanceId=stack.instanceId;next.bladeFittingPattern=stack.fittingPattern??null;next.leftHandItem='blade';
   }else {const {item,...record}=copy(stack);next.offHand=record;next.leftHandItem='offhand';}
  }else{
   const item=store(stack);
   if(side==='left')next.leftHandItem=item;
   else if(item==='medkits')next.activeSlot='medical';
   else if(Object.hasOwn(HELD_SUPPLIES,item)){next.activeSlot='supply';next.activeSupply=item;}
   else if(stack.itemType==='tool'||stack.kind==='tool'){next.activeSlot='tool';next.activeTool=item;}
   else {next.activeSlot='item';next.activeItem=item;}
  }
 };
 install(m.right,'right');install(m.left,'left');next.pocketOrder=pocketOrderFromSlots(slots);
 if(m.cursor)next.equipmentCursor=copy(m.cursor);
 const old=handLayout(before),sameHands=metadata(stackAt(before,old.right,1)??{})===metadata(m.right??{})&&metadata(stackAt(before,old.left,1)??{})===metadata(m.left??{});
 if(!sameHands){lowerWeapon(next);next.braced=false;next.overwatch=false;next.momentum=0;delete next.lastTargetId;delete next.lastShotPosition;}
 if(next.ammunitionVersion===1)syncUnitAmmunition(next);
 inventoryUsage(next);validateEquipmentCursor(next);return next;
}
function cell(m,id){
 if(id==='hand:right'||id==='hand:left'){const key=id.slice(5);return {kind:'hand',side:key,get stack(){return m[key];},set stack(value){m[key]=value;}};}
 if(id==='outfit')return {kind:'outfit',get stack(){return m.outfit;},set stack(value){m.outfit=value;}};
 const slot=m.slots.find(slot=>slot.id===id);need(slot,'La ranura de equipo no existe.');return {kind:'pocket',size:slot.size,get stack(){return slot.stack;},set stack(value){slot.stack=value;}};
}
const fits=(stack,slot)=>itemStackDescriptor(stack).slotSize<=1||slot.size==='large';
function autoplace(m,raw,{exclude=null,emptyOnly=false}={}){
 let stack=copy(raw);
 if(!emptyOnly)for(const slot of m.slots){
  if(slot.id===exclude||!slot.stack||!fits(stack,slot)||!equipmentStacksMerge(stack,slot.stack))continue;
  const moved=Math.min(stack.count,itemStackDescriptor(slot.stack).stackLimit-slot.stack.count);slot.stack.count+=moved;stack.count-=moved;if(!stack.count)return null;
 }
 for(const slot of m.slots){
  if(slot.id===exclude||slot.stack||!fits(stack,slot))continue;
  const moved=Math.min(stack.count,itemStackDescriptor(stack).stackLimit);slot.stack={...copy(stack),count:moved};stack.count-=moved;if(!stack.count)return null;
 }
 return stack;
}
function place(m,destinationId,count){
 const cursor=m.cursor;need(cursor,'El cursor está vacío.');const destination=cell(m,destinationId),incoming=cursor.stack;qty(count,incoming.count);
 const description=itemStackDescriptor(incoming);
 if(destination.kind==='outfit')need(description.kind==='outfit','Solo podés equipar una vestimenta en esa ranura.');
 if(destination.kind==='pocket')need(description.slotSize<=1||destination.size==='large','Ese objeto necesita un bolsillo grande.');
 if(destination.kind==='hand'){
  if(incoming.weapon!==undefined)need(Object.hasOwn(WEAPONS,incoming.weapon)&&incoming.weapon>=1800&&incoming.weapon<=1813,'Ese equipo no se puede usar en una mano.');
  if(destination.side==='left'){need(!(m.right?.weapon&&handsRequired(m.right.weapon)===2),'El arma principal ocupa las dos manos.');need(!incoming.weapon||handsRequired(incoming.weapon)===1,'El arma necesita las dos manos.');}
  if(destination.side==='right'&&incoming.weapon&&handsRequired(incoming.weapon)===2&&m.left){
   if(m.right){const spare=m.slots.find(slot=>!slot.stack&&fits(m.left,slot));need(spare,'No queda un bolsillo vacío para el objeto de la segunda mano.');spare.stack=m.left;m.left=null;}
   else {m.right=m.left;m.left=null;}
  }
 }
 const limit=destination.kind==='pocket'?description.stackLimit:1,outgoing=destination.stack;
 if(destination.kind==='pocket'&&outgoing&&equipmentStacksMerge(incoming,outgoing)){
  const moved=Math.min(count,limit-outgoing.count);need(moved>0,'Esa pila ya está completa.');outgoing.count+=moved;incoming.count-=moved;if(!incoming.count)m.cursor=null;return;
 }
 const moved=Math.min(count,limit),remaining=incoming.count-moved;
 if(outgoing&&remaining){
  const unplaced=autoplace(m,outgoing,{exclude:destinationId});need(!unplaced,'No queda espacio para guardar el objeto desplazado.');
 }
 destination.stack={...copy(incoming),count:moved};
 m.cursor=remaining?{sourceId:cursor.sourceId,stack:{...copy(incoming),count:remaining}}:outgoing?{sourceId:cursor.sourceId,stack:copy(outgoing)}:null;
}
export function planEquipmentPickup(unit,action){
 need(!unit.equipmentCursor,'Primero colocá el objeto del cursor.');need(physical(action.sourceId),'Elegí una ranura física de equipo.');
 need(typeof action.expectedSource==='string'&&action.expectedSource===equipmentFingerprint(unit,action.sourceId),'Cambió el equipo. Volvé a seleccionar el objeto.');
 const m=model(unit),source=cell(m,action.sourceId);need(source.stack,'La ranura de origen está vacía.');const count=action.count===undefined?1:action.count;qty(count,source.stack.count);
 m.cursor={sourceId:action.sourceId,stack:{...copy(source.stack),count}};source.stack.count-=count;if(!source.stack.count)source.stack=null;
 return {unit:materialize(unit,m),pa:0};
}
export function planEquipmentCursorPlacement(unit,action,{exploring=true,assisted=false}={}){
 need(physical(action.destinationId),'Elegí una ranura física de equipo.');
 for(const [id,expected]of [['cursor',action.expectedSource],[action.destinationId,action.expectedDestination]])need(typeof expected==='string'&&expected===equipmentFingerprint(unit,id),'Cambió el equipo. Volvé a seleccionar el objeto.');
 const m=model(unit);need(m.cursor,'El cursor está vacío.');
 const host=cell(m,action.destinationId),gun=host.stack,ammo=m.cursor.stack,count=action.count===undefined?ammo.count:action.count;
 // Ammunition on a firearm means load this exact gun, without equipping it or
 // borrowing another stack. Cancellation still uses ordinary slot placement.
 if(isAmmunitionStack(ammo)&&WEAPONS[gun?.weapon]?.type==='firearm'){
  qty(count,ammo.count);
  need(gun.count===1,'Elegí una sola arma para recargar.');
  need(ammo.ammoType===weaponAmmoType(gun.weapon),'Esta munición no es compatible con el arma.');
  const weapon=WEAPONS[gun.weapon];
  need((gun.loaded??0)<weapon.capacity,'El arma ya está cargada.');
  need(!gun.jammed,'Primero debes volver a cebar el arma.');
  need((gun.condition??100)>0,'El arma está rota.');
  const reload=planReload({...gun,loaded:gun.loaded??0,ammo:count,ap:unit.ap},reloadRoundCost(unit,weapon,assisted),weapon.capacity,exploring);
  need(reload.pa>0,'Faltan puntos de acción para recargar.');
  gun.loaded=(gun.loaded??0)+reload.rounds;
  if(reload.progress>0)gun.reloadProgress=reload.progress;else delete gun.reloadProgress;
  ammo.count-=reload.rounds;if(!ammo.count)m.cursor=null;
  // Priming powder can itself occupy either hand. Remove spent portions
  // before rebuilding ownership, so an empty hand cannot retain a stale item.
  let priming=reload.rounds;
  for(const stack of [...m.slots.map(slot=>slot.stack),...m.overflow,m.right,m.left])if(stack?.item==='priming'){
   const spent=Math.min(priming,stack.count);stack.count-=spent;priming-=spent;
  }
  for(const slot of m.slots)if(slot.stack?.count===0)slot.stack=null;
  m.overflow=m.overflow.filter(stack=>stack.count>0);
  if(m.right?.count===0)m.right=null;if(m.left?.count===0)m.left=null;
  const next=materialize(unit,m);
  lowerWeapon(next);next.braced=false;next.overwatch=false;next.momentum=0;delete next.lastTargetId;delete next.lastShotPosition;
  return {unit:next,...reload,operation:'reload',host:gun.weapon,actionLabel:`Recargar ${weapon.name}`,seconds:Math.max(1,Math.ceil(reload.pa*.06))};
 }
 place(m,action.destinationId,count);
 return {unit:materialize(unit,m),pa:0};
}
export function planEquipmentCursorReturn(unit){
 const m=model(unit);need(m.cursor,'El cursor está vacío.');const origin=m.cursor.sourceId;
 // The original slot is a return hint. It can now hold another item, so its
 // attempted placement may exchange that item back onto the same cursor.
 try{const returned=copy(m);place(returned,origin,returned.cursor.stack.count);Object.assign(m,returned);}catch{}
 if(m.cursor){const remaining=autoplace(m,m.cursor.stack);m.cursor=remaining?{sourceId:origin,stack:remaining}:null;}
 const dropped=m.cursor?copy(m.cursor.stack):null;m.cursor=null;
 return {unit:materialize(unit,m),dropped};
}

// A weapon detail names the physical host slot. The cursor remains a separate
// custodian, including when a full pack cannot accept the removed attachment.
export function equipmentAttachmentHost(unit,hostId){
 need(physical(hostId)&&hostId!=='outfit','Elegí la ranura del arma.');
 const endpoint=equipmentEndpoint(unit,hostId);
 need(!endpoint.blocked&&endpoint.item&&endpoint.count===1,'El arma ya no está en esa ranura.');
 const stack=readItemStack(unit,endpoint.item,1);
 need(WEAPONS[stack.weapon]?.type==='firearm','Ese objeto no admite accesorios.');
 return {hostId,stack,supported:Object.values(FITTING_PATTERNS).some(pattern=>pattern.host===stack.weapon),fitting:copy(stack.fittings?.bayonet??null)};
}
export function planEquipmentAttachment(unit,action){
 const {hostId,operation}=action;
 need(['attach','detach'].includes(operation),'Elegí colocar o retirar el accesorio.');
 for(const [id,expected]of [[hostId,action.expectedHost],['cursor',action.expectedCursor]])need(typeof expected==='string'&&expected===equipmentFingerprint(unit,id),'Cambió el arma o el objeto del cursor. Revisá el equipo.');
 const info=equipmentAttachmentHost(unit,hostId);
 need(info.supported,'Este modelo de arma no admite la bayoneta disponible.');
 const m=model(unit),host=cell(m,hostId),previous=host.stack.fittings?.bayonet;
 let pa;
 if(operation==='attach'){
  need(m.cursor,'Tomá una bayoneta antes de colocarla.');
  const fitting=fittingFromItem(m.cursor.stack,host.stack.weapon);
  need(fitting.condition>0,'La bayoneta está rota.');
  const returned=previous?fittingToItem(previous):null;
  host.stack.fittings={bayonet:fitting};
  m.cursor=returned?{sourceId:m.cursor.sourceId,stack:returned}:null;
  pa=FIT_BAYONET_AP+(previous?REMOVE_BAYONET_AP:0);
 }else{
  need(!m.cursor,'Colocá primero el objeto del cursor.');
  need(previous,'El arma no tiene una bayoneta fijada.');
  m.cursor={sourceId:`attachment:${hostId}`,stack:fittingToItem(previous)};
  host.stack.fittings={};pa=REMOVE_BAYONET_AP;
 }
 const next=materialize(unit,m);
 lowerWeapon(next);next.braced=false;next.overwatch=false;next.momentum=0;delete next.lastTargetId;delete next.lastShotPosition;
 return {unit:next,pa,operation,swapped:Boolean(operation==='attach'&&previous),host:host.stack.weapon};
}
