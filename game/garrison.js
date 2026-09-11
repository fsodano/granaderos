import {validMilitiaExperience,earnedMilitiaRank,promoteMilitia} from './militia-experience.js';
import {validatePersonalInventory} from './squads.js';
import {WEAPONS} from './data.js';
// Strategic militia become local tactical soldiers, never travelling mercenaries.
export const GARRISON_RANKS=[
 {name:'Cívico',maxHp:60,marksmanship:42,morale:45,agility:55,strength:55,weapon:1804,blade:1813},
 {name:'Montonero',maxHp:75,marksmanship:58,morale:65,agility:75,strength:70,weapon:1803,blade:1812},
 {name:'Veterano',maxHp:85,marksmanship:75,morale:85,agility:70,strength:75,weapon:1801,blade:1811},
];
export function prepareGarrison(s,sector){
 s.garrisons??={};s.nextMilitiaId??=20000;
 if(s.sectors[sector]?.owner!=='patriot')return [];
 const old=s.garrisons[sector]??[],next=[];let slots=60;
 for(let rank=0;rank<3;rank++){
  const count=Math.min(slots,s.sectors[sector].militia[rank]);slots-=count;
  const retained=old.filter(u=>u.militiaRank===rank&&u.hp>0).slice(0,count);next.push(...retained);
  for(let i=retained.length;i<count;i++){const stats=GARRISON_RANKS[rank],rounds=Math.min(6,s.resources.cartridges);s.resources.cartridges-=rounds;next.push({...stats,id:s.nextMilitiaId++,name:`${stats.name} de la guarnición`,hp:stats.maxHp,militia:true,militiaRank:rank,leadership:30+rank*15,wisdom:55,dexterity:55,medical:15,loaded:Math.min(1,rounds),ammo:Math.max(0,rounds-1),condition:85,priming:6,flints:0,rations:0,medkits:0,torches:0,boleadoras:rank===1?1:0,inventory:{},overwatch:true});}
 }
 // Keep transferred soldiers beyond the 60-person deployment limit as finite
 // reserves. Only a real reduction in rank strength releases surplus rounds.
 const reserve=[];
 for(let rank=0;rank<3;rank++){const count=Math.max(0,s.sectors[sector].militia[rank]-next.filter(u=>u.militiaRank===rank).length);reserve.push(...old.filter(u=>u.militiaRank===rank&&u.hp>0&&!next.some(v=>v.id===u.id)).slice(0,count));}
 for(const u of old)if(!next.some(v=>v.id===u.id)&&!reserve.some(v=>v.id===u.id))s.resources.cartridges+=(u.hp>0?(u.loaded??0)+(u.ammo??0):0);
 s.garrisons[sector]=[...next,...reserve];return structuredClone(next);
}
export function returnGarrison(s,request,snapshot,dispositions=[]){
 if(!request.garrison?.length)return;
 if(!snapshot)throw Error('El parte de la guarnición necesita el estado del sector.');
 const survivors=(s.garrisons?.[request.sector]??[]).filter(u=>!request.garrison.some(v=>String(v.id)===String(u.id)));
 for(const issued of request.garrison){
  const actual=snapshot.units.find(u=>u.side==='player'&&String(u.id)===String(issued.id)),entry=dispositions.find(e=>e.unitId===String(issued.id));
  if(!actual||!actual.militia||actual.militiaRank!==issued.militiaRank)throw Error('El parte de la guarnición es incompleto.');
  if(actual.hp<=0||entry&&['dispersed','departed'].includes(entry.kind))s.sectors[request.sector].militia[issued.militiaRank]=Math.max(0,s.sectors[request.sector].militia[issued.militiaRank]-1);
  if(actual.hp<=0||entry?.kind==='dispersed')continue;
  const promotedRank=earnedMilitiaRank(issued,actual);
  const record=promoteMilitia({...structuredClone(actual),id:issued.id},promotedRank);
  if(promotedRank!==issued.militiaRank){
   if(entry?.kind!=='departed'){s.sectors[request.sector].militia[issued.militiaRank]--;s.sectors[request.sector].militia[promotedRank]++;}
   s.log.unshift({hour:s.hour,text:`${record.name} asciende por experiencia de combate (${record.militiaExperience} puntos).`});s.log=s.log.slice(0,80);
  }
 delete record.departure;delete record.fled;record.routed=false;record.surrendered=false;
  if(entry?.kind==='departed'){
   if(!s.sectors[entry.sector]||s.sectors[entry.sector].owner!=='patriot')throw Error('La guarnición no puede llegar a ese sector.');
   record.entryReason='arrival';record.entryEdge=entry.departure.entryEdge;record.entryAnchor=structuredClone(entry.departure.entryAnchor);
   s.garrisons[entry.sector]??=[];s.garrisons[entry.sector].push(record);s.sectors[entry.sector].militia[promotedRank]++;
  }else {record.entryReason='resident';delete record.entryEdge;delete record.entryAnchor;survivors.push(record);}
 }
 s.garrisons??={};s.garrisons[request.sector]=survivors;
}
export function validGarrisons(s){
 if(!s.garrisons||typeof s.garrisons!=='object'||Array.isArray(s.garrisons)||!Number.isInteger(s.nextMilitiaId)||s.nextMilitiaId<20000||s.nextMilitiaId>1e9)return false;
 const ids=new Set();return Object.entries(s.garrisons).every(([sector,units])=>s.sectors[sector]&&Array.isArray(units)&&units.length<=1000&&units.every(u=>{if(!u||!validMilitiaExperience(u)||typeof u.name!=='string'||u.name.length>100||!Number.isInteger(u.weapon)||u.weapon<0||u.weapon>65535||u.blade!==undefined&&(!Number.isInteger(u.blade)||u.blade<0||u.blade>65535)||!Number.isFinite(u.condition)||u.condition<0||u.condition>100||!Number.isInteger(u.maxHp)||u.maxHp<1||u.maxHp>100||!Number.isInteger(u.id)||u.id<20000||u.id>=s.nextMilitiaId||ids.has(u.id)||!Number.isInteger(u.militiaRank)||u.militiaRank<0||u.militiaRank>2||u.militia!==true||!Number.isFinite(u.hp)||u.hp<=0||u.hp>u.maxHp||(u.loaded??0)>(WEAPONS[u.weapon]?.capacity??0))return false;ids.add(u.id);validatePersonalInventory(u.inventory??{});return ['ammo','loaded','priming','flints','rations','torches','medkits','boleadoras'].every(k=>Number.isInteger(u[k]??0)&&(u[k]??0)>=0&&(u[k]??0)<=100000);}));
}

