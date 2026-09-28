import {validMilitiaArrival} from './militia-arrival.js';
import {militiaProgression} from './militia-progression-rules.js';
import {validMilitiaExperience,earnedMilitiaRank,promoteMilitia} from './militia-experience.js';
import {strategicBleedingPercent} from './campaign-care-rules.js';
import {refreshMilitaryCondition} from './actor-condition.js';
import {campaignRules} from './campaign-rules.js';
import {authoredForceEquipment,MILITIA_EQUIPMENT_ROLES,validateForceWeapon} from './content-force-equipment.js';
import {weaponSpecification} from './weapon-definition.js';
import {validatePersonalInventory} from './squads.js';
// Strategic militia become local tactical soldiers, never travelling mercenaries.
export const GARRISON_RANKS=[
 {name:'Cívico',maxHp:60,marksmanship:42,morale:45,agility:55,strength:55,weapon:1804,blade:1813},
 {name:'Montonero',maxHp:75,marksmanship:58,morale:65,agility:75,strength:70,weapon:1803,blade:1812},
 {name:'Soldado de línea',maxHp:85,marksmanship:75,morale:85,agility:70,strength:75,weapon:1801,blade:1811},
];
function newGarrisonMember(s,rank){const stats=GARRISON_RANKS[rank],rounds=campaignRules(s).militiaCartridges;return authoredForceEquipment(s,'militiaEquipment',MILITIA_EQUIPMENT_ROLES[rank],{...stats,id:s.nextMilitiaId++,name:`${stats.name} de la guarnición`,hp:stats.maxHp,militia:true,militiaRank:rank,leadership:30+rank*15,wisdom:55,dexterity:55,medical:15,loaded:Math.min(1,rounds),ammo:Math.max(0,rounds-1),condition:85,priming:6,flints:0,rations:0,medkits:0,torches:0,boleadoras:rank===1?1:0,inventory:{},overwatch:true},rounds);}
export function materializeGarrisonRank(s,sector,rank,count){
 if(s.sectors[sector]?.owner!=='patriot'||![0,1,2].includes(rank)||!Number.isInteger(count)||count<0||count>s.sectors[sector].militia[rank])throw Error('La guarnición no tiene esos defensores.');
 s.garrisons??={};s.nextMilitiaId??=20000;s.garrisons[sector]??=[];
 const existing=s.garrisons[sector].filter(u=>u.hp>0&&u.militiaRank===rank).length;
 for(let i=existing;i<count;i++)s.garrisons[sector].push(newGarrisonMember(s,rank));
}
export function prepareGarrison(s,sector){
 s.garrisons??={};s.nextMilitiaId??=20000;
 if(s.sectors[sector]?.owner!=='patriot')return [];
 const old=s.garrisons[sector]??[],next=[];let slots=60;
 for(let rank=0;rank<3;rank++){
  const count=Math.min(slots,s.sectors[sector].militia[rank]);slots-=count;
  const retained=old.filter(u=>u.militiaRank===rank&&u.hp>0).slice(0,count);next.push(...retained);
  for(let i=retained.length;i<count;i++)next.push(newGarrisonMember(s,rank));
 }
 // Training fees include the garrison kit; existing soldiers keep their remaining ammunition.
 s.garrisons[sector]=next;return structuredClone(next);
}
export function returnGarrison(s,request,snapshot){
 if(!request.garrison?.length)return;
 if(!snapshot)throw Error('El parte de la guarnición necesita el estado del sector.');
 const survivors=[];
 for(const issued of request.garrison){const actual=snapshot.units.find(u=>u.side==='player'&&String(u.id)===String(issued.id));if(!actual||!actual.militia||actual.militiaRank!==issued.militiaRank)throw Error('El parte de la guarnición es incompleto.');if(actual.hp<=0){s.sectors[request.sector].militia[issued.militiaRank]=Math.max(0,s.sectors[request.sector].militia[issued.militiaRank]-1);continue;}const rank=earnedMilitiaRank(issued,actual,militiaProgression(s)),record=promoteMilitia({...structuredClone(actual),id:issued.id},rank,militiaProgression(s));if(rank!==issued.militiaRank){s.sectors[request.sector].militia[issued.militiaRank]--;s.sectors[request.sector].militia[rank]++;s.log.unshift({hour:s.hour,text:`${record.name} asciende por experiencia de combate (${record.militiaExperience} puntos).`});s.log=s.log.slice(0,80);}survivors.push(record);}
 const issuedIds=new Set(request.garrison.map(u=>u.id));
 s.garrisons??={};s.garrisons[request.sector]=[...(s.garrisons[request.sector]??[]).filter(u=>!issuedIds.has(u.id)),...survivors];
}
// Only existing local soldiers need care. Querying patients must not generate
// another cohort or issue its starting equipment.
export function militiaCarePatients(s,sector){
 if(s.sectors[sector]?.owner!=='patriot'||s.pendingBattle?.sector===sector&&!s.pendingBattle.sceneId)return [];
 return (s.garrisons?.[sector]??[]).filter(u=>u.hp>0&&(u.bleeding>0||u.hp<u.maxHp)).sort((a,b)=>Number(b.bleeding>0)-Number(a.bleeding>0)||a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id);
}
function validCareCondition(u){
 return u.hp<=u.maxHp&&(u.bleeding===undefined||Number.isInteger(u.bleeding)&&u.bleeding>=0&&u.bleeding<=10)
  &&(u.bandaged===undefined||Number.isFinite(u.bandaged)&&u.bandaged>=0&&u.bandaged<=u.maxHp-u.hp)
  &&['energy','fatigue'].every(k=>u[k]===undefined||Number.isFinite(u[k])&&u[k]>=0&&u[k]<=100);
}
export function validGarrisons(s){
 if(!s.garrisons||typeof s.garrisons!=='object'||Array.isArray(s.garrisons)||!Number.isInteger(s.nextMilitiaId)||s.nextMilitiaId<20000||s.nextMilitiaId>1e9)return false;
 const ids=new Set();return Object.entries(s.garrisons).every(([sector,units])=>s.sectors[sector]&&Array.isArray(units)&&units.length<=60&&units.every(u=>{if(!u||!validMilitiaArrival(u,sector)||!validMilitiaExperience(u)||typeof u.name!=='string'||u.name.length>100||!Number.isInteger(u.weapon)||(u.weapon!==0&&(u.weapon<1800||u.weapon>1813))||!Number.isInteger(u.blade)||u.blade<1809||u.blade>1813||!Number.isFinite(u.condition)||u.condition<0||u.condition>100||!Number.isInteger(u.maxHp)||u.maxHp<1||u.maxHp>100||!Number.isInteger(u.id)||u.id<20000||u.id>=s.nextMilitiaId||ids.has(u.id)||!Number.isInteger(u.militiaRank)||u.militiaRank<0||u.militiaRank>2||u.militia!==true||!Number.isFinite(u.hp)||u.hp<=0||u.hp>100||!validCareCondition(u))return false;ids.add(u.id);validateForceWeapon(u);if((u.loaded??0)>(weaponSpecification(u)?.capacity??0))return false;validatePersonalInventory(u.inventory??{});return ['ammo','loaded','priming','flints','rations','torches','medkits','boleadoras'].every(k=>Number.isInteger(u[k]??0)&&(u[k]??0)>=0&&(u[k]??0)<=100000);}));
}

