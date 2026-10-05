import {handRecord} from './tactical-inventory.js';
import {WEAPON_READY_AP} from './weapon-readiness.js';
import {AMMO_TYPES,primaryAmmoTypeFor,selectedAmmunitionLoad,validateAmmunitionChoice} from './ammo-types.js';
import {validateReloadProgress} from './weapon-reload.js';
import {WEAPONS as ITEMS} from './data.js';
import {WEAPONS as FIREARMS} from './firearm-definitions.js';
import {BLADES} from './blade-definitions.js';
import {canonicalContent} from './content-identity.js';
import {validMaterialRangeSlope} from './material-range-penetration.js';
import {validProjectileEnergy} from './projectile-energy.js';
import {validProjectileAirDrag} from './projectile-air-drag.js';
export const FIREARM_PRICES={1800:240,1801:230,1802:420,1803:180,1804:100,1805:130,1806:180,1807:160,1808:220};
export const BLADE_PRICES={1809:160,1810:110,1811:50,1812:70,1813:40};
export const isBladeDefinition=value=>Object.hasOwn(BLADES,value?.template);
export const FIREARM_MELEE_FIELDS=['stockAP','stockDamage','stockReach'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const validWeaponArt=value=>typeof value==='string'&&(/^\/art\/[a-zA-Z0-9_-]+\.(webp|png|jpg)$/.test(value)||(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<350000));
export function compileWeaponDefinition(authored){
 if(isBladeDefinition(authored)){
  need(authored.ammunitionFamily===undefined&&authored.alternativeLoads===undefined&&authored.materialRangeSlope===undefined&&authored.projectileEnergy===undefined&&authored.projectileAirDrag===undefined,'La munición solo se configura en armas de fuego.');
  need(!FIREARM_MELEE_FIELDS.some(key=>Object.hasOwn(authored,key)),'El golpe con la culata solo se configura en armas de fuego.');
  const result={version:1,id:authored.id,template:authored.template,name:authored.name,damage:authored.damage,ap:authored.ap,reach:authored.reach,weight:authored.weight??ITEMS[authored.template].weight,price:authored.price??BLADE_PRICES[authored.template],art:authored.art??`/art/weapon-${authored.template}.png`};
  validateWeaponDefinition(result,authored.template);return result;
 }
 const base=FIREARMS[authored.template];need(base,'La familia del arma no es válida.');
 const melee=Object.fromEntries(FIREARM_MELEE_FIELDS.filter(key=>Object.hasOwn(authored,key)).map(key=>[key,authored[key]]));
 const result={...melee,...(authored.projectileAirDrag!==undefined?{projectileAirDrag:structuredClone(authored.projectileAirDrag)}:{}),...(authored.projectileEnergy!==undefined?{projectileEnergy:structuredClone(authored.projectileEnergy)}:{}),...(authored.materialRangeSlope!==undefined?{materialRangeSlope:authored.materialRangeSlope}:{}),...(authored.alternativeLoads!==undefined?{alternativeLoads:structuredClone(authored.alternativeLoads)}:{}),...(authored.ammunitionFamily!==undefined?{ammunitionFamily:authored.ammunitionFamily}:{}),version:1,id:authored.id,template:base.id,name:authored.name,damage:authored.damage,fireAP:authored.fireAP,aimAP:authored.aimAP,reloadAP:authored.reloadAP,range:authored.range,readyAP:authored.readyAP??0,capacity:authored.capacity??base.capacity,weight:authored.weight??ITEMS[base.id].weight,price:authored.price??FIREARM_PRICES[base.id],art:authored.art??`/art/weapon-${base.id}.png`};
 validateWeaponDefinition(result,base.id);return result;
}
export function validateWeaponDefinition(value,host){
 if(value===undefined)return;
 const blade=Boolean(BLADES[host]);
 const keys=blade?['version','id','template','name','damage','ap','reach','weight','price','art']:['version','id','template','name','damage','fireAP','aimAP','reloadAP','range','readyAP','capacity','weight','price','art'];
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)||!blade&&(FIREARM_MELEE_FIELDS.includes(k)||['ammunitionFamily','alternativeLoads','materialRangeSlope','projectileEnergy','projectileAirDrag'].includes(k)))&&keys.every(k=>Object.hasOwn(value,k)),'La definición del arma no es válida.');
 if(Object.hasOwn(value,'projectileEnergy'))need(!blade&&validProjectileEnergy(value.projectileEnergy),'El perfil de energía del proyectil no es válido.');
 if(Object.hasOwn(value,'projectileAirDrag'))need(!blade&&validProjectileAirDrag(value.projectileAirDrag,value.projectileEnergy),'La pérdida de energía en el aire no es válida.');
 if(Object.hasOwn(value,'materialRangeSlope'))need(!blade&&validMaterialRangeSlope(value.materialRangeSlope),'La pérdida de penetración por distancia no es válida.');
 need(value.version===1&&(FIREARMS[host]||BLADES[host])&&value.template===host,'La definición del arma no coincide con su familia.');
 if(Object.hasOwn(value,'ammunitionFamily'))need(!blade&&typeof value.ammunitionFamily==='string'&&Object.hasOwn(AMMO_TYPES,value.ammunitionFamily),'La familia de munición no es válida.');
 if(Object.hasOwn(value,'alternativeLoads')){
  const primary=primaryAmmoTypeFor(value),loads=value.alternativeLoads;
  need(!blade&&Array.isArray(loads)&&loads.length<=3&&new Set(loads.map(l=>l?.family)).size===loads.length&&loads.every(l=>l&&typeof l==='object'&&!Array.isArray(l)&&Object.keys(l).every(k=>['family','damage','range','pattern','materialRangeSlope','projectileEnergy','projectileAirDrag'].includes(k))&&['family','damage','range','pattern'].every(k=>Object.hasOwn(l,k))&&(!Object.hasOwn(l,'materialRangeSlope')||validMaterialRangeSlope(l.materialRangeSlope))&&(!Object.hasOwn(l,'projectileEnergy')||validProjectileEnergy(l.projectileEnergy))&&(!Object.hasOwn(l,'projectileAirDrag')||validProjectileAirDrag(l.projectileAirDrag,l.projectileEnergy))&&Object.hasOwn(AMMO_TYPES,l.family)&&l.family!==primary&&integer(l.damage,1,100)&&integer(l.range,1,100)&&['single','cone'].includes(l.pattern)),'Las cargas alternativas no son válidas.');
 }
 need(typeof value.id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value.id)&&!['constructor','prototype','bronze4','field8','swivel'].includes(value.id),'La identidad del arma no es válida.');
 need(typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100,'El nombre del arma no es válido.');
 if(blade){need(integer(value.damage,1,100)&&integer(value.ap,1,100)&&Number.isFinite(value.reach)&&value.reach>=1&&value.reach<=4,'Los valores del arma blanca no son válidos.');}
 else {for(const key of ['damage','fireAP','aimAP','reloadAP','range','readyAP'])need(integer(value[key],['aimAP','readyAP'].includes(key)?0:1,key==='reloadAP'?500:100),'Los valores del arma no son válidos.');
 for(const key of FIREARM_MELEE_FIELDS)if(Object.hasOwn(value,key))need(key==='stockReach'?Number.isFinite(value[key])&&value[key]>=1&&value[key]<=1.5:integer(value[key],1,100),'Los valores del golpe con la culata no son válidos.');
 need(value.readyAP<value.fireAP&&integer(value.capacity,1,8),'El manejo del arma no es válido.');}
 need(Number.isFinite(value.weight)&&value.weight>=.1&&value.weight<=30&&integer(value.price,0,1000000),'El manejo del arma no es válido.');
 need(validWeaponArt(value.art),'La imagen del arma no es válida.');
}
export function contentWeaponOf(value,slot='primary'){return slot==='blade'?value?.bladeMetadata?.contentWeapon:value?.contentWeapon??value?.weaponMetadata?.contentWeapon;}
export function weaponSpecification(value,slot='primary'){
 const raw=typeof value==='object'&&value!==null?slot==='blade'?value.blade:value.weapon??value.item??value.id:value;
 const id=typeof raw==='object'?raw?.id:raw,definition=contentWeaponOf(value,slot);
 if(!ITEMS[id]&&!FIREARMS[id])return null;
 const load=slot==='primary'?selectedAmmunitionLoad(value):null;
 const specification={...ITEMS[id],...FIREARMS[id],...BLADES[id],...(FIREARMS[id]?{readyAP:WEAPON_READY_AP[id]??0,loadPattern:load?.pattern??(load?.family==='ammoShot'?'cone':'single')}:{}),...(BLADES[id]?{capacity:0}:{}),...(typeof raw==='object'?raw:{}),...definition,...(load?.damage?{damage:load.damage,range:load.range,loadPattern:load.pattern}:{}),id,...(definition?{contentId:definition.id}:{}),art:definition?.art??`/art/weapon-${id}.png`,price:definition?.price??FIREARM_PRICES[id]??BLADE_PRICES[id]};
 // Alternative omission is neutral, rather than inheriting the primary load.
 if(load&&load.family!==primaryAmmoTypeFor(value)){
  delete specification.materialRangeSlope;
  delete specification.projectileEnergy;
  delete specification.projectileAirDrag;
  if(load.projectileAirDrag!==undefined)specification.projectileAirDrag=structuredClone(load.projectileAirDrag);
  if(load.projectileEnergy!==undefined)specification.projectileEnergy=structuredClone(load.projectileEnergy);
  if(load.materialRangeSlope!==undefined)specification.materialRangeSlope=load.materialRangeSlope;
 }
 return specification;
}
export function weaponMetadata(definition){return {contentWeapon:compileWeaponDefinition(definition)};}
export function validateWeaponCarrier(value){
 validateAmmunitionChoice(value);
 if(value.bladeCondition!==undefined)need(Number.isFinite(value.bladeCondition)&&value.bladeCondition>=0&&value.bladeCondition<=100,'El estado del arma blanca no es válido.');
 if(value.bladeJammed!==undefined)need(typeof value.bladeJammed==='boolean','Los datos del arma blanca no son válidos.');
 if(value.jammed!==undefined)need(typeof value.jammed==='boolean','El atasco del arma no es válido.');
 const host=typeof value.weapon==='object'?value.weapon.id:value.weapon;
 const definition=contentWeaponOf(value);validateWeaponDefinition(definition,host);
 validateReloadProgress(value.reloadProgress,weaponSpecification(value)?.capacity??0,value.loaded??0,Boolean(value.weaponDropped));
 if(value.weaponMetadata!==undefined)need(value.weaponMetadata&&typeof value.weaponMetadata==='object'&&!Array.isArray(value.weaponMetadata)&&!['weapon','loaded','condition','jammed','count','reloadProgress','ammunitionChoice'].some(key=>Object.hasOwn(value.weaponMetadata,key)),'Los datos del arma no son válidos.');
 const blade=contentWeaponOf(value,'blade');validateWeaponDefinition(blade,value.blade);
 if(value.bladeMetadata!==undefined)need(BLADES[value.blade]&&value.bladeMetadata&&!Array.isArray(value.bladeMetadata)&&!['weapon','loaded','condition','jammed','count','reloadProgress','ammunitionChoice'].some(key=>Object.hasOwn(value.bladeMetadata,key)),'Los datos del arma blanca no son válidos.');
 if(definition&&value.loaded!==undefined)need(integer(value.loaded,0,definition.capacity??0),'La carga del arma no es válida.');
 if(definition&&value.weight!==undefined&&value.count!==undefined)need(value.weight===definition.weight,'El peso del arma no coincide con su definición.');
}
// Every copy of an authored definition must match the pinned campaign package.
export function validateWeaponReferences(state,value){
 const definitions=new Map((state.contentCampaign?.package.weapons??[]).map(w=>[w.id,compileWeaponDefinition(w)]));
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(Object.hasOwn(node,'contentWeapon')){
   const definition=node.contentWeapon,expected=definitions.get(definition?.id);
   need(expected&&canonicalContent(expected)===canonicalContent(definition),'El arma guardada no coincide con el contenido de campaña.');
  }
  for(const [key,child]of Object.entries(node))if(key!=='contentCampaign'&&key!=='contentWeapon')visit(child);
 }
 visit(value);
}
export function weaponRecord(carrier,slot='primary'){return handRecord(carrier,slot);}
export function setWeaponDefinition(carrier,source,slot='primary'){
 const definition=contentWeaponOf(source);
 if(slot==='blade'){delete carrier.bladeMetadata;carrier.bladeCondition=source.condition??100;carrier.bladeJammed=Boolean(source.jammed);if(definition)carrier.bladeMetadata={contentWeapon:structuredClone(definition)};return;}
 delete carrier.contentWeapon;delete carrier.weaponMetadata;delete carrier.ammunitionChoice;
 if(source.ammunitionChoice!==undefined)carrier.ammunitionChoice=source.ammunitionChoice;
 if(definition)carrier.weaponMetadata={contentWeapon:structuredClone(definition)};
}
// Saves reference the immutable package once instead of repeating uploaded images
// for every gun. Existing inline definitions remain readable and fully validated.
export function weaponSaveReplacer(state){
 const definitions=new Map((state.contentCampaign?.package.weapons??[]).map(w=>{const d=compileWeaponDefinition(w);return [d.id,canonicalContent(d)];}));
 return (key,value)=>key==='contentWeapon'&&value&&definitions.get(value.id)===canonicalContent(value)?{definitionRef:value.id}:value;
}
export function restoreWeaponReferences(state,value){
 const definitions=new Map((state.contentCampaign?.package.weapons??[]).map(w=>[w.id,compileWeaponDefinition(w)]));
 function visit(node){
  if(!node||typeof node!=='object')return;
  const reference=node.contentWeapon;
  if(reference&&Object.hasOwn(reference,'definitionRef')){
   need(Object.keys(reference).length===1&&definitions.has(reference.definitionRef),'La referencia del arma guardada no es válida.');
   node.contentWeapon={...definitions.get(reference.definitionRef)};
  }
  for(const [key,child]of Object.entries(node))if(key!=='contentCampaign'&&key!=='contentWeapon')visit(child);
 }
 visit(value);
}
