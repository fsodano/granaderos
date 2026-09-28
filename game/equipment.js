import {artilleryProfile} from './artillery-definitions.js';
import {importRulesFor,importPortName,importDelayReason} from './campaign-imports.js';
import {compileWeaponDefinition} from './weapon-definition.js';
import {usesAuthoredEquipment,equipmentKey,addArmoryStock} from './armory-items.js';
import {WEAPONS} from './data.js';
export const EQUIPMENT_CATALOG=[
 ...Object.values(WEAPONS).filter(w=>w.id>=1800&&w.id<=1813).map(w=>({...w,item:w.id,category:w.id<1809?'firearm':'blade',price:({1800:240,1801:230,1802:420,1803:180,1804:100,1805:130,1806:180,1807:160,1808:220,1809:160,1810:110,1811:50,1812:70,1813:40})[w.id]})),
 {item:'bronze4',id:1820,name:'Cañón de bronce de 4 libras',category:'artillery',price:700,crew:2},
 {item:'field8',id:1821,name:'Cañón de campaña de 8 libras',category:'artillery',price:1100,crew:3},
 {item:'swivel',id:1822,name:'Pedrero de regala',category:'artillery',price:400,crew:1},
];
export function equipmentCatalog(s){
 const catalog=EQUIPMENT_CATALOG.map(w=>w.category==='artillery'?{...w,...(s.contentCampaign?.package.artilleryProfiles?artilleryProfile(s,w.item):{}),art:artilleryProfile(s,w.item).art}:w);
 if(!usesAuthoredEquipment(s))return catalog;
 return [...s.contentCampaign.package.weapons.map(w=>{const contentWeapon=compileWeaponDefinition(w);return {...contentWeapon,id:w.template,item:w.id,stockKey:w.id,category:w.template<1809?'firearm':'blade',contentWeapon};}),...catalog.filter(w=>w.category!=='firearm'&&!s.contentCampaign.package.weapons.some(authored=>authored.template===w.id))];
}
export function armoryInventory(s){return equipmentCatalog(s).map(item=>({...item,quantity:s.armory?.[item.stockKey??item.item]??0}));}
export function armoryOptions(s,op,slot){
 if(!usesAuthoredEquipment(s))return EQUIPMENT_CATALOG.filter(w=>typeof w.item==='number'&&(slot==='weapon'||w.category==='blade')&&(w.item===op[slot]||(s.armory?.[w.item]??0)>0)).map(w=>({...w,key:String(w.item),equipped:w.item===op[slot]}));
 return s.armoryItems.filter(i=>slot==='weapon'||i.weapon>=1809).map(i=>({key:i.id,item:equipmentKey(i),instanceId:i.id,name:i.contentWeapon?.name??WEAPONS[i.weapon].name,condition:i.condition}));
}
export function needsResupply(record){return [['priming',50],['flints',4],['rations',2],['torches',2],['medkits',2]].some(([key,target])=>(record[key]??target)<target);}
export function refillCost(record,dressingPrice=10){return Math.ceil(Math.max(0,50-(record.priming??50))*.4+Math.max(0,4-(record.flints??4))*8+Math.max(0,2-(record.rations??2))*10+Math.max(0,2-(record.torches??2))*8+Math.max(0,2-(record.medkits??2))*dressingPrice);}
export function firearmRepairCost(record){return Math.ceil(Math.max(0,100-(record.condition??100))*1.5);}
export function artillerySelectionReason(s,types){
 if(!Array.isArray(types)||types.length>3||!types.every(type=>['bronze4','field8','swivel'].includes(type)))return 'Seleccioná hasta tres piezas de artillería.';
 for(const type of ['bronze4','field8','swivel'])if(types.filter(t=>t===type).length>(s.armory?.[type]??0))return 'No disponés de tantas piezas de ese modelo.';
 return null;
}
export function deployedArtillery(s){
 const available={...s.armory},types=[];
 const chosen=s.artillerySelectionExplicit||s.artillerySelection?.length?s.artillerySelection??[]:['field8','swivel','bronze4'].flatMap(type=>Array.from({length:Math.min(3,available[type]??0)},()=>type));
 for(const type of chosen)if(types.length<3&&(available[type]??0)>0){types.push(type);available[type]--;}
 return types.map((type,i)=>({id:`gun-${i}`,type,side:'player',loaded:artilleryProfile(s,type).initialLoaded,ammo:artilleryProfile(s,type).initialAmmo}));
}

export function isImportedEquipment(item){return [1800,1802].includes(Number(item?.contentWeapon?.template??item?.item));}
export function deliverEquipmentShipments(s){
 s.equipmentShipments??=[];
 if(importDelayReason(s))return;
 for(const shipment of [...s.equipmentShipments])if(shipment.due<=s.hour){const item=equipmentCatalog(s).find(w=>String(w.item)===String(shipment.item));if(!item)throw Error('El pedido de armas ya no corresponde al catálogo.');addArmoryStock(s,item,shipment.quantity);s.equipmentShipments.splice(s.equipmentShipments.indexOf(shipment),1);s.log.unshift({hour:s.hour,text:`Arriban a ${importPortName(s)} ${shipment.quantity} armas importadas para la sala de armas.`});s.log=s.log.slice(0,80);}
}
export function validEquipmentShipments(s){return Array.isArray(s.equipmentShipments)&&s.equipmentShipments.length<=1000&&(importRulesFor(s).port!==null||s.equipmentShipments.length===0)&&s.equipmentShipments.every(q=>q&&isImportedEquipment(equipmentCatalog(s).find(w=>String(w.item)===String(q.item)))&&Number.isInteger(q.quantity)&&q.quantity>0&&q.quantity<=100&&Number.isInteger(q.due)&&q.due>=0&&q.due<=1e9);}
