import {AMMUNITION_TYPES} from './ammunition-types.js';
import {weaponItemWeight} from './weapon-fittings.js';
import {REPAIR_KIT_WEIGHT,REPAIR_KIT_POINTS} from './repair-materials.js';

// Authored, one-time equipment caches. These are finite game balance amounts,
// not historical inventories. Sector reentry restores saved container contents.
const ammo=(type,count)=>({item:`inventory:ammo:${type}`,kind:'ammunition',ammoType:type,name:AMMUNITION_TYPES[type].name,count,weight:.04});
const gun=(sector,weapon,index)=>({item:'weapon',weapon,count:1,weight:weaponItemWeight(weapon),loaded:0,condition:100,jammed:false,instanceId:`cache:${sector}:gun:${index}`});
const kit=sector=>({item:`inventory:repair-kit:${sector}`,kind:'repair-kit',name:'Juego de herramientas',count:1,weight:REPAIR_KIT_WEIGHT,repairPoints:REPAIR_KIT_POINTS,instanceId:`cache:${sector}:repair-kit`});
export const FINITE_SECTOR_CACHES=Object.freeze({
 retiro:{chest:'retiro:armory-cache',guns:[1800,1801,1803],musket:120,rifle:40,pistol:20,shot:20,medical:12},
 buenos_aires:{chest:'buenos_aires:building:chest:10:4',guns:[1800],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 ensenada:{chest:'ensenada:building:chest:9:4',guns:[1801],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 cordoba:{chest:'cordoba:building:chest:17:1',guns:[1800],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 santa_fe:{chest:'santa_fe:building:chest:15:13',guns:[1801],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 tucuman:{chest:'tucuman:building:chest:14:7',guns:[1800],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 salta:{chest:'salta:building:chest:16:13',guns:[1801],musket:60,rifle:40,pistol:20,shot:20,medical:12},
 jujuy:{chest:'jujuy:building:chest:9:5',guns:[1800],musket:60,rifle:40,pistol:20,shot:20,medical:12},
});
export function finiteSectorCache(sector,map){
 const cache=FINITE_SECTOR_CACHES[sector];
 if(!cache||(map.props??[]).every(prop=>prop.type!=='chest'||prop.id!==cache.chest))return null;
 return {id:cache.chest,type:'chest',open:false,locked:false,contents:[
  ...cache.guns.map((weapon,index)=>gun(sector,weapon,index)),
  ammo('musket_75',cache.musket),ammo('rifle_62',cache.rifle),ammo('pistol_69',cache.pistol),ammo('shot_16',cache.shot),
  {item:'medkits',count:cache.medical,weight:.2},kit(sector),
 ]};
}
