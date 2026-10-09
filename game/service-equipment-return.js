import {BODY_SLOTS,wornBodyItems} from './outfits.js';
import {SUPPLY_ITEMS,itemQuantity,extractItemQuantity,validateItemStack,validateHands,validateEquipmentCursor} from './tactical-inventory.js';
import {returnEquipment} from './equipment.js';
import {syncUnitAmmunition} from './tactical-ammunition.js';
import {syncCarriedAmmunition} from './campaign-ammunition.js';
import {operativeLocation} from './squads.js';
import {MISSION_SCENES} from './missions.js';
import {validWorldLocation} from './world-cells.js';
import {validEntry,boundaryMatches} from './tactical-exits.js';
import {physicalEntryAnchor} from './sector-expansion.js';
import {planningPoint} from './tactical-planning-space.js';
import {propBlocksAt} from './props.js';
import {expandCellScene} from './cell-scene-storage.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {weaponSaveReplacer} from './weapon-definition.js';
import {canonicalContent} from './content-identity.js';
import {MAX_SAVE_BYTES,saveByteLength} from './save-limits.js';
import {rosterFor as baseRosterFor} from './recruitment.js';

export const MAX_SERVICE_RETURN_STACKS=1024;
export const MAX_SERVICE_RETURN_BYTES=512*1024;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const need=(ok,message='El equipo devuelto del servicio es inválido.')=>{if(!ok)throw Error(message);};
const copy=v=>structuredClone(v);
const idNumber=id=>typeof id==='string'&&/^service-return-[1-9][0-9]*$/.test(id)?Number(id.slice(15)):NaN;
const siteSector=id=>MISSION_SCENES[id]?.anchor??id;
const snapshotAt=(s,id)=>expandCellScene(id==='yatasto'?s.sceneStates?.[id]:s.sectorStates?.[id]);
const sourceKey=(id,item)=>JSON.stringify(['serviceReturn',id,item]);
const recordFields=['inventory','condition','rations','medkits','boleadoras','torches','pocketOrder'];
const equipmentRoster=s=>baseRosterFor(s).map(op=>({...op,...s.loadouts?.[op.id]}));

