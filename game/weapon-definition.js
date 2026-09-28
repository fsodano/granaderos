import {validateReloadProgress} from './weapon-reload.js';
import {WEAPONS as ITEMS} from './data.js';
import {WEAPONS as FIREARMS} from './firearm-definitions.js';
import {BLADES} from './blade-definitions.js';
import {canonicalContent} from './content-identity.js';
export const FIREARM_PRICES={1800:240,1801:230,1802:420,1803:180,1804:100,1805:130,1806:180,1807:160,1808:220};
export const BLADE_PRICES={1809:160,1810:110,1811:50,1812:70,1813:40};
export const isBladeDefinition=value=>Object.hasOwn(BLADES,value?.template);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const validWeaponArt=value=>typeof value==='string'&&(/^\/art\/[a-zA-Z0-9_-]+\.(webp|png|jpg)$/.test(value)||(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<350000));
export function compileWeaponDefinition(authored){
 if(isBladeDefinition(authored)){
  const result={version:1,id:authored.id,template:authored.template,name:authored.name,damage:authored.damage,ap:authored.ap,reach:authored.reach,weight:authored.weight??ITEMS[authored.template].weight,price:authored.price??BLADE_PRICES[authored.template],art:authored.art??`/art/weapon-${authored.template}.png`};
  validateWeaponDefinition(result,authored.template);return result;
 }
 const base=FIREARMS[authored.template];need(base,'La familia del arma no es válida.');
 const result={version:1,id:authored.id,template:base.id,name:authored.name,damage:authored.damage,fireAP:authored.fireAP,aimAP:authored.aimAP,reloadAP:authored.reloadAP,range:authored.range,readyAP:authored.readyAP??0,capacity:authored.capacity??base.capacity,weight:authored.weight??ITEMS[base.id].weight,price:authored.price??FIREARM_PRICES[base.id],art:authored.art??`/art/weapon-${base.id}.png`};
 validateWeaponDefinition(result,base.id);return result;
}
export function validateWeaponDefinition(value,host){
 if(value===undefined)return;
 const blade=Boolean(BLADES[host]);
 const keys=blade?['version','id','template','name','damage','ap','reach','weight','price','art']:['version','id','template','name','damage','fireAP','aimAP','reloadAP','range','readyAP','capacity','weight','price','art'];
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'La definición del arma no es válida.');
 need(value.version===1&&(FIREARMS[host]||BLADES[host])&&value.template===host,'La definición del arma no coincide con su familia.');
 need(typeof value.id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value.id)&&!['constructor','prototype','bronze4','field8','swivel'].includes(value.id),'La identidad del arma no es válida.');
 need(typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100,'El nombre del arma no es válido.');
 if(blade){need(integer(value.damage,1,100)&&integer(value.ap,1,100)&&Number.isFinite(value.reach)&&value.reach>=1&&value.reach<=4,'Los valores del arma blanca no son válidos.');}
 else {for(const key of ['damage','fireAP','aimAP','reloadAP','range','readyAP'])need(integer(value[key],['aimAP','readyAP'].includes(key)?0:1,key==='reloadAP'?500:100),'Los valores del arma no son válidos.');
 need(value.readyAP<value.fireAP&&integer(value.capacity,1,8),'El manejo del arma no es válido.');}
 need(Number.isFinite(value.weight)&&value.weight>=.1&&value.weight<=30&&integer(value.price,0,1000000),'El manejo del arma no es válido.');
 need(validWeaponArt(value.art),'La imagen del arma no es válida.');
}
export function contentWeaponOf(value,slot='primary'){return slot==='blade'?value?.bladeMetadata?.contentWeapon:value?.contentWeapon??value?.weaponMetadata?.contentWeapon;}
export function weaponSpecification(value,slot='primary'){
 const raw=typeof value==='object'&&value!==null?slot==='blade'?value.blade:value.weapon??value.item??value.id:value;
 const id=typeof raw==='object'?raw.id:raw,definition=contentWeaponOf(value,slot);
 if(!ITEMS[id]&&!FIREARMS[id])return null;
 return {...ITEMS[id],...FIREARMS[id],...BLADES[id],...(FIREARMS[id]?{readyAP:0}:{}),...(BLADES[id]?{capacity:0}:{}),...(typeof raw==='object'?raw:{}),...definition,id,...(definition?{contentId:definition.id}:{}),art:definition?.art??`/art/weapon-${id}.png`,price:definition?.price??FIREARM_PRICES[id]??BLADE_PRICES[id]};
}
export function weaponMetadata(definition){return {contentWeapon:compileWeaponDefinition(definition)};}
export function validateWeaponCarrier(value){
 if(value.bladeCondition!==undefined)need(Number.isFinite(value.bladeCondition)&&value.bladeCondition>=0&&value.bladeCondition<=100,'El estado del arma blanca no es válido.');
 if(value.bladeJammed!==undefined)need(typeof value.bladeJammed==='boolean','Los datos del arma blanca no son válidos.');
 if(value.jammed!==undefined)need(typeof value.jammed==='boolean','El atasco del arma no es válido.');
 const host=typeof value.weapon==='object'?value.weapon.id:value.weapon;
 const definition=contentWeaponOf(value);validateWeaponDefinition(definition,host);
 validateReloadProgress(value.reloadProgress,weaponSpecification(value)?.capacity??0,value.loaded??0,Boolean(value.weaponDropped));
 if(value.weaponMetadata!==undefined)need(value.weaponMetadata&&typeof value.weaponMetadata==='object'&&Object.keys(value.weaponMetadata).length===1&&Object.hasOwn(value.weaponMetadata,'contentWeapon'),'Los datos del arma no son válidos.');
 const blade=contentWeaponOf(value,'blade');validateWeaponDefinition(blade,value.blade);
 if(value.bladeMetadata!==undefined)need(BLADES[value.blade]&&value.bladeMetadata&&Object.keys(value.bladeMetadata).length===1&&Object.hasOwn(value.bladeMetadata,'contentWeapon')&&blade,'Los datos del arma blanca no son válidos.');
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
export function weaponRecord(carrier,slot='primary'){
 const raw=slot==='blade'?carrier.blade:carrier.weapon,weapon=typeof raw==='object'?raw.id:raw;
 const definition=contentWeaponOf(carrier,slot);
 return {count:1,weapon,weight:definition?.weight??(FIREARMS[weapon]?4:1.3),loaded:slot==='primary'?(carrier.loaded??0):0,condition:slot==='primary'?(carrier.condition??100):(carrier.bladeCondition??100),jammed:slot==='primary'?Boolean(carrier.jammed):Boolean(carrier.bladeJammed),...(slot==='primary'&&carrier.reloadProgress!==undefined?{reloadProgress:carrier.reloadProgress}:{}),...(definition?{contentWeapon:structuredClone(definition)}:{})};
}
export function setWeaponDefinition(carrier,source,slot='primary'){
 const definition=contentWeaponOf(source);
 if(slot==='blade'){delete carrier.bladeMetadata;carrier.bladeCondition=source.condition??100;carrier.bladeJammed=Boolean(source.jammed);if(definition)carrier.bladeMetadata={contentWeapon:structuredClone(definition)};return;}
 delete carrier.contentWeapon;delete carrier.weaponMetadata;
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
