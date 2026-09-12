import {SUPPLY_ITEMS,itemQuantity,itemDescriptor,extractItemQuantity,applyItemQuantity,inventoryUsage} from './tactical-inventory.js';
import {getReachable,hasLineOfSight} from './tactical.js';
import {propBlocksAt,propCells} from './props.js';
import {boundaryMatches} from './tactical-exits.js';
import {operativeLocation,operativeInTransit} from './squads.js';
import {returnEquipment} from './equipment.js';
import {weaponItemWeight} from './weapon-fittings.js';
import {validateBattleSnapshot} from './validate-battle.js';

const copy=value=>structuredClone(value);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const fields=['inventory','condition','priming','flints','rations','medkits','boleadoras','torches'];
function stackLabel(stack){
 if(SUPPLY_ITEMS[stack.item])return SUPPLY_ITEMS[stack.item].label;
 const key=stack.item==='weapon'?'weapon':stack.item.replace(/^inventory:/,'');
 return itemDescriptor({inventory:{[key]:{...stack}},weapon:0,weaponDropped:true},`inventory:${key}`).label;
}
function poolSources(snapshot){
 if(!snapshot)return [];
 const rows=[];
 const add=(key,source,stack,extra={})=>{if(stack.count>0)rows.push({key,source,stack,label:stackLabel(stack),x:source.x,y:source.y,...extra});};
 for(const g of snapshot.groundItems??[])if(['item','boleadoras'].includes(g.type)&&g.knownToPlayer&&!g.heldBy&&g.count>0){
  const {id,type,x,y,heldBy,knownToPlayer,...data}=g;
  add(`ground:${g.id}`,g,g.type==='boleadoras'?{item:'boleadoras',count:g.count,weight:.8}:data,{kind:'ground'});
 }
 for(const [index,d] of (snapshot.droppedWeapons??[]).entries())if(d.knownToPlayer&&!d.taken){
  const {x,y,taken,knownToPlayer,...data}=d;add(`drop:${index}`,d,{...data,item:'weapon',count:1,weight:d.weight??weaponItemWeight(d.weapon)},{kind:'drop'});
 }
 for(const body of snapshot.units??[])if(body.knownToPlayer&&body.hp<=0&&!body.departure&&!body.fled){
  const disposition=snapshot.returnLedger?.entries?.find(e=>e.unitId===body.id),owner=snapshot.sectorId==='san_lorenzo'?'san_nicolas':snapshot.sectorId;
  if(disposition&&(disposition.kind!=='dead'||disposition.sector!==owner))continue;
  const items=[...Object.keys(SUPPLY_ITEMS),...(!body.weaponDropped&&body.weapon?['primary']:[]),...(body.blade?['blade']:[]),...Object.keys(body.inventory??{}).map(key=>`inventory:${key}`)];
  for(const item of items)if(itemQuantity(body,item)>0){const {stack}=extractItemQuantity(body,item,itemQuantity(body,item));add(JSON.stringify(['body',body.id,item]),body,stack,{kind:'body',item});}
 }
 for(const chest of snapshot.props??[])if(chest.type==='chest'&&chest.knownToPlayer&&chest.open&&!chest.locked&&!chest.trap?.armed){
  for(const [index,stack] of (chest.contents??[]).entries())add(`container:${chest.id}:${index}`,chest,copy(stack),{kind:'container',index});
 }
 return rows;
}
// Strategic read surfaces expose discovered rows, never full sector snapshots.
export function knownSectorEquipment(snapshot){
 return poolSources(snapshot).map(row=>({key:row.key,label:row.label,count:row.stack.count,x:row.x,y:row.y,kind:row.kind,
  ...(row.stack.condition!==undefined?{condition:row.stack.condition}:{}),...(row.stack.loaded!==undefined?{loaded:row.stack.loaded,jammed:row.stack.jammed??false}:{})}));
}
function actorAt(s,sectorId,op){
 const r=s.operativeState[op.id],snapshot=s.sectorStates[sectorId];
 const old=snapshot?.units.find(u=>u.id===String(op.id)&&!u.departure&&u.hp>0);
 const unit={...op,...r,id:String(op.id),side:'player',loaded:0,ammo:r.carriedAmmo??0,ap:100,energy:r.energy??100,unconscious:false,movementMode:'walk',stance:'standing'};
 if(old&&r.residentSector===sectorId)return {...unit,x:old.x,y:old.y};
 const edge=r.arrival?.entryEdge??'S';
 const candidates=(snapshot?.tiles??[]).filter(t=>boundaryMatches(snapshot,t,edge)&&!t.blocked&&!propBlocksAt(snapshot,t.x,t.y));
 const anchor=r.arrival?.entryAnchor??{x:.5,y:.5};
 candidates.sort((a,b)=>Math.hypot(a.x/(snapshot.width-1)-anchor.x,a.y/(snapshot.height-1)-anchor.y)-Math.hypot(b.x/(snapshot.width-1)-anchor.x,b.y/(snapshot.height-1)-anchor.y)||a.y-b.y||a.x-b.x);
 return candidates[0]?{...unit,x:candidates[0].x,y:candidates[0].y}:null;
}
function unavailable(s,sectorId){
 if(s.defeated)return 'La campaña terminó.';
 if(s.pendingBattle||s.pendingEncounter)return 'Resolvé el encuentro pendiente antes de manejar el equipo desde la carta.';
 if(s.sectors[sectorId]?.owner!=='patriot'||s.enemyGroups?.some(g=>g.target===sectorId&&['waiting','engaged','stationed'].includes(g.status)))return 'El sector debe estar bajo control patriota y sin ocupación enemiga.';
 if(!s.sectorStates[sectorId]?.sectorCleared)return 'Primero reconocé y asegurá el sector.';
 return null;
}
export function sectorInventoryModel(s,sectorId,roster,operativeId){
 const snapshot=s.sectorStates[sectorId],candidates=roster.filter(op=>s.recruited.includes(op.id)&&s.operativeState[op.id]?.alive&&!s.operativeState[op.id]?.captured&&!operativeInTransit(s,op.id)&&operativeLocation(s,op.id)===sectorId);
 const op=candidates.find(op=>op.id===Number(operativeId))??candidates[0],r=op&&s.operativeState[op.id];
 let reason=unavailable(s,sectorId);
 if(!reason&&(!op||r.hp<15||r.asleep||r.energy<=0||r.unconscious||r.routed||r.surrendered))reason='Elegí un combatiente consciente, despierto y presente en el sector.';
 const actor=op&&snapshot?actorAt(s,sectorId,op):null;
 if(!reason&&!actor)reason='El combatiente debe entrar al sector para encontrar un acceso.';
 const view=actor?{...snapshot,units:[actor],mode:'exploration',phase:'player',status:'active',artillery:[],npcs:[]}:null;
 const reach=!reason?getReachable(view,actor):[];
 const entries=poolSources(snapshot).map(row=>{
  const cells=row.kind==='container'?propCells(row.source):[row.source];
  const reachable=!reason&&reach.some(p=>cells.some(c=>Math.hypot(p.x-c.x,p.y-c.y)<=1.5&&hasLineOfSight(view,p,c)));
  return {key:row.key,label:row.label,count:row.stack.count,x:row.x,y:row.y,kind:row.kind,expected:JSON.stringify(row.stack),condition:row.stack.condition,loaded:row.stack.loaded,jammed:row.stack.jammed,fittingPattern:row.stack.fittingPattern,reachable,reason:reason??(!reachable?'No hay un camino abierto hasta este equipo.':null)};
 });
 const carried=actor?[...Object.keys(SUPPLY_ITEMS),...(!actor.weaponDropped&&actor.weapon?['primary']:[]),...(actor.blade?['blade']:[]),...Object.keys(actor.inventory??{}).map(key=>`inventory:${key}`)].filter(item=>itemQuantity(actor,item)>0).map(item=>({item,label:itemDescriptor(actor,item).label,count:itemQuantity(actor,item)})):[];
 return {sectorId,operativeId:op?.id??null,candidates:candidates.map(op=>({id:op.id,name:op.nickname??op.name})),reason,entries,carried,usage:actor?inventoryUsage(actor):null};
}

