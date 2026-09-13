import {WEAPONS} from './data.js';
import {AMMUNITION_TYPES,weaponAmmoType,isAmmunitionStack,validateAmmunitionStack,ammunitionByType,totalReserveAmmunition} from './ammunition-types.js';
import {initializeUnitAmmunition,syncUnitAmmunition} from './tactical-ammunition.js';

export const AMMUNITION_VERSION=1;
export const AMMUNITION_RESOURCE_KEYS=Object.freeze(Object.fromEntries(Object.keys(AMMUNITION_TYPES).map(type=>[type,type==='musket_75'?'cartridges':`ammo_${type}`])));
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function validateAmmoCounts(value){need(value!==null&&typeof value==='object'&&!Array.isArray(value),'La cuenta de munición no es válida.');for(const[type,n]of Object.entries(value))need(Object.hasOwn(AMMUNITION_TYPES,type)&&count(n),'La cuenta de munición no es válida.');return value;}
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000;
export function ammoResourceKey(type){need(typeof type==='string'&&Object.hasOwn(AMMUNITION_RESOURCE_KEYS,type),'El tipo de munición no es válido.');return AMMUNITION_RESOURCE_KEYS[type];}
export function initialAmmunitionStock(){return Object.fromEntries(Object.values(AMMUNITION_RESOURCE_KEYS).map((key,i)=>[key,[100,60,30,20,20,20,10,20,20][i]]));}
export function addAmmoCounts(target,source,factor=1){for(const[type,n]of Object.entries(source??{})){need(Object.hasOwn(AMMUNITION_TYPES,type)&&count(n),'La cuenta de munición no es válida.');target[type]=(target[type]??0)+n*factor;}return target;}
export const totalAmmoCounts=counts=>Object.values(counts??{}).reduce((sum,n)=>sum+n,0);
export function stackAmmunitionByType(stack){
 if(!stack||typeof stack!=='object')return {};
 if(isAmmunitionStack(stack)){validateAmmunitionStack(stack);return stack.count?{[stack.ammoType]:stack.count}:{};}
 const type=weaponAmmoType(stack.weapon??(typeof stack.item==='number'?stack.item:null));
 return type&&stack.loaded?{[type]:stack.loaded*(stack.count??1)}:{};
}
export function unitAmmunitionByType(unit){
 const result=ammunitionByType(unit),type=weaponAmmoType(unit.weapon);
 if(type&&!unit.weaponDropped&&unit.loaded)addAmmoCounts(result,{[type]:unit.loaded});
 addAmmoCounts(result,stackAmmunitionByType(unit.offHand));
 addAmmoCounts(result,stackAmmunitionByType(unit.equipmentCursor?.stack));
 for(const item of Object.values(unit.inventory??{}))if(!isAmmunitionStack(item))addAmmoCounts(result,stackAmmunitionByType(item));
 return result;
}
function fieldStacks(snapshot){return [...(snapshot?.groundItems??[]),...(snapshot?.droppedWeapons??[]),...[...(snapshot?.props??[]),...(snapshot?.tiles??[]),...(snapshot?.npcs??[])].flatMap(owner=>[...(owner.contents??[]),...(owner.questGifts??[])])];}
function rejectLegacyStacks(stacks){for(const stack of stacks)need(stack?.item!=='ammo','La munición guardada necesita un tipo explícito.');}
export function fieldAmmunitionByType(snapshot){
 const result={};
 for(const item of snapshot?.groundItems??[])if(!item.heldBy)addAmmoCounts(result,stackAmmunitionByType(item));
 for(const item of snapshot?.droppedWeapons??[])if(!item.taken)addAmmoCounts(result,stackAmmunitionByType(item));
 for(const container of [...(snapshot?.props??[]),...(snapshot?.tiles??[]),...(snapshot?.npcs??[])])for(const item of [...(container.contents??[]),...(container.questGifts??[])])addAmmoCounts(result,stackAmmunitionByType(item));
 return result;
}
function migrateStack(stack){
 if(stack?.item==='ammo'){
  need(stack.kind===undefined&&stack.ammoType===undefined,'La munición antigua contiene un tipo inválido.');
  need(count(stack.count)&&stack.weight===.04,'La munición antigua contiene cantidades inválidas.');
  Object.assign(stack,{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:stack.name??AMMUNITION_TYPES.musket_75.name});
  validateAmmunitionStack(stack);
 }
}
function rejectMixedLegacy(root){
 const pending=[root];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;
  need(value.ammunitionVersion===undefined&&!isAmmunitionStack(value)&&['ammunitionByType','issuedAmmunition','fieldAmmunition','creditedAmmunition'].every(key=>value[key]===undefined),'La partida mezcla reglas antiguas y nuevas de munición.');
  for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);
 }
}
export function migrateBattleAmmunition(snapshot,{legacy=snapshot?.ammunitionVersion===undefined}={}){
 if(!snapshot)return snapshot;
 need(snapshot.ammunitionVersion===undefined||snapshot.ammunitionVersion===1,'La versión de munición no es válida.');
 legacy=snapshot.ammunitionVersion===undefined;
 if(legacy)rejectMixedLegacy(snapshot);
 for(const unit of snapshot.units??[]){
  if(!legacy)need(unit.ammunitionVersion===1,'La munición del combatiente no tiene versión.');
  initializeUnitAmmunition(unit,{legacy,defaultCount:0});
 }
 if(legacy)for(const stack of fieldStacks(snapshot))migrateStack(stack);
 else {rejectLegacyStacks(fieldStacks(snapshot));for(const u of snapshot.units??[])rejectLegacyStacks(Object.values(u.inventory??{}));}
 snapshot.ammunitionVersion=1;return snapshot;
}
export function syncCarriedAmmunition(record,weapon){
 record.carriedAmmo=totalReserveAmmunition(record)+(record.captured?0:record.carriedLoaded??0);
 if(record.captured&&record.capturedAmmunition)record.capturedAmmunition.ammo=totalReserveAmmunition(record);
 record.ammunitionVersion=1;
 return record;
}
function initializeStrategicRecord(record,weapon,legacy){
 const loaded=record.captured?record.capturedAmmunition?.loaded??0:record.carriedLoaded??0;
 const carried=record.carriedAmmo??0;
 need(count(carried)&&count(loaded)&&(record.captured||loaded<=carried),'La munición personal antigua no es válida.');
 const loose=record.captured?record.capturedAmmunition?.ammo??0:carried-loaded;
 const actor={...record,weapon,loaded,ammo:loose};
 initializeUnitAmmunition(actor,{legacy,defaultCount:0});
 for(const key of ['inventory','pocketOrder','equipmentCursor','activeItem','leftHandItem','activeSlot','handItems','leftHandMetadata','mainHandMetadata'])if(Object.hasOwn(actor,key))record[key]=structuredClone(actor[key]);else delete record[key];
 syncCarriedAmmunition(record,weapon);
}
export function migrateCampaignAmmunition(state,roster=[],{fresh=false}={}){
 need(state.ammunitionVersion===undefined||state.ammunitionVersion===1,'La versión de munición no es válida.');
 const legacy=state.ammunitionVersion===undefined;
 if(!legacy)return state;
 if(!fresh){rejectMixedLegacy(state);need(Object.values(AMMUNITION_RESOURCE_KEYS).filter(key=>key!=='cartridges').every(key=>state.resources?.[key]===undefined)&&Object.values(state.merchants??{}).every(m=>m.ammunition===undefined),'La partida mezcla reservas antiguas y nuevas de munición.');}
 const snapshots=[...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{}),...(state.pendingBattle?.resumeSnapshot?[state.pendingBattle.resumeSnapshot]:[])];
 const looseLegacy=!fresh&&((state.resources?.cartridges??0)>0||Object.values(state.depots??{}).some(d=>d.cartridges>0)||[...(state.shipments??[]),...(state.convoys??[])].some(s=>s.goods?.cartridges>0)||Object.values(state.operativeState??{}).some(r=>r.ammunitionVersion===undefined&&((r.carriedAmmo??0)-(r.carriedLoaded??0)>0||r.capturedAmmunition?.ammo>0))||(state.pendingBattle?.squad??[]).some(u=>u.ammunitionVersion===undefined&&u.ammo>0)||snapshots.some(b=>(b.units??[]).some(u=>u.ammunitionVersion===undefined&&u.ammo>0)||fieldStacks(b).some(i=>i.item==='ammo'&&i.count>0)));
 for(const [at,merchant]of Object.entries(state.merchants??{}))merchant.ammunition??=Object.fromEntries(Object.keys(AMMUNITION_TYPES).map(type=>[type,at==='ensenada'?0:60]));
 if(state.resources)for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))if(state.resources[key]===undefined)state.resources[key]=0;
 for(const [id,record]of Object.entries(state.operativeState??{}))initializeStrategicRecord(record,roster.find(op=>String(op.id)===id)?.weapon??state.loadouts?.[id]?.weapon??0,true);
 const requests=state.pendingBattle?[state.pendingBattle]:[];
 for(const request of requests){
  for(const enemy of request.enemies??[]){enemy.weapon??=1800;enemy.loaded??=WEAPONS[enemy.weapon]?.capacity??0;}
  for(const unit of [...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[]),...(request.enemies??[])])initializeUnitAmmunition(unit,{legacy:true,defaultCount:0});
  for(const stack of fieldStacks(request))migrateStack(stack);
  const prior=request.sceneId?state.sceneStates?.[request.sceneId]:state.sectorStates?.[request.sector];
  for(const source of [...(request.ammunitionSources??[]),...(request.garrisonLootSources??[]),...(request.casualtyLootSources??[])]){
   const original=[...(request.enemies??[]),...(prior?.units??[])].find(u=>String(u.id)===String(source.id));
   source.weapon??=original?.weapon??1800;source.loaded??=original?.loaded??WEAPONS[source.weapon]?.capacity??0;
   initializeUnitAmmunition(source,{legacy:true,defaultCount:0});
   source.ammunitionByType=unitAmmunitionByType(source);
   // These old descriptors included cursor rounds outside the loose scalar.
   if(source.cursorCartridges)addAmmoCounts(source.ammunitionByType,{musket_75:source.cursorCartridges});
  }
  request.issuedAmmunition={};for(const unit of request.squad??[])addAmmoCounts(request.issuedAmmunition,unitAmmunitionByType(unit));
  request.issuedCartridges=totalAmmoCounts(request.issuedAmmunition);
  if(prior){migrateBattleAmmunition(prior,{legacy:true});request.fieldAmmunition=fieldAmmunitionByType(prior);}
  else request.fieldAmmunition=request.fieldCartridges?{musket_75:request.fieldCartridges}:{};
  request.fieldCartridges=totalAmmoCounts(request.fieldAmmunition);
  for(const record of request.remains??[])initializeUnitAmmunition(record.unit,{legacy:true,defaultCount:0});
  if(request.resumeSnapshot)migrateBattleAmmunition(request.resumeSnapshot,{legacy:true});
  request.ammunitionVersion=1;
 }
 for(const snapshot of [...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{})])migrateBattleAmmunition(snapshot,{legacy:true});
 for(const records of Object.values(state.sectorRemains??{}))for(const record of records)initializeUnitAmmunition(record.unit,{legacy:true,defaultCount:0});
 for(const unit of [...Object.values(state.garrisons??{}).flat(),...(state.militiaTraining??[]).flatMap(course=>course.trainees??[]),...(state.enemyGroups??[]).flatMap(group=>group.units??[]),...Object.values(state.missionAllies??{})])if(unit&&typeof unit==='object')initializeUnitAmmunition(unit,{legacy:true,defaultCount:0});
 state.ammunitionVersion=1;
 if(looseLegacy&&Array.isArray(state.log)){state.log.unshift({hour:state.hour,text:'La munición antigua sin tipo se conserva como cartucho de mosquete .75. Las cargas dentro de las armas conservan el tipo de cada arma.'});state.log=state.log.slice(0,80);}
 return state;
}
export function syncCampaignAmmunition(state,roster=[]){
 for(const [id,record]of Object.entries(state.operativeState??{})){
  const weapon=roster.find(op=>String(op.id)===id)?.weapon??0;
  if(record.ammunitionVersion===undefined)initializeStrategicRecord(record,weapon,false);
  else syncCarriedAmmunition(record,weapon);
 }
 return state;
}
export function validateCampaignAmmunition(state,roster=[]){
 need(state.ammunitionVersion===1,'La versión de munición no es válida.');
 for(const key of Object.values(AMMUNITION_RESOURCE_KEYS))need(count(state.resources?.[key]),'La reserva de munición no es válida.');
 const unit=u=>{rejectLegacyStacks(Object.values(u?.inventory??{}));need(u?.ammunitionVersion===1,'La munición del combatiente no tiene versión.');const before=u.ammo;syncUnitAmmunition(u);need(count(before)&&before===u.ammo,'La reserva del combatiente no coincide con su inventario.');};
 for(const u of [...Object.values(state.garrisons??{}).flat(),...(state.militiaTraining??[]).flatMap(course=>course.trainees??[]),...(state.enemyGroups??[]).flatMap(group=>group.units??[]),...Object.values(state.missionAllies??{})])unit(u);
 for(const snapshot of [...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{}),...(state.pendingBattle?.resumeSnapshot?[state.pendingBattle.resumeSnapshot]:[])]){rejectLegacyStacks(fieldStacks(snapshot));for(const u of snapshot.units??[])rejectLegacyStacks(Object.values(u.inventory??{}));}
 if(state.pendingBattle){const request=state.pendingBattle;rejectLegacyStacks(fieldStacks(request));
  need(request.ammunitionVersion===1,'El despliegue no tiene versión de munición.');
  for(const u of [...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[]),...(request.enemies??[])])unit(u);
  for(const key of ['issuedAmmunition','fieldAmmunition'])validateAmmoCounts(request[key]);
  for(const source of [...(request.ammunitionSources??[]),...(request.garrisonLootSources??[]),...(request.casualtyLootSources??[])])validateAmmoCounts(source.ammunitionByType);
  need(request.fieldCartridges===totalAmmoCounts(request.fieldAmmunition),'La reserva del campo no coincide con sus tipos.');
 }
 for(const [id,record]of Object.entries(state.operativeState??{})){
  rejectLegacyStacks(Object.values(record.inventory??{}));
  need(record.ammunitionVersion===1,'La munición del combatiente no tiene versión.');
  const expected=totalReserveAmmunition(record)+(record.captured?0:record.carriedLoaded??0);
  need(record.carriedAmmo===expected,'La reserva personal no coincide con su inventario.');
  if(record.captured)need(record.capturedAmmunition?.ammo===totalReserveAmmunition(record),'La munición en custodia no coincide con su inventario.');
 }
 return state;
}
