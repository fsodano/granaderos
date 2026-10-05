import {ammunitionByType,addAmmunition,consumeAmmunition} from './ammunition-types.js';
import {initializeUnitAmmunition,syncUnitAmmunition} from './tactical-ammunition.js';
import {alternativeLoadsFor} from './firearm-loads.js';
import {AMMUNITION_FAMILIES} from './ammunition-families.js';
import {removeUnitIgnitionSupplies} from './ignition-kit.js';
// Gameplay families deliberately group historical calibers. No loose ignition kit is tracked.
/** @type {Readonly<Record<string, Readonly<{name:string,art:string,description:string,weapons:readonly number[]}>>>} */
export const AMMO_TYPES=Object.freeze(Object.fromEntries(Object.values(AMMUNITION_FAMILIES).map(({id,name,art,description,weapons})=>[id,Object.freeze({name,art,description,weapons})])));
export const AMMO_KEYS=Object.freeze(Object.keys(AMMO_TYPES));
export function primaryAmmoTypeFor(value){
 const raw=typeof value==='object'&&value!==null?value.weapon??value.primary??value.template??value.id:value;
 const id=typeof raw==='object'?raw?.id:raw;
 const fallback=AMMO_KEYS.find(key=>AMMO_TYPES[key].weapons.includes(id))??null;
 if(!fallback)return null;
 const definition=value?.contentWeapon??value?.weaponMetadata?.contentWeapon??value;
 const authored=definition?.ammunitionFamily;
 return authored===undefined?fallback:Object.hasOwn(AMMO_TYPES,authored)?authored:null;
}
export function ammunitionLoadsFor(value){
 const primary=primaryAmmoTypeFor(value);if(!primary)return [];
 const definition=value?.contentWeapon??value?.weaponMetadata?.contentWeapon??value;
 return [{family:primary,...(definition?.projectileAirDrag!==undefined?{projectileAirDrag:definition.projectileAirDrag}:{}),...(definition?.projectileEnergy!==undefined?{projectileEnergy:definition.projectileEnergy}:{}),...(definition?.materialRangeSlope!==undefined?{materialRangeSlope:definition.materialRangeSlope}:{})},...alternativeLoadsFor(value)];
}
export function ammoTypeFor(value){return value?.ammunitionChoice??primaryAmmoTypeFor(value);}
export function selectedAmmunitionLoad(value){return ammunitionLoadsFor(value).find(load=>load.family===ammoTypeFor(value));}
export function ammunitionChoiceReason(unit,family){
 if(!ammunitionLoadsFor(unit).some(load=>load.family===family))return 'El arma no admite esa carga.';
 if(unit.weaponDropped||unit.activeSlot!==undefined&&unit.activeSlot!=='primary')return 'Tené el arma de fuego en la mano.';
 if((unit.loaded??0)>0||unit.reloadProgress)return 'Vaciá el arma y terminá la recarga antes de cambiar de carga.';
 return null;
}
export function validateAmmunitionChoice(unit){
 if(unit.ammunitionChoice!==undefined&&(!Object.hasOwn(AMMO_TYPES,unit.ammunitionChoice)||!selectedAmmunitionLoad(unit)))throw Error('La carga elegida no corresponde al arma.');
}
export function ammoStock(unit){
 if(unit?.ammunitionVersion===2){const stock=ammunitionByType(unit);return Object.fromEntries(Object.values(AMMUNITION_FAMILIES).filter(f=>stock[f.type]>0).map(f=>[f.id,stock[f.type]]));}
 if(unit?.ammunition!==undefined)return {...unit.ammunition};
 // Unarmed legacy carriers keep their cartridges as musket ammunition.
 return {[ammoTypeFor(unit)??'ammoMusket']:unit?.ammo??0};
}
export function ammoCount(unit,key=ammoTypeFor(unit)){return key?(ammoStock(unit)[key]??0):0;}
export function totalAmmo(unit){return Object.values(ammoStock(unit)).reduce((sum,n)=>sum+n,0);}
export function normalizeAmmo(unit){
 initializeUnitAmmunition(unit,{defaultCount:0});
 return removeUnitIgnitionSupplies(unit);
}
export function changeAmmo(unit,key,delta){
 if(!Object.hasOwn(AMMO_TYPES,key))throw Error('El tipo de munición no es válido.');
 const next=ammoCount(unit,key)+delta;
 if(!Number.isSafeInteger(next)||next<0||next>1000000)throw Error('La cantidad de munición no es válida.');
 if(unit.ammunitionVersion===2){
  if(delta>0)addAmmunition(unit,AMMUNITION_FAMILIES[key].type,delta);
  else if(delta<0)consumeAmmunition(unit,AMMUNITION_FAMILIES[key].type,-delta);
  syncUnitAmmunition(unit);
 }else {unit.ammunition={...ammoStock(unit),[key]:next};unit.ammo=totalAmmo(unit);}
}
export function validateAmmo(unit){
 if(unit.ammunitionVersion===2){
  if(unit.ammunition!==undefined)throw Error('La partida contiene dos reservas de munición para el mismo propietario.');
  const before=unit.ammo;normalizeAmmo(unit);
  if(before!==undefined&&before!==unit.ammo)throw Error('La reserva de munición compatible no coincide.');
  return;
 }
 if(unit.ammunition!==undefined){
  const stock=unit.ammunition;
  if(!stock||typeof stock!=='object'||Array.isArray(stock)||Object.entries(stock).some(([key,n])=>!Object.hasOwn(AMMO_TYPES,key)||!Number.isSafeInteger(n)||n<0||n>1000000))throw Error('La reserva de munición no es válida.');
  if(unit.ammo!==undefined&&unit.ammo!==totalAmmo(unit))throw Error('El total de munición no coincide con sus tipos.');
 }
 normalizeAmmo(unit);
}
export function supplyCount(unit,key){return Object.hasOwn(AMMO_TYPES,key)?ammoCount(unit,key):key==='ammo'?ammoCount(unit):unit?.[key]??0;}
export function changeSupply(unit,key,delta){
 if(key==='ammo')key=ammoTypeFor(unit)??'ammoMusket';
 if(Object.hasOwn(AMMO_TYPES,key))changeAmmo(unit,key,delta);
 else unit[key]=(unit[key]??0)+delta;
}

export function migrateAmmoGround(items=[]){
 return items.filter(g=>!['priming','flints'].includes(g.type)).map(g=>g.type==='ammo'?{...g,type:'ammoMusket'}:g);
}

export function ammunitionForWeapon(value){return AMMO_TYPES[ammoTypeFor(value)]??null;}

export {removeIgnitionSupplies} from './ignition-kit.js';

// Strategic ammunition owners also exist outside the loaded scene. Inspect the
// known record collections; inventory keys and authored data are not unit fields.
export function validateStoredAmmo(state){
 const values=value=>value&&typeof value==='object'?Object.values(value):[];
 const list=value=>Array.isArray(value)?value:[];
 const request=state.pendingBattle;
 const records=[...values(state.operativeState),...values(state.missionAllies),
  ...values(state.garrisons).flatMap(list),
  ...list(state.militiaTraining).flatMap(course=>list(course?.trainees)),
  ...['squad','garrison','missionAllies','enemies','ammunitionSources','garrisonLootSources','casualtyLootSources'].flatMap(key=>list(request?.[key]))];
 for(const record of records){
  if(!record||typeof record!=='object'||!Object.hasOwn(record,'ammunition'))continue;
  if(!Number.isSafeInteger(record.ammo))throw Error('El total de munición guardado no es válido.');
  validateAmmo({...record});
 }
}