export function migrateServiceEquipmentReturns(s){
 if(s.serviceEquipmentReturns===undefined)s.serviceEquipmentReturns={version:1,nextId:1,entries:[]};
 return s;
}
export function serviceReturnCacheBytes(s,entries=s.serviceEquipmentReturns?.entries??[]){
 return saveByteLength(canonicalContent(JSON.parse(JSON.stringify(entries,weaponSaveReplacer(s)))));
}
function carrier(s,id,roster){
 const r=s.operativeState[id],op=roster.find(o=>Number(o.id)===Number(id));
 need(op&&r);
 const loadout=s.loadouts?.[id]??{},unit={...op,...loadout,...r,id:String(id),side:'player',loaded:r.carriedLoaded??0,reloadProgress:r.carriedReloadProgress,ammunitionVersion:2};
 if(loadout.weapon===0)for(const key of ['contentWeapon','weaponMetadata','ammunitionChoice'])delete unit[key];
 if(loadout.blade===0)delete unit.bladeMetadata;
 return syncUnitAmmunition(unit);
}
function selections(unit){
 return [...(unit.equipmentCursor?['cursor']:[]),...(!unit.weaponDropped&&unit.weapon?['primary']:[]),...(unit.blade?['blade']:[]),...(unit.offHand?['offhand']:[]),...wornBodyItems(unit),...Object.keys(unit.inventory??{}).map(key=>`inventory:${key}`),...Object.keys(SUPPLY_ITEMS).filter(key=>key!=='ammo'||unit.ammunitionVersion!==2)]
  .filter(item=>itemQuantity(unit,item)>0);
}
function extractAll(unit){
 let empty=copy(unit);const items=[];
 for(const selection of selections(unit)){
  const taken=extractItemQuantity(empty,selection,itemQuantity(empty,selection),{keepOtherHand:false});
  validateItemStack(taken.stack);items.push({selection,stack:taken.stack});empty=taken.unit;
 }
 return {empty,items};
}
function commitCarrier(s,id,next,{empty=false}={}){
 const r=s.operativeState[id];
 if(empty){
  next.weapon=0;next.blade=0;next.loaded=0;next.inventory={};next.activeSlot='unarmed';next.weaponDropped=false;next.jammed=false;next.weaponFittings={};next.weaponFittingPattern=null;next.bladeFittingPattern=null;
  for(const slot of BODY_SLOTS)next[slot]=null;
  for(const key of Object.keys(SUPPLY_ITEMS))next[key]=0;
  next.pocketOrder=[];
  for(const key of ['contentWeapon','weaponMetadata','bladeMetadata','ammunitionChoice','offHand','equipmentCursor','weaponInstanceId','bladeInstanceId','reloadProgress','leftHandItem','activeTool','activeSupply','activeItem'])delete next[key];
 }
 returnEquipment(s,id,next);
 for(const key of recordFields)if(next[key]!==undefined)r[key]=copy(next[key]);
 // A direct legacy definition must not outlive its physical host.
 if(!next.weapon||next.weaponDropped)delete r.contentWeapon;
 for(const key of ['weapon','blade','loaded','reloadProgress'])delete r[key];
 r.carriedLoaded=next.loaded??0;
 if(next.reloadProgress!==undefined)r.carriedReloadProgress=next.reloadProgress;else delete r.carriedReloadProgress;
 syncCarriedAmmunition(r,next.weapon);
}
function markerAt(s,id){
 const r=s.operativeState[id],sectorId=operativeLocation(s,id);
 const resident=r.residentScene??r.residentSector;
 const siteId=resident&&siteSector(resident)===sectorId?resident:sectorId;
 const marker={id:`service-return-${s.serviceEquipmentReturns.nextId++}`,siteId,sectorId,entryEdge:r.arrival?.entryEdge??'S',entryAnchor:copy(r.arrival?.entryAnchor??{x:10,y:15})};
 const snapshot=snapshotAt(s,siteId),old=snapshot?.units?.find(u=>String(u.id)===String(id)&&u.side==='player'&&u.hp>0&&!u.departure);
 if((r.residentPosition||old)&&r.residentSector===snapshot?.sectorId&&(r.residentScene??null)===(snapshot.sceneId??null))marker.point=planningPoint(r.residentPosition??old,Boolean(snapshot.upperSurfaces?.length));
 const point=returnPlacement(marker,snapshot);if(point)marker.point=point;
 return marker;
}
function returnPlacement(marker,snapshot){
 if(!snapshot)return null;
 const level=marker.point?.tacticalLevel??0;
 const surfaces=level===0?snapshot.tiles:snapshot.upperSurfaces;
 const usable=p=>p&&!p.blocked&&!propBlocksAt(snapshot,p.x,p.y,level);
 if(marker.point&&surfaces?.some(p=>p.x===marker.point.x&&p.y===marker.point.y&&(p.tacticalLevel??0)===level&&usable(p)))return copy(marker.point);
 // A saved resident's invalid floor is not replaced by an invented position.
 if(marker.point)return null;
 const anchor=physicalEntryAnchor(marker.entryEdge,marker.entryAnchor,snapshot.width,snapshot.height,marker.siteId);
 const candidates=(snapshot.tiles??[]).filter(p=>boundaryMatches(snapshot,p,marker.entryEdge)&&usable(p));
 candidates.sort((a,b)=>Math.abs(a.x-anchor.x)+Math.abs(a.y-anchor.y)-Math.abs(b.x-anchor.x)-Math.abs(b.y-anchor.y)||a.y-b.y||a.x-b.x);
 return candidates[0]?planningPoint(candidates[0]):null;
}
function retireSnapshotIdentities(snapshot){
 for(const old of snapshot.units.filter(u=>u.side==='player'&&u.hp>0&&snapshot.returnLedger?.entries.some(e=>e.unitId===u.id&&['resident','departed'].includes(e.kind)))){
  delete old.weaponInstanceId;delete old.bladeInstanceId;old.weaponFittingPattern=null;old.bladeFittingPattern=null;old.weaponFittings={};delete old.equipmentCursor;
  for(const item of [...(old.offHand?[old.offHand]:[]),...BODY_SLOTS.flatMap(slot=>old[slot]?[old[slot]]:[]),...Object.values(old.inventory??{})])if(object(item)){delete item.instanceId;delete item.fittingPattern;delete item.fittings;}
 }
}
function cacheFits(s,entries){
 return entries.length<=MAX_SERVICE_RETURN_STACKS&&entries.every(r=>object(r)&&Array.isArray(r.items))&&entries.reduce((sum,r)=>sum+r.items.length+(r.repairPoints>0?1:0),0)<=MAX_SERVICE_RETURN_STACKS&&serviceReturnCacheBytes(s,entries)<=MAX_SERVICE_RETURN_BYTES;
}
function saveFits(s,roster){
 // Leave room for compact per-operative overflow markers and the save envelope.
 return saveByteLength(JSON.stringify(s,weaponSaveReplacer(s)))<=MAX_SAVE_BYTES-512*roster.length-8192;
}