// A paid promotion reserves actual stable soldiers. Their equipment and wounds
// belong to them throughout the course, not to a replacement rank template.
function availableTrainees(s,sector,rank){
 const deployed=new Set((s.pendingBattle?.garrison??[]).map(u=>String(u.id)));
 return (s.garrisons?.[sector]??[]).filter(u=>u.militiaRank===rank-1&&u.hp>=15&&!u.bleeding&&!u.unconscious&&!u.routed&&(u.energy??100)>10&&!deployed.has(String(u.id)));
}
export function militiaPromotionStatus(s,sector,rank,count=3){
 const existing=(s.garrisons?.[sector]??[]).filter(u=>u.militiaRank===rank-1&&u.hp>0).length;
 const unissued=Math.max(0,(s.sectors[sector]?.militia[rank-1]??0)-existing);
 const available=availableTrainees(s,sector,rank).length+unissued;
 return {available,ready:available>=count,reason:`La promoción necesita ${count} milicianos estables, presentes y fuera del despliegue. Disponibles: ${available}.`};
}
export function reserveMilitiaTrainees(s,sector,rank,count){
 prepareGarrison(s,sector);
 const trainees=availableTrainees(s,sector,rank).slice(0,count);
 if(trainees.length!==count)throw Error(militiaPromotionStatus(s,sector,rank,count).reason);
 const ids=new Set(trainees.map(u=>u.id));s.garrisons[sector]=s.garrisons[sector].filter(u=>!ids.has(u.id));
 return structuredClone(trainees);
}
export function returnMilitiaTrainees(s,course,completed=false){
 if(course.rank===0||s.sectors[course.sector].owner!=='patriot')return;
 const rank=completed?course.rank:course.rank-1;s.sectors[course.sector].militia[rank]+=course.count;
 if(course.trainees){s.garrisons[course.sector]??=[];s.garrisons[course.sector].push(...course.trainees.map(u=>promoteMilitia(structuredClone(u),rank,militiaProgression(s))));}
}
export function validMilitiaTrainees(s,course){
 if(course.trainees===undefined)return true; // Earlier paid courses kept counts only.
 return course.rank>0&&Array.isArray(course.trainees)&&course.trainees.length===course.count&&course.trainees.every(u=>u&&u.militiaRank===course.rank-1)
  &&validGarrisons({...s,garrisons:{[course.sector]:course.trainees}})
  &&course.trainees.every(u=>!Object.values(s.garrisons??{}).some(units=>units.some(v=>v.id===u.id))&&!s.pendingBattle?.garrison?.some(v=>String(v.id)===String(u.id)));
}

