import {expandCellScene} from './cell-scene-storage.js';
import {worldOwner} from './world-cells.js';
import {planEquipmentUnload,planEquipmentAttachment} from './equipment-cursor.js';
import {droppedWeaponStack} from './tactical-inventory.js';
import {atHand,planningPoint} from './tactical-planning-space.js';
import {BODY_SLOTS,outfitSlot,wornBodyItems,makeOutfit,wornOutfit,PONCHO_PRICE} from './outfits.js';
import {changeMerchantCash,merchantCash} from './equipment-merchants.js';
import {handsRequired,handLayout} from './hand-layout.js';
import {SUPPLY_ITEMS,itemQuantity,itemDescriptor,extractItemQuantity,applyItemQuantity,inventoryUsage,planPocketMove,equipmentEndpoint,equipmentFingerprint} from './tactical-inventory.js';
import {getReachable,hasLineOfSight,planEquipLoot,planReadyMainHand,planEquipmentPlacement,planEquipmentCursorOrder,WEAPONS,BLADES} from './tactical.js';
import {propBlocksAt,propCells} from './props.js';
import {boundaryPassable} from './tactical-exits.js';
import {operativeLocation,operativeInTransit} from './squads.js';
import {returnEquipment,setCarriedLoading,clearCarriedLoading,storeEquipment} from './equipment.js';
import {syncUnitAmmunition} from './tactical-ammunition.js';
import {syncCarriedAmmunition} from './campaign-ammunition.js';
import {weaponItemWeight} from './weapon-fittings.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {MISSION_SCENES} from './missions.js';
import {serviceReturnSources,serviceReturnSites,consumeServiceReturn} from './service-equipment-return.js';