// The campaign dispatcher provides a private copy. Plan every transfer before
// updating either custodian; the source key is resolved again on confirmation.
export function moveSectorItem(s,action,roster){
 const {sector:sectorId,operativeId,direction,count=1}=action;
 need(['take','drop'].includes(direction)&&Number.isSafeInteger(count)&&count>0&&count<=1000000,'La orden de inventario no es válida.');
 const model=sectorInventoryModel(s,sectorId,roster,operativeId);
 need(!model.reason,model.reason);need(model.operativeId===Number(operativeId),'Elegí un combatiente presente.');
 const op=roster.find(op=>op.id===Number(operativeId)),snapshot=s.sectorStates[sectorId],actor=actorAt(s,sectorId,op);
 let next,stack;
 if(direction==='take'){
  const row=poolSources(snapshot).find(row=>row.key===action.sourceKey),entry=model.entries.find(row=>row.key===action.sourceKey);
  need(row&&entry?.reachable,entry?.reason??'El equipo ya no está disponible.');need(action.expected===JSON.stringify(row.stack),'El equipo cambió. Revisá la lista antes de recogerlo.');need(count<=row.stack.count,'No queda esa cantidad del objeto.');
  stack={...row.stack,count};next=applyItemQuantity(actor,stack);
  if(row.kind==='body'){const extraction=extractItemQuantity(row.source,row.item,count);Object.keys(row.source).forEach(key=>delete row.source[key]);Object.assign(row.source,extraction.unit);}
  else if(row.kind==='drop')row.source.taken=true;
  else if(row.kind==='container'){row.source.contents[row.index].count-=count;if(!row.source.contents[row.index].count)row.source.contents.splice(row.index,1);}
  else row.source.count-=count;
 }else{
  const extraction=extractItemQuantity(actor,action.item,count);next=extraction.unit;stack=extraction.stack;
  need(snapshot.groundItems.length<10000,'No queda espacio para más objetos en el sector.');
  let index=snapshot.groundItems.length,id;do{id=`sector-item-${index++}`;}while(snapshot.groundItems.some(item=>item.id===id));
  snapshot.groundItems.push({...copy(stack),id,type:'item',x:actor.x,y:actor.y,knownToPlayer:true});
 }
 const record=s.operativeState[op.id];returnEquipment(s,op.id,next);
 for(const key of fields)if(next[key]!==undefined)record[key]=copy(next[key]);
 record.carriedAmmo=next.ammo;
 // Returned living soldiers and their cartridge receipt are historical.
 // Their next deployment uses the current campaign equipment record.
 validateBattleSnapshot(snapshot);
 return `${op.nickname??op.name} ${direction==='take'?'recoge':'deja'} ${count} × ${stackLabel(stack)} en el sector.`;
}