// Use the campaign's hourly wound rule only for retained, unloaded defenders.
// New cohorts have no wound, and the loaded scene owns its own tactical clock.
export const militiaWoundLoss=(s,unit)=>Math.ceil((unit.bleeding??0)*strategicBleedingPercent(s)/100);
export function advanceMilitiaWounds(s){
 const deaths=[],deployed=new Set((s.pendingBattle?.garrison??[]).map(u=>String(u.id)));
 for(const [sector,units] of Object.entries(s.garrisons??{})){
  if(s.sectors[sector]?.owner!=='patriot')continue;
  for(const unit of units){
   if(unit.hp<=0||!unit.bleeding||deployed.has(String(unit.id)))continue;
   unit.hp=Math.max(0,unit.hp-militiaWoundLoss(s,unit));refreshMilitaryCondition(unit);
   if(unit.hp>0)continue;
   unit.energy=0;unit.deathMinute=s.hour*60+Math.floor((s.secondOfHour??0)/60);
   const prior=s.sectorStates?.[sector]?.units?.find(u=>u.militia&&String(u.id)===String(unit.id));
   // Real wounds came from a saved visit. Old records without a scene do not
   // supply a position from which a physical corpse could safely be invented.
   if(prior){const {id,x,y}=prior;Object.assign(prior,structuredClone(unit),{id,x,y});}
   s.sectors[sector].militia[unit.militiaRank]=Math.max(0,s.sectors[sector].militia[unit.militiaRank]-1);
   deaths.push({id:unit.id,name:unit.name,sector});
  }
  s.garrisons[sector]=units.filter(u=>u.hp>0);
 }
 return deaths;
}