const copy=value=>structuredClone(value);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const fields=['inventory','condition','rations','medkits','boleadoras','torches','pocketOrder','toolkitPoints'];
function stackLabel(stack){
 if(SUPPLY_ITEMS[stack.item])return SUPPLY_ITEMS[stack.item].label;
 const key=stack.item==='weapon'?'weapon':stack.item.replace(/^inventory:/,'');
 return itemDescriptor({inventory:{[key]:{...stack}},weapon:0,weaponDropped:true},`inventory:${key}`).label;
}
function poolSources(snapshot){
 if(!snapshot)return [];
 const rows=[];
 const add=(key,source,stack,extra={})=>{if(stack.count>0)rows.push({key,source,stack,label:stackLabel(stack),...planningPoint(source),...extra});};
 for(const g of snapshot.groundItems??[])if((g.type==='item'||Object.hasOwn(SUPPLY_ITEMS,g.type)&&g.type!=='ammo')&&g.knownToPlayer&&!g.heldBy&&g.count>0){
  const {id,type,x,y,tacticalLevel,heldBy,knownToPlayer,...data}=g;
  add(`ground:${g.id}`,g,g.type==='item'?data:{item:g.type,count:g.count,weight:SUPPLY_ITEMS[g.type].weight},{kind:'ground'});
 }
 for(const [index,d] of (snapshot.droppedWeapons??[]).entries())if(d.knownToPlayer&&!d.taken){
  add(`drop:${index}`,d,droppedWeaponStack(d),{kind:'drop'});
 }
 for(const body of snapshot.units??[])if(body.knownToPlayer&&body.hp<=0&&!body.departure&&!body.fled){
  const disposition=snapshot.returnLedger?.entries?.find(e=>e.unitId===body.id),owner=snapshot.sectorId==='san_lorenzo'?'san_nicolas':snapshot.sectorId;
  if(disposition&&(disposition.kind!=='dead'||disposition.sector!==owner))continue;
  const items=[...Object.keys(SUPPLY_ITEMS).filter(key=>key!=='ammo'||body.ammunitionVersion!==2),...(!body.weaponDropped&&body.weapon?['primary']:[]),...(body.blade?['blade']:[]),...(body.offHand?['offhand']:[]),...wornBodyItems(body),...(body.equipmentCursor?['cursor']:[]),...Object.keys(body.inventory??{}).map(key=>`inventory:${key}`)];
  for(const item of items)if(itemQuantity(body,item)>0){const {stack}=extractItemQuantity(body,item,itemQuantity(body,item));add(JSON.stringify(['body',body.id,item]),body,stack,{kind:'body',item});}
 }
 for(const chest of snapshot.props??[])if(chest.type==='chest'&&chest.knownToPlayer&&chest.open&&!chest.locked&&!chest.trap?.armed){
  for(const [index,stack] of (chest.contents??[]).entries())add(`container:${chest.id}:${index}`,chest,copy(stack),{kind:'container',index});
 }
 return rows;
}
// Strategic read surfaces expose discovered rows, never full sector snapshots.
export function knownSectorEquipment(snapshot){
 return poolSources(snapshot).map(row=>({key:row.key,label:row.label,count:row.stack.count,...planningPoint(row),kind:row.kind,
  ...(row.stack.condition!==undefined?{condition:row.stack.condition}:{}),...(row.stack.loaded!==undefined?{loaded:row.stack.loaded,jammed:row.stack.jammed??false}:{})}));
}
function siteSources(s,siteId,snapshot){
 return [...poolSources(snapshot),...serviceReturnSources(s,siteId,snapshot).filter(row=>row.stack).map(row=>({...row,source:row.placement,label:stackLabel(row.stack)}))];
}
function knownSiteEquipment(s,site){
 return siteSources(s,site.id,site.snapshot).map(row=>({key:row.key,label:row.label,count:row.stack.count,...(row.source?planningPoint(row.source):{}),kind:row.kind,
  ...(row.stack.condition!==undefined?{condition:row.stack.condition}:{}),...(row.stack.loaded!==undefined?{loaded:row.stack.loaded,jammed:row.stack.jammed??false}:{})}));
}
function inventorySite(s,id){
 const mission=MISSION_SCENES[id];
 const snapshot=mission?(id==='san_lorenzo'?s.sectorStates[id]:s.sceneStates?.[id]):s.sectorStates[id];
 return {id,sectorId:mission?.anchor??id,name:mission?.name??'Terreno del sector',snapshot:expandCellScene(snapshot)};
}
export function sectorInventorySites(s,sectorId){
 const ids=[sectorId,...Object.values(MISSION_SCENES).filter(m=>m.anchor===sectorId).map(m=>m.id).filter(id=>inventorySite(s,id).snapshot),...serviceReturnSites(s,sectorId)];
 return [...new Set(ids)].map(id=>{
  const site=inventorySite(s,id),repairPoints=serviceReturnSources(s,id,site.snapshot).reduce((n,row)=>n+(row.repairPoints??0),0);
  return {id,name:site.name,count:knownSiteEquipment(s,site).reduce((n,row)=>n+row.count,0),repairPoints};
 });
}
export function knownCampaignSectorEquipment(s,sectorId){
 return sectorInventorySites(s,sectorId).flatMap(site=>knownSiteEquipment(s,inventorySite(s,site.id)).map(row=>({...row,key:JSON.stringify([site.id,row.key]),siteId:site.id,siteName:site.name})));
}
export function knownCampaignRepairReserves(s,sectorId){
 return sectorInventorySites(s,sectorId).flatMap(site=>serviceReturnSources(s,site.id,inventorySite(s,site.id).snapshot).filter(row=>row.repairPoints>0).map(row=>({key:JSON.stringify([site.id,row.key]),siteId:site.id,siteName:site.name,label:'Materiales de reparación',repairPoints:row.repairPoints,...(row.placement?planningPoint(row.placement):{})})));
}
function carriedActor(s,op){const r=s.operativeState[op.id];return syncUnitAmmunition({...op,...r,id:String(op.id),side:'player',loaded:r.carriedLoaded??0,...(r.carriedReloadProgress?{reloadProgress:r.carriedReloadProgress}:{}),ap:100,energy:r.energy??100,unconscious:false,movementMode:'walk',stance:'standing'});}
function actorAt(s,sectorId,op){
 const r=s.operativeState[op.id],snapshot=inventorySite(s,sectorId).snapshot;
 const old=snapshot?.units.find(u=>u.id===String(op.id)&&!u.departure&&u.hp>0);
 const unit=carriedActor(s,op);
 if((r.residentPosition||old)&&r.residentSector===snapshot?.sectorId&&(r.residentScene??null)===(snapshot.sceneId??null))return {...unit,...planningPoint(r.residentPosition??old,Boolean(snapshot.upperSurfaces?.length))};
 const edge=r.arrival?.entryEdge??'S';
 const candidates=(snapshot?.tiles??[]).filter(t=>boundaryPassable(snapshot,t,edge)&&!t.blocked&&!propBlocksAt(snapshot,t.x,t.y));
 const anchor=r.arrival?.entryAnchor??{x:.5,y:.5};
 candidates.sort((a,b)=>Math.hypot(a.x/(snapshot.width-1)-anchor.x,a.y/(snapshot.height-1)-anchor.y)-Math.hypot(b.x/(snapshot.width-1)-anchor.x,b.y/(snapshot.height-1)-anchor.y)||a.y-b.y||a.x-b.x);
 return candidates[0]?{...unit,...planningPoint(candidates[0],Boolean(snapshot.upperSurfaces?.length)||unit.tacticalLevel!==undefined)}:null;
}
function unavailable(s,siteId,terrain=true){
 const {sectorId,snapshot}=inventorySite(s,siteId);
 if(s.defeated)return 'La campaña terminó.';
 if(s.pendingBattle||s.pendingEncounter)return 'Resolvé el encuentro pendiente antes de manejar el equipo desde la carta.';
 if(!['patriot','neutral'].includes(worldOwner(s,sectorId))||s.enemyGroups?.some(g=>g.target===sectorId&&['waiting','engaged','stationed'].includes(g.status)))return 'El sector debe estar bajo control patriota y sin ocupación enemiga.';
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
 const access=row=>{
  const cells=row.kind==='container'?propCells(row.source):row.source?[row.source]:[];
  const reachable=!reason&&reach.some(p=>cells.some(c=>atHand(p,c)&&hasLineOfSight(view,p,c)));
  return {...(row.source?planningPoint(row.source):{}),reachable,reason:reason??(!reachable?'No hay un camino abierto hasta este equipo.':null)};
 };
 const entries=siteSources(s,sectorId,snapshot).map(row=>{
  return {key:row.key,label:row.label,count:row.stack.count,...access(row),kind:row.kind,expected:JSON.stringify(row.stack),condition:row.stack.condition,loaded:row.stack.loaded,jammed:row.stack.jammed,fittingPattern:row.stack.fittingPattern};
 });
 const repairReserves=serviceReturnSources(s,sectorId,snapshot).filter(row=>row.repairPoints>0).map(row=>({key:row.key,label:'Materiales de reparación',repairPoints:row.repairPoints,capacity:Math.max(0,100000-(r?.toolkitPoints??0)),expected:JSON.stringify({repairPoints:row.repairPoints}),...access({...row,source:row.placement})}));
 const personal=op?carriedActor(s,op):null;
 const carried=personal?[...Object.keys(SUPPLY_ITEMS).filter(key=>key!=='ammo'||personal.ammunitionVersion!==2),...(!personal.weaponDropped&&personal.weapon?['primary']:[]),...(personal.blade?['blade']:[]),...(personal.offHand?['offhand']:[]),...wornBodyItems(personal),...Object.keys(personal.inventory??{}).map(key=>`inventory:${key}`)].filter(item=>itemQuantity(personal,item)>0).map(item=>{
  const row={item,label:itemDescriptor(personal,item).label,count:itemQuantity(personal,item)};
  if(item==='primary'&&WEAPONS[personal.weapon]?.capacity>0){row.loaded=personal.loaded;row.condition=personal.condition;row.jammed=personal.jammed;row.reloadProgress=personal.reloadProgress;}
  if(BODY_SLOTS.includes(item)){row.condition=personal[item].condition;row.expected=JSON.stringify(personal[item]);row.inventoryKey=null;let reason=carriedReason;if(!reason)try{planEquipLoot(personal,null,item);}catch(error){reason=error.message;}row.equip=[{slot:item,label:'Guardar vestimenta',valid:!reason,reason}];}
  const key=item.startsWith('inventory:')?item.slice(10):null,record=key&&personal.inventory[key];
  if(record&&(WEAPONS[record.weapon]||BLADES[record.weapon]||record.kind==='outfit')){
   row.expected=JSON.stringify(record);row.inventoryKey=key;row.loaded=record.weapon?record.loaded??0:undefined;row.condition=record.condition;row.jammed=record.jammed;row.reloadProgress=record.reloadProgress;
   row.equip=(record.kind==='outfit'?[outfitSlot(record)]:BLADES[record.weapon]?['primary','blade']:handsRequired(record.weapon)===1?['primary','offhand']:['primary']).map(slot=>{let reason=carriedReason;if(!reason)try{planEquipLoot(personal,key,slot);}catch(error){reason=error.message;}return {slot,valid:!reason,reason};});
  }
  if(!BODY_SLOTS.includes(item)&&!['primary','blade','offhand'].includes(item)&&!(record?.weapon)){
   const held=personal.leftHandItem===item,reference=held?null:item;
   let reason=carriedReason;if(!reason)try{planEquipLoot(personal,reference,'offhandItem');}catch(error){reason=error.message;}
   row.offhand={label:held?'Guardar objeto de segunda mano':'Poner en segunda mano',valid:!reason,reason,action:{slot:'offhandItem',inventoryKey:reference,expected:JSON.stringify(extractItemQuantity(personal,item,1).stack)}};
  }
  if(!BODY_SLOTS.includes(item)&&!record?.weapon){
   const held=handLayout(personal).right===item;
   let reason=carriedReason;if(!reason)try{planReadyMainHand(personal,item);}catch(error){reason=error.message;}
   row.mainhand={label:held?'En mano principal':'Poner en mano principal',valid:!reason,reason,action:{slot:'mainhand',inventoryKey:item,expected:JSON.stringify(extractItemQuantity(personal,item,1).stack)}};
  }
  const stored=extractItemQuantity(personal,item,1).stack;
  if(stored.weapon>=1800&&stored.weapon<=1813){
   const storeReason=modelStoreReason(s,location,reason,personal);
   row.store={expected:JSON.stringify(stored),valid:!storeReason,reason:storeReason};
  }
  return row;
 }):[];
 const outfitStock=s.merchants?.[location]?.supplies?.ponchos??0;
 let outfitIssueReason=carriedReason;
 if(!outfitIssueReason&&!outfitStock)outfitIssueReason='No quedan ponchos en este comercio.';
 if(!outfitIssueReason&&s.resources.treasury<PONCHO_PRICE)outfitIssueReason='No hay pesos suficientes.';
 if(!outfitIssueReason&&merchantCash(s,location)+PONCHO_PRICE>1e9)outfitIssueReason='La caja del comerciante no admite ese pago.';
 if(!outfitIssueReason)try{applyItemQuantity(personal,{item:'outfit',...makeOutfit()});}catch(error){outfitIssueReason=error.message;}
 return {personal,outfitStock,outfitPrice:PONCHO_PRICE,outfitIssueReason,sectorId,operativeId:op?.id??null,candidates:candidates.map(op=>({id:op.id,name:op.nickname??op.name})),reason,carriedReason,entries,repairReserves,carried,usage:personal?inventoryUsage(personal):null};
}