// The campaign calls this only for ordinary departures, after actual arrival or
// the accepted return report. Capture and death keep their existing custodians.
export function returnServiceEquipment(s,id,roster){
 const r=s.operativeState[id];if(!r?.alive||r.hp<=0||r.captured)return null;
 migrateServiceEquipmentReturns(s);need(!r.serviceEquipmentReturn,'El combatiente aún tiene equipo por recoger.');
 const unit=carrier(s,id,roster),{empty,items}=extractAll(unit),repairPoints=r.toolkitPoints??0;
 if(!items.length&&!repairPoints){commitCarrier(s,id,empty,{empty:true});return null;}
 const marker=markerAt(s,id),snapshot=snapshotAt(s,marker.siteId),point=returnPlacement(marker,snapshot);
 const ground=Boolean(snapshot&&point&&(snapshot.groundItems?.length??0)+items.length<=2000);
 const entry={...marker,operativeId:id,items:ground?[]:copy(items),repairPoints};
 const entries=[...s.serviceEquipmentReturns.entries,...(entry.items.length||repairPoints?[entry]:[])];
 if(cacheFits(s,entries)){
  const planned=copy(s);planned.serviceEquipmentReturns.entries=copy(entries);commitCarrier(planned,id,empty,{empty:true});planned.operativeState[id].toolkitPoints=0;
  if(ground){
   const placed=snapshotAt(planned,marker.siteId);retireSnapshotIdentities(placed);
   placed.groundItems??=[];for(const [index,item]of items.entries())placed.groundItems.push({...copy(item.stack),id:`${marker.id}-${index}`,type:'item',...point,knownToPlayer:true});
   validateBattleSnapshot(placed);
   if(marker.siteId==='yatasto')planned.sceneStates[marker.siteId]=placed;else planned.sectorStates[marker.siteId]=placed;
  }
  if(saveFits(planned,roster)){
   s.serviceEquipmentReturns.entries=planned.serviceEquipmentReturns.entries;s.operativeState[id]=planned.operativeState[id];s.loadouts[id]=planned.loadouts[id];
   if(ground){if(marker.siteId==='yatasto')s.sceneStates[marker.siteId]=planned.sceneStates[marker.siteId];else s.sectorStates[marker.siteId]=planned.sectorStates[marker.siteId];}
   return {siteId:marker.siteId,sectorId:marker.sectorId,fallback:false};
  }
 }
 // No payload copy: the former carrier now holds a fixed local return, not NPC
 // equipment. Rehire is blocked until this one owner has been collected.
 r.serviceEquipmentReturn=marker;
 return {siteId:marker.siteId,sectorId:marker.sectorId,fallback:true};
}

