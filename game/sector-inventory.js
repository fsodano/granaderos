import {makeOutfit,wornOutfit} from './outfits.js';
import {handsRequired} from './hand-layout.js';
import {SUPPLY_ITEMS,itemQuantity,itemDescriptor,extractItemQuantity,applyItemQuantity,inventoryUsage} from './tactical-inventory.js';
import {getReachable,hasLineOfSight,planEquipLoot,WEAPONS,BLADES} from './tactical.js';
import {propBlocksAt,propCells} from './props.js';
import {boundaryMatches} from './tactical-exits.js';
import {operativeLocation,operativeInTransit} from './squads.js';
import {returnEquipment,setCarriedLoading,clearCarriedLoading} from './equipment.js';
import {weaponItemWeight} from './weapon-fittings.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {MISSION_SCENES} from './missions.js';

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
  const items=[...Object.keys(SUPPLY_ITEMS),...(!body.weaponDropped&&body.weapon?['primary']:[]),...(body.blade?['blade']:[]),...(body.offHand?['offhand']:[]),...(wornOutfit(body)?['outfit']:[]),...Object.keys(body.inventory??{}).map(key=>`inventory:${key}`)];
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
function inventorySite(s,id){
 const mission=MISSION_SCENES[id];
 const snapshot=mission?(id==='san_lorenzo'?s.sectorStates[id]:s.sceneStates?.[id]):s.sectorStates[id];
 return {id,sectorId:mission?.anchor??id,name:mission?.name??'Terreno del sector',snapshot};
}
export function sectorInventorySites(s,sectorId){
 return [inventorySite(s,sectorId),...Object.values(MISSION_SCENES).filter(m=>m.anchor===sectorId).map(m=>inventorySite(s,m.id)).filter(site=>site.snapshot)]
  .map(({id,name,snapshot})=>({id,name,count:knownSectorEquipment(snapshot).reduce((n,row)=>n+row.count,0)}));
}
export function knownCampaignSectorEquipment(s,sectorId){
 return sectorInventorySites(s,sectorId).flatMap(site=>knownSectorEquipment(inventorySite(s,site.id).snapshot).map(row=>({...row,key:JSON.stringify([site.id,row.key]),siteId:site.id,siteName:site.name})));
}
function carriedActor(s,op){const r=s.operativeState[op.id];return {...op,...r,id:String(op.id),side:'player',loaded:r.carriedLoaded??0,ammo:(r.carriedAmmo??0)-(r.carriedLoaded??0),...(r.carriedReloadProgress?{reloadProgress:r.carriedReloadProgress}:{}),ap:100,energy:r.energy??100,unconscious:false,movementMode:'walk',stance:'standing'};}
function actorAt(s,sectorId,op){
 const r=s.operativeState[op.id],snapshot=inventorySite(s,sectorId).snapshot;
 const old=snapshot?.units.find(u=>u.id===String(op.id)&&!u.departure&&u.hp>0);
 const unit=carriedActor(s,op);
 if(old&&r.residentSector===snapshot.sectorId&&(r.residentScene??null)===(snapshot.sceneId??null))return {...unit,x:old.x,y:old.y};
 const edge=r.arrival?.entryEdge??'S';
 const candidates=(snapshot?.tiles??[]).filter(t=>boundaryMatches(snapshot,t,edge)&&!t.blocked&&!propBlocksAt(snapshot,t.x,t.y));
 const anchor=r.arrival?.entryAnchor??{x:.5,y:.5};
 candidates.sort((a,b)=>Math.hypot(a.x/(snapshot.width-1)-anchor.x,a.y/(snapshot.height-1)-anchor.y)-Math.hypot(b.x/(snapshot.width-1)-anchor.x,b.y/(snapshot.height-1)-anchor.y)||a.y-b.y||a.x-b.x);
 return candidates[0]?{...unit,x:candidates[0].x,y:candidates[0].y}:null;
}
function unavailable(s,siteId,terrain=true){
 const {sectorId,snapshot}=inventorySite(s,siteId);
 if(s.defeated)return 'La campaña terminó.';
 if(s.pendingBattle||s.pendingEncounter)return 'Resolvé el encuentro pendiente antes de manejar el equipo desde la carta.';
 if(s.sectors[sectorId]?.owner!=='patriot'||s.enemyGroups?.some(g=>g.target===sectorId&&['waiting','engaged','stationed'].includes(g.status)))return 'El sector debe estar bajo control patriota y sin ocupación enemiga.';
 if(terrain&&!snapshot?.sectorCleared)return 'Primero reconocé y asegurá el sector.';
 return null;
}
export function sectorInventoryModel(s,sectorId,roster,operativeId){
 const {snapshot,sectorId:location}=inventorySite(s,sectorId),candidates=roster.filter(op=>s.recruited.includes(op.id)&&s.operativeState[op.id]?.alive&&!s.operativeState[op.id]?.captured&&!operativeInTransit(s,op.id)&&operativeLocation(s,op.id)===location);
 const op=candidates.find(op=>op.id===Number(operativeId))??candidates[0],r=op&&s.operativeState[op.id];
 let reason=unavailable(s,sectorId),carriedReason=unavailable(s,sectorId,false);
 if(!op||r.hp<15||r.asleep||r.energy<=0||r.unconscious||r.routed||r.surrendered){carriedReason??='Elegí un combatiente consciente, despierto y presente en el sector.';reason??=carriedReason;}
 const actor=op&&snapshot?actorAt(s,sectorId,op):null;
 if(!reason&&!actor)reason='El combatiente debe entrar al sector para encontrar un acceso.';
 const view=actor?{...snapshot,units:[actor],mode:'exploration',phase:'player',status:'active',artillery:[],npcs:[]}:null;
 const reach=!reason?getReachable(view,actor):[];
 const entries=poolSources(snapshot).map(row=>{
  const cells=row.kind==='container'?propCells(row.source):[row.source];
  const reachable=!reason&&reach.some(p=>cells.some(c=>Math.hypot(p.x-c.x,p.y-c.y)<=1.5&&hasLineOfSight(view,p,c)));
  return {key:row.key,label:row.label,count:row.stack.count,x:row.x,y:row.y,kind:row.kind,expected:JSON.stringify(row.stack),condition:row.stack.condition,loaded:row.stack.loaded,jammed:row.stack.jammed,fittingPattern:row.stack.fittingPattern,reachable,reason:reason??(!reachable?'No hay un camino abierto hasta este equipo.':null)};
 });
 const personal=op?carriedActor(s,op):null;
 const carried=personal?[...Object.keys(SUPPLY_ITEMS),...(!personal.weaponDropped&&personal.weapon?['primary']:[]),...(personal.blade?['blade']:[]),...(personal.offHand?['offhand']:[]),...(wornOutfit(personal)?['outfit']:[]),...Object.keys(personal.inventory??{}).map(key=>`inventory:${key}`)].filter(item=>itemQuantity(personal,item)>0).map(item=>{
  const row={item,label:itemDescriptor(personal,item).label,count:itemQuantity(personal,item)};
  if(item==='primary'&&WEAPONS[personal.weapon]?.capacity>0){row.loaded=personal.loaded;row.condition=personal.condition;row.jammed=personal.jammed;row.reloadProgress=personal.reloadProgress;}
  if(item==='outfit'){row.condition=personal.outfit.condition;row.expected=JSON.stringify(personal.outfit);row.inventoryKey=null;let reason=carriedReason;if(!reason)try{planEquipLoot(personal,null,'outfit');}catch(error){reason=error.message;}row.equip=[{slot:'outfit',label:'Guardar vestimenta',valid:!reason,reason}];}
  const key=item.startsWith('inventory:')?item.slice(10):null,record=key&&personal.inventory[key];
  if(record&&(WEAPONS[record.weapon]||BLADES[record.weapon]||record.kind==='outfit')){
   row.expected=JSON.stringify(record);row.inventoryKey=key;row.loaded=record.weapon?record.loaded??0:undefined;row.condition=record.condition;row.jammed=record.jammed;row.reloadProgress=record.reloadProgress;
   row.equip=(record.kind==='outfit'?['outfit']:BLADES[record.weapon]?['primary','blade']:handsRequired(record.weapon)===1?['primary','offhand']:['primary']).map(slot=>{let reason=carriedReason;if(!reason)try{planEquipLoot(personal,key,slot);}catch(error){reason=error.message;}return {slot,valid:!reason,reason};});
  }
  if(item!=='outfit'&&!['primary','blade','offhand'].includes(item)&&!(record?.weapon)){
   const held=personal.leftHandItem===item,reference=held?null:item;
   let reason=carriedReason;if(!reason)try{planEquipLoot(personal,reference,'offhandItem');}catch(error){reason=error.message;}
   row.offhand={label:held?'Guardar objeto de segunda mano':'Poner en segunda mano',valid:!reason,reason,action:{slot:'offhandItem',inventoryKey:reference,expected:JSON.stringify(extractItemQuantity(personal,item,1).stack)}};
  }
  return row;
 }):[];
 const outfitStock=(s.depots?.[location]?.ponchos??0)+(location==='retiro'?(s.resources.ponchos??0):0);
 let outfitIssueReason=carriedReason;if(!outfitIssueReason&&!outfitStock)outfitIssueReason='No quedan ponchos en este depósito.';if(!outfitIssueReason)try{applyItemQuantity(personal,{item:'outfit',...makeOutfit()});}catch(error){outfitIssueReason=error.message;}
 return {outfitStock,outfitIssueReason,sectorId,operativeId:op?.id??null,candidates:candidates.map(op=>({id:op.id,name:op.nickname??op.name})),reason,carriedReason,entries,carried,usage:personal?inventoryUsage(personal):null};
}