function modelStoreReason(s,location,reason,actor){
 return reason??(s.location!==location?'La escuadra activa debe estar en este sector.':!['retiro','cordoba','mendoza'].includes(location)?'Llevá el arma a una maestranza.':actor?.equipmentCursor?'Colocá primero el objeto del cursor.':(s.armoryItems?.length??0)>=10000?'La armería está llena.':null);
}

// The campaign dispatcher provides a private copy. Plan every transfer before
// updating either custodian; the source key is resolved again on confirmation.
export function moveSectorItem(s,action,roster){
 const {sector:sectorId,operativeId,direction,count=1}=action;
 need(['take','takeRepairPoints','drop','store','equip','issueOutfit','arrange','attachment','unload'].includes(direction)&&Number.isSafeInteger(count)&&count>0&&count<=1000000,'La orden de inventario no es válida.');
 const model=sectorInventoryModel(s,sectorId,roster,operativeId);
 const reason=['equip','issueOutfit','arrange','attachment','unload'].includes(direction)?model.carriedReason:model.reason;need(!reason,reason);need(model.operativeId===Number(operativeId),'Elegí un combatiente presente.');
 const op=roster.find(op=>op.id===Number(operativeId)),snapshot=inventorySite(s,sectorId).snapshot,actor=['equip','issueOutfit','arrange','attachment','unload'].includes(direction)?carriedActor(s,op):actorAt(s,sectorId,op);
 let next,stack,cursorPlan,changedGround=false;
 if(direction==='issueOutfit'){
  need(count===1&&!model.outfitIssueReason,model.outfitIssueReason??'Retirá un poncho por vez.');
  stack={item:'outfit',...makeOutfit()};next=applyItemQuantity(actor,stack);
  const at=inventorySite(s,sectorId).sectorId;s.resources.treasury-=PONCHO_PRICE;s.merchants[at].supplies.ponchos--;changeMerchantCash(s,at,PONCHO_PRICE);
 }else if(direction==='arrange'){
  need(['pocket','equipment','cursor'].includes(action.kind),'Elegí las ranuras que querés ordenar.');
  if(action.kind==='cursor'){
   need(['pickupEquipment','placeEquipment','returnEquipmentCursor','dragEquipment'].includes(action.cursorAction),'La orden del cursor no es válida.');
   if(['pickupEquipment','dragEquipment'].includes(action.cursorAction))need(!roster.some(other=>other.id!==op.id&&s.recruited.includes(other.id)&&s.operativeState[other.id]?.alive&&s.operativeState[other.id]?.equipmentCursor&&!s.operativeState[other.id]?.captured),'Colocá primero el objeto del otro combatiente.');
   if(action.cursorAction==='dragEquipment')need(action.expectedDestination===equipmentFingerprint(actor,action.destinationId),'Cambió el destino. Revisá el equipo.');
   const plan=planEquipmentCursorOrder(actor,{...action,type:action.cursorAction});next=plan.unit;cursorPlan=plan;
   if(plan.dropped){
    need(!model.reason,model.reason);const located=actorAt(s,sectorId,op);need(located,'El combatiente debe entrar al sector para dejar el objeto.');
    need(snapshot.groundItems.length<2000,'No queda espacio para dejar el objeto. Sigue en el cursor.');
    let index=snapshot.groundItems.length,id;do{id=`sector-item-${index++}`;}while(snapshot.groundItems.some(item=>item.id===id));
    snapshot.groundItems.push({...copy(plan.dropped),id,type:'item',...planningPoint(located),knownToPlayer:true});changedGround=true;
   }
  }else{
   need(typeof action.expectedSource==='string'&&typeof action.expectedDestination==='string','Volvé a seleccionar el equipo.');
   next=action.kind==='pocket'?planPocketMove(actor,action.sourceId,action.destinationId,action.expectedSource,action.expectedDestination,action.count):planEquipmentPlacement(actor,action).unit;
  }
 }else if(direction==='unload'){
  need(count===1,'Descargá un arma por vez.');next=planEquipmentUnload(actor,action).unit;
 }else if(direction==='attachment'){
  need(count===1,'Cambiá un accesorio por vez.');
  if(action.operation==='detach')need(!roster.some(other=>other.id!==op.id&&s.recruited.includes(other.id)&&s.operativeState[other.id]?.alive&&s.operativeState[other.id]?.equipmentCursor&&!s.operativeState[other.id]?.captured),'Colocá primero el objeto del otro combatiente.');
  next=planEquipmentAttachment(actor,action).unit;
 }else if(direction==='equip'){
  need(count===1&&['primary','blade','offhand',...BODY_SLOTS,'offhandItem','mainhand'].includes(action.slot),'Elegí una ranura de equipo.');
  const stow=BODY_SLOTS.includes(action.slot)&&action.inventoryKey===null;
  if(action.slot==='mainhand'){
   stack=extractItemQuantity(actor,action.inventoryKey,1).stack;need(action.expected===JSON.stringify(stack),'El objeto cambió. Revisá el equipo.');
   next=planReadyMainHand(actor,action.inventoryKey);
  }else if(action.slot==='offhandItem'){
   const reference=action.inventoryKey===null?actor.leftHandItem:action.inventoryKey;
   stack=extractItemQuantity(actor,reference,1).stack;need(action.expected===JSON.stringify(stack),'El objeto cambió. Revisá el equipo.');
   next=planEquipLoot(actor,action.inventoryKey,action.slot);
  }else{
  need(action.expected===JSON.stringify(stow?wornOutfit(actor,action.slot):actor.inventory?.[action.inventoryKey])&&typeof action.expected==='string','El equipo cambió. Revisá la mochila antes de equiparlo.');
  stack=extractItemQuantity(actor,stow?action.slot:`inventory:${action.inventoryKey}`,1).stack;next=planEquipLoot(actor,action.inventoryKey,action.slot);
  }
 }else if(direction==='takeRepairPoints'){
  const row=serviceReturnSources(s,sectorId,snapshot).find(row=>row.key===action.sourceKey&&row.repairPoints>0),entry=model.repairReserves.find(row=>row.key===action.sourceKey);
  need(row&&entry?.reachable,entry?.reason??'Los materiales ya no están disponibles.');
  need(typeof action.expected==='string'&&action.expected===JSON.stringify({repairPoints:row.repairPoints}),'La reserva cambió. Revisá la lista antes de retirarla.');
  need(count<=row.repairPoints,'No quedan esos materiales de reparación.');
  const points=actor.toolkitPoints??0;
  need(Number.isSafeInteger(points)&&points>=0&&points+count<=100000,'El combatiente no puede llevar más materiales de reparación.');
  next={...actor,toolkitPoints:points+count};
  const consumed=consumeServiceReturn(s,row.sourceKey,action.expected,count);need(consumed.repairPoints===count,'La reserva cambió. Revisá los materiales.');
 }else if(direction==='take'){
  const row=siteSources(s,sectorId,snapshot).find(row=>row.key===action.sourceKey),entry=model.entries.find(row=>row.key===action.sourceKey);
  need(row&&entry?.reachable,entry?.reason??'El equipo ya no está disponible.');need(action.expected===JSON.stringify(row.stack),'El equipo cambió. Revisá la lista antes de recogerlo.');need(count<=row.stack.count,'No queda esa cantidad del objeto.');
  stack={...row.stack,count};next=applyItemQuantity(actor,stack);
  if(row.kind==='serviceReturn'){
   const consumed=consumeServiceReturn(s,row.sourceKey,action.expected,count);need(JSON.stringify(consumed.stack)===JSON.stringify(stack),'El equipo cambió. Revisá la lista.');
  }else if(row.kind==='body'){const extraction=extractItemQuantity(row.source,row.item,count);syncUnitAmmunition(extraction.unit);Object.keys(row.source).forEach(key=>delete row.source[key]);Object.assign(row.source,extraction.unit);}
  else if(row.kind==='drop')row.source.taken=true;
  else if(row.kind==='container'){row.source.contents[row.index].count-=count;if(!row.source.contents[row.index].count)row.source.contents.splice(row.index,1);}
  else row.source.count-=count;
 }else if(direction==='store'){
  const row=model.carried.find(row=>row.item===action.item);
  need(count===1&&row?.store?.valid,row?.store?.reason??'Elegí un arma para guardar.');
  need(action.expected===row.store.expected,'El equipo cambió. Revisá el arma antes de guardarla.');
  const extraction=extractItemQuantity(actor,action.item,1);next=extraction.unit;stack=extraction.stack;
  const {weapon,count:quantity,weight,item,...metadata}=stack;
  storeEquipment(s,weapon,metadata);
 }else{
  const extraction=extractItemQuantity(actor,action.item,count);next=extraction.unit;stack=extraction.stack;
  need(snapshot.groundItems.length<10000,'No queda espacio para más objetos en el sector.');
  let index=snapshot.groundItems.length,id;do{id=`sector-item-${index++}`;}while(snapshot.groundItems.some(item=>item.id===id));
  snapshot.groundItems.push({...copy(stack),id,type:'item',...planningPoint(actor),knownToPlayer:true});
 }
 const record=s.operativeState[op.id];returnEquipment(s,op.id,next);
 for(const key of fields)if(next[key]!==undefined)record[key]=copy(next[key]);
 const source=direction==='arrange'&&action.kind==='equipment'?equipmentEndpoint(actor,action.sourceId):null;
 const destination=source?equipmentEndpoint(actor,action.destinationId):null;
 const incoming=destination?.id==='hand:right'?source?.item:source?.id==='hand:right'?destination?.item:null;
 const replacesPrimary=incoming==='offhand'||incoming?.startsWith('inventory:')&&Boolean(actor.inventory?.[incoming.slice(10)]?.weapon);
 const changesMainWeapon=direction==='arrange'&&(replacesPrimary||next.weapon!==actor.weapon||next.weaponInstanceId!==actor.weaponInstanceId||next.weaponDropped!==actor.weaponDropped);
 const equipsMainWeapon=changesMainWeapon||direction==='equip'&&(action.slot==='primary'||action.slot==='mainhand'&&(action.inventoryKey==='offhand'||action.inventoryKey.startsWith('inventory:')&&stack.weapon));
 if(equipsMainWeapon||record.carriedLoaded!==undefined||next.loaded!==actor.loaded||next.reloadProgress!==actor.reloadProgress)setCarriedLoading(record,next);
 else if(next.weaponDropped)clearCarriedLoading(record);
 syncCarriedAmmunition(record,next.weapon);
 // Returned living soldiers and their cartridge receipt are historical.
 // Their next deployment uses the current campaign equipment record.
 if(changedGround||!['equip','issueOutfit','arrange','attachment','unload'].includes(direction)){
  // A returned living unit is a historical receipt, not another item owner.
  // Retire its identities before a map transfer puts that same item on the field.
  for(const old of snapshot.units.filter(u=>u.side==='player'&&u.hp>0&&snapshot.returnLedger?.entries.some(e=>e.unitId===u.id&&['resident','departed'].includes(e.kind)))){
   delete old.weaponInstanceId;delete old.bladeInstanceId;old.weaponFittingPattern=null;old.bladeFittingPattern=null;old.weaponFittings={};
   delete old.equipmentCursor;
   for(const item of [...(old.offHand?[old.offHand]:[]),...BODY_SLOTS.flatMap(slot=>old[slot]?[old[slot]]:[]),...Object.values(old.inventory??{})]){delete item.instanceId;delete item.fittingPattern;delete item.fittings;}
  }
  validateBattleSnapshot(snapshot);
 }
 if(direction==='store')return `${op.nickname??op.name} guarda ${stackLabel(stack)} en la armería, con su estado y carga actuales.`;
 if(direction==='takeRepairPoints')return `${op.nickname??op.name} retira ${count} puntos de reparación en el sector.`;
 if(direction==='unload')return `${op.nickname??op.name} descarga el arma y guarda la munición.`;
 if(direction==='attachment')return `${op.nickname??op.name} ${action.operation==='detach'?'retira la bayoneta al cursor':'coloca la bayoneta en el arma'}.`;
 if(cursorPlan?.operation==='reload')return `${op.nickname??op.name} recarga ${WEAPONS[cursorPlan.host].name} con ${cursorPlan.rounds} cartucho${cursorPlan.rounds===1?'':'s'}.`;
 if(direction==='arrange')return `${op.nickname??op.name} ordena su equipo.`;
 return `${op.nickname??op.name} ${direction==='take'?'recoge':direction==='equip'?(action.inventoryKey===null?'guarda':'equipa'):direction==='issueOutfit'?'retira del depósito':'deja'} ${count} × ${stackLabel(stack)} en el sector.`;
}