export function serviceReturnSites(s,sectorId){
 return [...new Set([...(s.serviceEquipmentReturns?.entries??[]),...Object.values(s.operativeState??{}).map(r=>r.serviceEquipmentReturn).filter(Boolean)].filter(r=>r.sectorId===sectorId).map(r=>r.siteId))];
}
export function serviceReturnSources(s,siteId,snapshot=null,roster=null){
 const rows=[],scene=snapshot??snapshotAt(s,siteId);
 const add=(marker,id,selection,stack,repairPoints)=>{
  const placement=returnPlacement(marker,scene),key=sourceKey(marker.id,selection);
  rows.push({kind:repairPoints===undefined?'serviceReturn':'repairPoints',sourceKey:key,key,siteId,sectorId:marker.sectorId,operativeId:id,placement,...(placement??{}),...(repairPoints===undefined?{stack:copy(stack),expected:JSON.stringify(stack)}:{repairPoints,expected:JSON.stringify({repairPoints})})});
 };
 for(const entry of s.serviceEquipmentReturns?.entries??[])if(entry.siteId===siteId){for(const item of entry.items)add(entry,entry.operativeId,item.selection,item.stack);if(entry.repairPoints)add(entry,entry.operativeId,'repairPoints',null,entry.repairPoints);}
 for(const [id,r]of Object.entries(s.operativeState??{}))if(r.serviceEquipmentReturn?.siteId===siteId){
  roster??=equipmentRoster(s);
  const unit=carrier(s,Number(id),roster);for(const item of selections(unit)){const taken=extractItemQuantity(unit,item,itemQuantity(unit,item),{keepOtherHand:false});add(r.serviceEquipmentReturn,Number(id),item,taken.stack);}
  if(r.toolkitPoints)add(r.serviceEquipmentReturn,Number(id),'repairPoints',null,r.toolkitPoints);
 }
 return rows;
}
export function consumeServiceReturn(s,key,expected,count,roster=null){
 need(Number.isSafeInteger(count)&&count>0&&count<=1000000,'La cantidad devuelta es inválida.');
 let parsed;try{parsed=JSON.parse(key);}catch{need(false);}
 need(Array.isArray(parsed)&&parsed.length===3&&parsed[0]==='serviceReturn'&&idNumber(parsed[1])>0&&typeof parsed[2]==='string');
 const [,returnId,selection]=parsed,entry=s.serviceEquipmentReturns?.entries.find(r=>r.id===returnId);
 const owner=Object.entries(s.operativeState).find(([,r])=>r.serviceEquipmentReturn?.id===returnId);
 need(Boolean(entry)!==Boolean(owner),'El equipo ya no está disponible.');
 const id=entry?.operativeId??Number(owner[0]),r=s.operativeState[id];
 if(selection==='repairPoints'){
  const available=entry?entry.repairPoints:r.toolkitPoints;need(expected===JSON.stringify({repairPoints:available})&&count<=available,'La reserva de reparación cambió.');
  if(entry)entry.repairPoints-=count;else r.toolkitPoints-=count;
  finishOwner();return {repairPoints:count};
 }
 let stack,next,item;
 if(entry){item=entry.items.find(v=>v.selection===selection);need(item,'El equipo ya no está disponible.');stack={...copy(item.stack),count};}
 else {roster??=equipmentRoster(s);const unit=carrier(s,id,roster);need(selections(unit).includes(selection),'El equipo ya no está disponible.');const taken=extractItemQuantity(unit,selection,count,{keepOtherHand:false});stack=taken.stack;next=taken.unit;item={stack:extractItemQuantity(unit,selection,itemQuantity(unit,selection),{keepOtherHand:false}).stack};}
 need(expected===JSON.stringify(item.stack)&&count<=item.stack.count,'El equipo cambió. Revisá la lista antes de recogerlo.');
 if(entry){item.stack.count-=count;entry.items=entry.items.filter(v=>v.stack.count>0);}else commitCarrier(s,id,next);
 finishOwner();return {stack};
 function finishOwner(){
  if(entry){if(!entry.items.length&&!entry.repairPoints)s.serviceEquipmentReturns.entries=s.serviceEquipmentReturns.entries.filter(v=>v!==entry);}
  else {roster??=equipmentRoster(s);if(!selections(carrier(s,id,roster)).length&&!r.toolkitPoints){commitCarrier(s,id,carrier(s,id,roster),{empty:true});delete r.serviceEquipmentReturn;}}
 }
}