// The campaign dispatcher provides a private copy. Plan every transfer before
// updating either custodian; the source key is resolved again on confirmation.
export function moveSectorItem(s,action,roster){
 const {sector:sectorId,operativeId,direction,count=1}=action;
 need(['take','drop','equip','issueOutfit'].includes(direction)&&Number.isSafeInteger(count)&&count>0&&count<=1000000,'La orden de inventario no es válida.');
 const model=sectorInventoryModel(s,sectorId,roster,operativeId);
 const reason=['equip','issueOutfit'].includes(direction)?model.carriedReason:model.reason;need(!reason,reason);need(model.operativeId===Number(operativeId),'Elegí un combatiente presente.');
 const op=roster.find(op=>op.id===Number(operativeId)),snapshot=inventorySite(s,sectorId).snapshot,actor=['equip','issueOutfit'].includes(direction)?carriedActor(s,op):actorAt(s,sectorId,op);
 let next,stack;
 if(direction==='issueOutfit'){
  need(count===1&&!model.outfitIssueReason,model.outfitIssueReason??'Retirá un poncho por vez.');
  stack={item:'outfit',...makeOutfit()};next=applyItemQuantity(actor,stack);
  const at=inventorySite(s,sectorId).sectorId;if((s.depots?.[at]?.ponchos??0)>0)s.depots[at].ponchos--;else s.resources.ponchos--;
 }else if(direction==='equip'){
  need(count===1&&['primary','blade','offhand','outfit','offhandItem'].includes(action.slot),'Elegí una ranura de equipo.');
  const stow=action.slot==='outfit'&&action.inventoryKey===null;
  if(action.slot==='offhandItem'){
   const reference=action.inventoryKey===null?actor.leftHandItem:action.inventoryKey;
   stack=extractItemQuantity(actor,reference,1).stack;need(action.expected===JSON.stringify(stack),'El objeto cambió. Revisá el equipo.');
   next=planEquipLoot(actor,action.inventoryKey,action.slot);
  }else{
  need(action.expected===JSON.stringify(stow?wornOutfit(actor):actor.inventory?.[action.inventoryKey])&&typeof action.expected==='string','El equipo cambió. Revisá la mochila antes de equiparlo.');
  stack=extractItemQuantity(actor,stow?'outfit':`inventory:${action.inventoryKey}`,1).stack;next=planEquipLoot(actor,action.inventoryKey,action.slot);
  }
 }else if(direction==='take'){
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
 record.carriedAmmo=next.ammo+(next.loaded??0);
 if(direction==='equip'&&action.slot==='primary'||record.carriedLoaded!==undefined)setCarriedLoading(record,next);
 else if(next.weaponDropped)clearCarriedLoading(record);
 // Returned living soldiers and their cartridge receipt are historical.
 // Their next deployment uses the current campaign equipment record.
 if(!['equip','issueOutfit'].includes(direction)){
  // A returned living unit is a historical receipt, not another item owner.
  // Retire its identities before a map transfer puts that same item on the field.
  for(const old of snapshot.units.filter(u=>u.side==='player'&&u.hp>0&&snapshot.returnLedger?.entries.some(e=>e.unitId===u.id&&['resident','departed'].includes(e.kind)))){
   delete old.weaponInstanceId;delete old.bladeInstanceId;old.weaponFittingPattern=null;old.bladeFittingPattern=null;old.weaponFittings={};
   for(const item of [...(old.offHand?[old.offHand]:[]),...(old.outfit?[old.outfit]:[]),...Object.values(old.inventory??{})]){delete item.instanceId;delete item.fittingPattern;delete item.fittings;}
  }
  validateBattleSnapshot(snapshot);
 }
 return `${op.nickname??op.name} ${direction==='take'?'recoge':direction==='equip'?(action.inventoryKey===null?'guarda':'equipa'):direction==='issueOutfit'?'retira del depósito':'deja'} ${count} × ${stackLabel(stack)} en el sector.`;
}
