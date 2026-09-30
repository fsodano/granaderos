import {WEAPONS} from './data.js';
import {artilleryProfile} from './artillery-definitions.js';
import {compileWeaponDefinition,contentWeaponOf,weaponSpecification} from './weapon-definition.js';
import {fittingLabel} from './weapon-fittings.js';

export const usesAuthoredEquipment=s=>['character-weapons-v2','character-presence-v1'].includes(s?.contentCampaign?.adapter);
export const EQUIPMENT_CATALOG=[
 ...Object.values(WEAPONS).filter(w=>w.id>=1800&&w.id<=1813).map(w=>({...w,item:w.id,stockKey:String(w.id),category:w.id<1809?'firearm':'blade',price:weaponSpecification(w.id).price})),
 {...WEAPONS[1811],item:1811,stockKey:'1811:india_socket',fittingPattern:'india_socket',name:fittingLabel('india_socket'),category:'blade',price:50},
 {item:'bronze4',id:1820,name:'Cañón de bronce de 4 libras',category:'artillery',price:700,crew:2},
 {item:'field8',id:1821,name:'Cañón de campaña de 8 libras',category:'artillery',price:1100,crew:3},
 {item:'swivel',id:1822,name:'Pedrero de regala',category:'artillery',price:400,crew:1},
];
// Stored objects use itemMetadata; carried objects use weaponMetadata. Both
// refer to the same authored definition and the same stock key.
export function equipmentKey(value){
 const definition=contentWeaponOf(value)??value?.itemMetadata?.contentWeapon;
 if(definition)return definition.id;
 if(value?.stockKey!==undefined)return String(value.stockKey);
 const item=value?.weapon??value?.item??value;
 return value?.fittingPattern?`${item}:${value.fittingPattern}`:String(item);
}
export function equipmentCatalog(s){
 const catalog=EQUIPMENT_CATALOG.map(w=>w.category==='artillery'?{...w,...(s?.contentCampaign?.package.artilleryProfiles?artilleryProfile(s,w.item):{}),art:artilleryProfile(s??{},w.item).art}:w);
 if(!usesAuthoredEquipment(s))return catalog;
 const authored=s.contentCampaign.package.weapons;
 return [...authored.map(w=>{const contentWeapon=compileWeaponDefinition(w);return {...contentWeapon,id:w.template,item:w.id,stockKey:w.id,category:w.template<1809?'firearm':'blade',contentWeapon};}),...catalog.filter(w=>w.category!=='firearm'&&(w.fittingPattern||!authored.some(a=>a.template===w.id)))];
}
export function equipmentCatalogItem(key,s){return (s?equipmentCatalog(s):EQUIPMENT_CATALOG).find(w=>String(w.stockKey??w.item)===String(key));}
export function equipmentLabel(record){
 return (contentWeaponOf(record)??record?.itemMetadata?.contentWeapon)?.name??equipmentCatalogItem(equipmentKey(record))?.name??'Equipo desconocido';
}
export function armoryInventory(s){
 return equipmentCatalog(s).map(item=>({...item,stockKey:equipmentKey(item),quantity:item.category==='artillery'?s.armory?.[item.item]??0:(s.armoryItems??[]).filter(record=>equipmentKey(record)===equipmentKey(item)).length}));
}
export const isImportedEquipment=item=>[1800,1802].includes(Number(item?.contentWeapon?.template??item?.itemMetadata?.contentWeapon?.template??item?.item));