export function validateServiceEquipmentReturns(s,roster){
 const cache=s.serviceEquipmentReturns;need(object(cache)&&Object.keys(cache).length===3&&cache.version===1&&Number.isSafeInteger(cache.nextId)&&cache.nextId>=1&&cache.nextId<=1e9&&Array.isArray(cache.entries)&&cacheFits(s,cache.entries));
 const ids=new Set(),operativeIds=new Set(roster.map(op=>op.id));
 const checkMarker=marker=>{
  need(object(marker)&&Object.keys(marker).every(k=>['id','siteId','sectorId','entryEdge','entryAnchor','point','operativeId','items','repairPoints'].includes(k)));
  const number=idNumber(marker.id);need(number>0&&number<cache.nextId&&!ids.has(marker.id));ids.add(marker.id);
  need(typeof marker.siteId==='string'&&(validWorldLocation(marker.siteId)||Object.hasOwn(MISSION_SCENES,marker.siteId))&&validWorldLocation(marker.sectorId)&&siteSector(marker.siteId)===marker.sectorId&&validEntry(marker.entryEdge,marker.entryAnchor));
  if(marker.point!==undefined)need(object(marker.point)&&Object.keys(marker.point).every(k=>['x','y','tacticalLevel'].includes(k))&&Number.isFinite(marker.point.x)&&marker.point.x>=0&&marker.point.x<=1000&&Number.isFinite(marker.point.y)&&marker.point.y>=0&&marker.point.y<=1000&&(marker.point.tacticalLevel===undefined||Number.isSafeInteger(marker.point.tacticalLevel)&&marker.point.tacticalLevel>=0&&marker.point.tacticalLevel<=20));
 };
 for(const entry of cache.entries){
  checkMarker(entry);need(operativeIds.has(entry.operativeId)&&Array.isArray(entry.items)&&Number.isSafeInteger(entry.repairPoints)&&entry.repairPoints>=0&&entry.repairPoints<=100000&&(entry.items.length||entry.repairPoints));
  const keys=new Set();for(const item of entry.items){need(object(item)&&Object.keys(item).length===2&&typeof item.selection==='string'&&item.selection.length>0&&item.selection.length<=256&&item.selection!=='repairPoints'&&!keys.has(item.selection)&&object(item.stack)&&item.stack.count>0);keys.add(item.selection);validateItemStack(item.stack);need(item.stack.item!=='ammo','La munición devuelta necesita un tipo explícito.');}
 }
 for(const [id,r]of Object.entries(s.operativeState))if(r.serviceEquipmentReturn!==undefined){
  checkMarker(r.serviceEquipmentReturn);need(Object.keys(r.serviceEquipmentReturn).every(k=>['id','siteId','sectorId','entryEdge','entryAnchor','point'].includes(k))&&saveByteLength(JSON.stringify(r.serviceEquipmentReturn))<=512&&operativeIds.has(Number(id))&&!s.recruited.includes(Number(id))&&!s.contracts[id]&&!s.hiringArrivals?.some(a=>a.operativeId===Number(id)),'El combatiente aún tiene equipo por recoger.');
  const unit=carrier(s,Number(id),roster);validateHands(unit);validateEquipmentCursor(unit);need(selections(unit).length||r.toolkitPoints>0);for(const item of extractAll(unit).items)validateItemStack(item.stack);
 }
 // Ground returns retain their immutable source prefix after cache collection.
 for(const snapshot of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{})])for(const item of snapshot.groundItems??[]){
  const match=typeof item.id==='string'?/^service-return-([1-9][0-9]*)-[0-9]+$/.exec(item.id):null;
  if(match)need(Number(match[1])<cache.nextId,'La secuencia del equipo devuelto reutiliza una fuente existente.');
 }
 return true;
}
