import {validatePersonalInventory} from './squads.js';
// Strategic militia become local tactical soldiers, never travelling mercenaries.
export const GARRISON_RANKS=[
 {name:'Cívico',maxHp:60,marksmanship:42,morale:45,agility:55,strength:55,weapon:1804,blade:1813},
 {name:'Montonero',maxHp:75,marksmanship:58,morale:65,agility:75,strength:70,weapon:1803,blade:1812},
 {name:'Soldado de línea',maxHp:85,marksmanship:75,morale:85,agility:70,strength:75,weapon:1801,blade:1811},
];
export function prepareGarrison(s,sector){
 s.garrisons??={};s.nextMilitiaId??=20000;
 if(s.sectors[sector]?.owner!=='patriot')return [];
 const old=s.garrisons[sector]??[],next=[];let slots=60;
 for(let rank=0;rank<3;rank++){
  const count=Math.min(slots,s.sectors[sector].militia[rank]);slots-=count;
  const retained=old.filter(u=>u.militiaRank===rank&&u.hp>0).slice(0,count);next.push(...retained);
  for(let i=retained.length;i<count;i++){const stats=GARRISON_RANKS[rank],rounds=6;next.push({...stats,id:s.nextMilitiaId++,name:`${stats.name} de la guarnición`,hp:stats.maxHp,militia:true,militiaRank:rank,leadership:30+rank*15,wisdom:55,dexterity:55,medical:15,loaded:Math.min(1,rounds),ammo:Math.max(0,rounds-1),condition:85,priming:6,flints:0,rations:0,medkits:0,torches:0,boleadoras:rank===1?1:0,inventory:{},overwatch:true});}
 }
 // Training fees include the garrison kit; existing soldiers keep their remaining ammunition.
 s.garrisons[sector]=next;return structuredClone(next);
}
export function returnGarrison(s,request,snapshot){
 if(!request.garrison?.length)return;
 if(!snapshot)throw Error('El parte de la guarnición necesita el estado del sector.');
 const survivors=[];
 for(const issued of request.garrison){const actual=snapshot.units.find(u=>u.side==='player'&&String(u.id)===String(issued.id));if(!actual||!actual.militia||actual.militiaRank!==issued.militiaRank)throw Error('El parte de la guarnición es incompleto.');if(actual.hp<=0){s.sectors[request.sector].militia[issued.militiaRank]=Math.max(0,s.sectors[request.sector].militia[issued.militiaRank]-1);continue;}survivors.push({...structuredClone(actual),id:issued.id});}
 s.garrisons??={};s.garrisons[request.sector]=survivors;
}
export function validGarrisons(s){
 if(!s.garrisons||typeof s.garrisons!=='object'||Array.isArray(s.garrisons)||!Number.isInteger(s.nextMilitiaId)||s.nextMilitiaId<20000||s.nextMilitiaId>1e9)return false;
 const ids=new Set();return Object.entries(s.garrisons).every(([sector,units])=>s.sectors[sector]&&Array.isArray(units)&&units.length<=60&&units.every(u=>{if(!u||typeof u.name!=='string'||u.name.length>100||!Number.isInteger(u.weapon)||u.weapon<1800||u.weapon>1813||!Number.isInteger(u.blade)||u.blade<1809||u.blade>1813||!Number.isFinite(u.condition)||u.condition<0||u.condition>100||!Number.isInteger(u.maxHp)||u.maxHp<1||u.maxHp>100||!Number.isInteger(u.id)||u.id<20000||u.id>=s.nextMilitiaId||ids.has(u.id)||!Number.isInteger(u.militiaRank)||u.militiaRank<0||u.militiaRank>2||u.militia!==true||!Number.isFinite(u.hp)||u.hp<=0||u.hp>100)return false;ids.add(u.id);validatePersonalInventory(u.inventory??{});return ['ammo','loaded','priming','flints','rations','torches','medkits','boleadoras'].every(k=>Number.isInteger(u[k]??0)&&(u[k]??0)>=0&&(u[k]??0)<=100000);}));
}
