import {WEAPONS} from './data.js';
export const EQUIPMENT_CATALOG=[
 ...Object.values(WEAPONS).filter(w=>w.id>=1800&&w.id<=1813).map(w=>({...w,item:w.id,category:w.id<1809?'firearm':'blade',price:({1800:240,1801:230,1802:420,1803:180,1804:100,1805:130,1806:180,1807:160,1808:220,1809:160,1810:110,1811:50,1812:70,1813:40})[w.id]})),
 {item:'bronze4',id:1820,name:'Cañón de bronce de 4 libras',category:'artillery',price:700,crew:2},
 {item:'field8',id:1821,name:'Cañón de campaña de 8 libras',category:'artillery',price:1100,crew:3},
 {item:'swivel',id:1822,name:'Pedrero de regala',category:'artillery',price:400,crew:1},
];
export function armoryInventory(s){return EQUIPMENT_CATALOG.map(item=>({...item,quantity:s.armory?.[item.item]??0}));}
export function refillCost(record){return Math.ceil(Math.max(0,50-(record.priming??50))*.4+Math.max(0,4-(record.flints??4))*8+Math.max(0,2-(record.rations??2))*10+Math.max(0,2-(record.torches??2))*8);}
export function firearmRepairCost(record){return Math.ceil(Math.max(0,100-(record.condition??100))*1.5);}
export function deployedArtillery(s){
 if(s.artillerySelection?.length)return s.artillerySelection.slice(0,Math.min(3,s.resources.cannons+(s.depots?.[s.location]?.cannons??0))).map((type,i)=>({id:`gun-${i}`,type,side:'player',loaded:true,ammo:6}));
 const available=s.resources.cannons+(s.depots?.[s.location]?.cannons??0),types=[];
 // Foundry products and pre-armory saves remain the bronze4 baseline.
 for(const type of ['field8','swivel','bronze4'])for(let i=0;i<(s.armory?.[type]??0)&&types.length<available&&types.length<3;i++)types.push(type);
 while(types.length<Math.min(available,3))types.push('bronze4');
 return types.map((type,i)=>({id:`gun-${i}`,type,side:'player',loaded:true,ammo:6}));
}