export function reserveMilitiaTrainees(s,sector,rank,count){
 const deployed=new Set((s.pendingBattle?.garrison??[]).map(u=>String(u.id)));
 prepareGarrison(s,sector);
 const trainees=(s.garrisons[sector]??[]).filter(u=>u.militiaRank===rank-1&&u.hp>=15&&!u.bleeding&&!u.unconscious&&!u.routed&&!u.surrendered&&(u.energy??100)>10&&!deployed.has(String(u.id))).slice(0,count);
 if(trainees.length!==count)throw Error('La promoción necesita milicianos estables, presentes y fuera del despliegue.');
 const ids=new Set(trainees.map(u=>u.id));s.garrisons[sector]=s.garrisons[sector].filter(u=>!ids.has(u.id));
 return structuredClone(trainees);
}
export function returnMilitiaTrainees(s,course,completed=false){
 if(course.rank===0||s.sectors[course.sector].owner!=='patriot')return;
 const rank=completed?course.rank:course.rank-1;
 s.sectors[course.sector].militia[rank]+=course.count;
 if(course.trainees){s.garrisons[course.sector]??=[];s.garrisons[course.sector].push(...course.trainees.map(u=>promoteMilitia(structuredClone(u),rank)));}
}
export function validMilitiaTrainees(s,course){
 if(course.trainees===undefined)return true; // Previously paid courses had counts only.
 return course.rank>0&&Array.isArray(course.trainees)&&course.trainees.length===course.count&&course.trainees.every(u=>u.militiaRank===course.rank-1)&&validGarrisons({...s,garrisons:{[course.sector]:course.trainees}})&&course.trainees.every(u=>!Object.values(s.garrisons??{}).some(units=>units.some(v=>v.id===u.id)));
}
