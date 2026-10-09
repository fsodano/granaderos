import {routeHiringCeiling} from './funded-route-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {attendYatasto} from './mission-helpers.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {operativeInTransit} from '../game/squads.js';
import {doctorRate} from '../game/medical-care.js';

// Reinforce and position the real survivors before the arriving counterattack.
export function prepareHiredNorthernDefense(start){
 let c=structuredClone(start);
 const order=a=>{if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null);c=n;}}const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;};
 const defendNow=()=>{assert.equal(c.pendingEncounter?.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});return c;};
 if(c.pendingEncounter)return defendNow();

// Keep the actual hired force; local officers are not unlocked yet.

const candidates=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&contractQuote(c,o,'week').price<=routeHiringCeiling(c,200)).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(o=>o.id);
for(const id of candidates)order({type:'recruitCivic',id,term:'week',destination:'cordoba'});
const until=c.hour+6;for(let h=0;c.hour<until&&!c.pendingEncounter&&h<20;h++)order({type:'wait',hours:1});
// An actual arrival ends preparation. Fight with whoever reached the province;
// outstanding paid hires cannot be granted their remaining travel time early.
if(c.pendingEncounter)return defendNow();
const field=rosterFor(c).filter(o=>c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].location==='cordoba').sort((a,b)=>b.marksmanship-a.marksmanship).map(o=>o.id),groups=[];
for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),name:'Defensa de Córdoba',sector:'cordoba'});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:groups[0]});let p=visit(c),b=p.battle;
const cells=b.upperSurfaces.filter(t=>!t.blocked).sort((a,d)=>Math.hypot(a.x-b.width*.5,a.y-b.height*.5)-Math.hypot(d.x-b.width*.5,d.y-b.height*.5)||a.y-d.y||a.x-d.x);
const act=a=>{b=actBattle(b,a);assert.equal(b.lastError,null,JSON.stringify(a)+b.lastError);};
for(const id of c.squad){let u=b.units.find(u=>u.id===String(id));act({type:'movement',unitId:u.id,movement:'walk'});u=b.units.find(u=>u.id===String(id));const dest=cells.find(p=>!b.units.some(v=>v.id!==u.id&&v.hp>0&&sameCell(v,p))&&getReachable(b,u,{stopAt:cell=>sameCell(cell,p)}).length);assert.ok(dest);act({type:'move',unitId:u.id,...spacePoint(dest)});act({type:'stance',unitId:u.id,stance:'crouched'});}
c=leave(sync({campaign:p.campaign,battle:b}));
order({type:'fortify',sector:'cordoba'});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;!c.pendingEncounter&&h<144;h++)order({type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');
order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 return c;
}

// The rear clinic and envoy use existing stock, real paid arrivals and one
// conquered gun. Care continues while the officers and cannon travel.
export function prepareNorthernOfficerRelief(start,{report=()=>{},onCheckpoint=()=>{}}={}){
 const before=structuredClone(start);let c=decodeSave(encodeSave(start)).campaign;
 onCheckpoint('northern-officer-relief-input',c);
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const at=id=>c.operativeState[id].location;
 const doctors=new Map(),patients=live().filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const order=a=>{
  if(a.type==='assignCare'&&c.operativeState[a.operativeId].assignment===a.assignment)return;
  if(a.type==='wait')for(const id of live()){
   const q=c.contracts[id];
   if(contractExpiresSeconds(q)!==null&&contractExpiresSeconds(q)<=c.hour*3600+(c.secondOfHour??0)+a.hours*3600){
    const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
    const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt,expectedExpiresSecond:q.expiresSecond??0});assert.equal(n.lastError,null);assert.equal(n.resources.treasury,cash-quote.price);c=n;
   }
  }
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 const localPatients=sector=>patients.filter(id=>at(id)===sector&&(c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding));
 const takeKnown=(id,wanted)=>{
  for(let taken=0;taken<wanted;){
   const row=sectorInventoryModel(c,at(id),rosterFor(c),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');if(!row)break;
   const count=Math.min(row.count,wanted-taken),before=c.operativeState[id].medkits;
   order({type:'sectorInventory',sector:at(id),operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.operativeState[id].medkits,before+count);taken+=count;
   report({event:'provincialClinicRecovery',id,sector:at(id),source:row.key,count,hour:c.hour,second:c.secondOfHour??0});
  }
 };
 const maintainClinics=()=>{
  for(const [sector,id]of doctors){
   const wounded=localPatients(sector);
   if(!wounded.length){order({type:'assignCare',operativeId:id,assignment:'rest'});for(const patient of patients.filter(other=>at(other)===sector))order({type:'assignCare',operativeId:patient,assignment:'rest'});continue;}
   if(!c.operativeState[id].medkits)takeKnown(id,1);
   if(c.operativeState[id].medkits)order({type:'assignCare',operativeId:id,assignment:'doctor'});
   for(const patient of wounded)order({type:'assignCare',operativeId:patient,assignment:'patient'});
  }
 };
 for(const id of live())order({type:'assignCare',operativeId:id,assignment:patients.includes(id)?'patient':'rest'});
 const booked=[];
 for(const sector of [...new Set(patients.map(at))]){
  const local=rosterFor(c).filter(op=>live().includes(op.id)&&at(op.id)===sector&&op.medical>=70&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical)[0];
  if(local){doctors.set(sector,local.id);takeKnown(local.id,8);continue;}
  const recruit=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&!c.hiringArrivals.some(row=>row.operativeId===op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&op.medical>=70&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=routeHiringCeiling(c,200)).sort((a,b)=>Number(b.id===139)-Number(a.id===139)||b.medical-a.medical||a.id-b.id)[0];
  assert.ok(recruit,'a real available paid doctor must reach the rear casualty');
  const quote=contractQuote(c,recruit,'week'),cash=c.resources.treasury;order({type:'recruitCivic',id:recruit.id,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.price);
  const arrival=c.hiringArrivals.find(row=>row.operativeId===recruit.id);assert.ok(arrival);assert.ok(!c.recruited.includes(recruit.id));booked.push({id:recruit.id,sector,arrival:structuredClone(arrival),quote});
  report({event:'provincialClinicBooked',id:recruit.id,sector,quote,arrival:structuredClone(arrival)});
 }
 maintainClinics();
 for(let hour=0;booked.some(row=>!c.recruited.includes(row.id))&&hour<24;hour++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});maintainClinics();
  for(const row of booked)if(c.recruited.includes(row.id)&&!doctors.has(row.sector)){
   assert.equal(at(row.id),row.sector);assert.equal(c.contracts[row.id].started,row.arrival.dueAt);doctors.set(row.sector,row.id);maintainClinics();
  }
  for(const id of patients)assert.ok(c.operativeState[id].alive,'the actual wounded veteran must survive the paid doctor arrival');
 }
 assert.ok(booked.every(row=>c.recruited.includes(row.id)),'each paid doctor must actually arrive');
 // Local strategic bandaging must stop bleeding before a long tactical walk.
 // The native aid then restores only the critical health that first aid allows.
 for(let hour=0;patients.some(id=>c.operativeState[id].bleeding)&&hour<12;hour++){assert.equal(c.pendingEncounter,null);maintainClinics();order({type:'wait',hours:1});for(const id of patients)assert.ok(c.operativeState[id].alive);}
 for(const id of patients)assert.equal(c.operativeState[id].bleeding,0);
 for(const sector of [...new Set(patients.filter(id=>c.operativeState[id].hp<15).map(at))]){
  const doctor=doctors.get(sector),critical=patients.filter(id=>at(id)===sector&&c.operativeState[id].hp<15);assert.ok(doctor);
  const needed=critical.reduce((sum,id)=>sum+Math.ceil((15-c.operativeState[id].hp)/7),0);if(c.operativeState[doctor].medkits<needed)takeKnown(doctor,needed-c.operativeState[doctor].medkits);
  order({type:'createSquad',ids:[doctor,...critical].slice(0,6),name:'Socorro provincial',sector});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  const pair=visit(c),aid=autoBandageBattle(pair.battle);c=leave(sync({campaign:pair.campaign,battle:aid.battle}));
  for(const id of critical){assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
  report({event:'provincialCriticalAid',sector,doctor,steps:aid.steps,elapsedSeconds:aid.elapsedSeconds,patients:critical.map(id=>({id,hp:c.operativeState[id].hp}))});
 }
 // Recover what these actual wounds need. A partial local collection keeps
 // its exact debit; natural patient/rest recovery completes any stable shortfall.
 for(const [sector,id]of doctors){
  const need=localPatients(sector).reduce((sum,patient)=>sum+Math.ceil((c.operativeState[patient].maxHp-c.operativeState[patient].hp)/doctorRate(rosterFor(c).find(op=>op.id===id))),0);
  if(need>c.operativeState[id].medkits)c=collectRouteItems(c,id,{item:'medkits'},need-c.operativeState[id].medkits).campaign;
 }
 maintainClinics();
 const courier=rosterFor(c).filter(op=>live().includes(op.id)&&op.leadership>=60&&at(op.id)==='tucuman'&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&!c.operativeState[op.id].bleeding&&![...doctors.values()].includes(op.id)).sort((a,b)=>Number(b.id===114)-Number(a.id===114)||c.operativeState[b.id].energy-c.operativeState[a.id].energy||b.leadership-a.leadership)[0]?.id;
 assert.ok(courier,'the envoy must be an actual fit local leader, preserving every fallen soldier');
 for(let hour=0;hour<72&&(c.operativeState[courier].fatigue||c.operativeState[courier].energy<100||c.operativeState[courier].asleep);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});maintainClinics();}
 assert.equal(c.operativeState[courier].asleep,false);assert.equal(c.operativeState[courier].energy,100);
 const travel=sector=>{
  const squad=c.activeSquadId;order({type:'travel',sector,queue:true,mode:'posta'});
  for(let hour=0;hour<48&&c.squads.find(row=>row.id===squad).journey;hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});maintainClinics();}
  assert.equal(c.location,sector);assert.equal(c.squads.find(row=>row.id===squad).journey,undefined);
 };
 order({type:'transport',mode:'posta'});order({type:'createSquad',ids:[courier],name:'Enlace provincial',sector:'tucuman'});order({type:'assignCare',operativeId:courier,assignment:'active'});travel('cordoba');
 c=meetRecruits(c,['quiroga','paz'],courier);
 order({type:'createSquad',ids:[9,11,courier],name:'Batería provincial',sector:'cordoba'});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 // Finish care before its doctor joins the column. The officers guard the
 // actual conquered source while the paid clinic heals the remaining veteran.
 for(let hour=0;hour<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);hour++){assert.equal(c.pendingEncounter,null);maintainClinics();order({type:'wait',hours:1});}
 maintainClinics();for(const id of patients){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp,'finite provincial care and real rest must restore the actual injured support');assert.equal(c.operativeState[id].bleeding,0);}
 const rearDoctors=[...doctors.values()].filter(id=>at(id)==='cordoba');
 for(const id of rearDoctors){
  for(let hour=0;hour<48&&(c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  order({type:'assignToSquad',operativeId:id,squadId:c.activeSquadId});order({type:'assignCare',operativeId:id,assignment:'active'});
 }
 onCheckpoint('northern-officer-battery-input',c);
 const prepared=prepareRouteBattery(c,['bronze4'],{destination:'tucuman',keepServing:live(),report});c=retreatNorthernRear(prepared.campaign,{report});order({type:'configureArtillery',types:prepared.selections});
 onCheckpoint('northern-officer-battery-ready',c);
 order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy'],courier);
 const physicians=[1,...rosterFor(c).filter(op=>op.id!==1&&live().includes(op.id)&&op.medical>=20&&at(op.id)==='tucuman'&&c.operativeState[op.id].morale>=30&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical).map(op=>op.id)].slice(0,2);
 assert.equal(physicians.length,2,'the column needs two actual living local doctors');
 for(const id of physicians)if(c.operativeState[id].medkits<2)c=collectRouteItems(c,id,{item:'medkits'},2-c.operativeState[id].medkits).campaign;
 const fitLocal=()=>live().filter(id=>at(id)==='tucuman'&&c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding&&c.operativeState[id].morale>=30);
 const vacancies=Math.max(0,8-fitLocal().length),replacements=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=routeHiringCeiling(c,200)).sort((a,b)=>b.marksmanship-a.marksmanship||b.strength-a.strength||a.id-b.id).slice(0,vacancies);
 assert.equal(replacements.length,vacancies,'real available recruits must fill the existing eight-person support requirement');
 for(const recruit of replacements){const quote=contractQuote(c,recruit,'week'),cash=c.resources.treasury;order({type:'recruitCivic',id:recruit.id,term:'week',destination:'tucuman'});assert.equal(c.resources.treasury,cash-quote.price);assert.ok(!c.recruited.includes(recruit.id));report({event:'paidNorthernReplacement',id:recruit.id,quote,arrival:structuredClone(c.hiringArrivals.find(row=>row.operativeId===recruit.id))});}
 for(let hour=0;hour<24&&replacements.some(recruit=>!c.recruited.includes(recruit.id));hour++){c=retreatNorthernRear(c,{report});order({type:'wait',hours:1});c=retreatNorthernRear(c,{report});}
 for(const recruit of replacements){assert.ok(c.recruited.includes(recruit.id));assert.equal(at(recruit.id),'tucuman');assert.equal(c.operativeState[recruit.id].hp,c.operativeState[recruit.id].maxHp);}
 for(const operativeId of live().filter(id=>at(id)==='tucuman'))order({type:'assignCare',operativeId,assignment:'rest'});
 const officers=[9,11,1],field=[...officers,...live().filter(id=>!officers.includes(id)&&at(id)==='tucuman'&&c.operativeState[id].hp===c.operativeState[id].maxHp&&c.operativeState[id].morale>=30)];
 report({event:'northernReliefField',hour:c.hour,field,people:live().map(id=>({id,at:at(id),hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue,assignment:c.operativeState[id].assignment}))});
 assert.ok(field.length>=8,'the officers need actual fit survivors as support');
 for(let hour=0;hour<36&&field.some(id=>c.operativeState[id].fatigue||c.operativeState[id].energy<100||c.operativeState[id].asleep);hour++){c=retreatNorthernRear(c,{report});assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of field){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
 for(let offset=0;offset<field.length;offset+=6){order({type:'createSquad',ids:field.slice(offset,offset+6),name:'Columna con oficiales',sector:'tucuman'});const pair=visit(c);c=leave(sync({campaign:pair.campaign,battle:equipOpeningRifles(pair.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{report}).campaign;c=finishReloadsBeforeMarch(c);}
 c=retreatNorthernRear(c,{report});assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'finiteNorthernRelief',hour:c.hour,second:c.secondOfHour??0,field,physicians,selections:prepared.selections,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,alive:c.operativeState[id].alive}))});
 onCheckpoint('northern-officer-field-ready',c);
 return prepareFinalAssault(c,{staging:'tucuman',target:'salta',fieldIds:field});
}

// A new real rear incursion can arrive while the northern column is away.
// Withdraw only the actual healed rear survivors through the native response;
// the occupied town keeps every piece left behind.
function retreatNorthernRear(start,{report=()=>{}}={}){
 if(!start.pendingEncounter)return start;
 assert.equal(start.pendingEncounter.sector,'cordoba','an unexpected encounter must be resolved through its own actual defense');
 const defenders=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured&&start.operativeState[id].location==='cordoba'&&!operativeInTransit(start,id));
 assert.ok(defenders.length&&defenders.every(id=>![9,11,1].includes(id)&&start.operativeState[id].hp===start.operativeState[id].maxHp&&!start.operativeState[id].bleeding),'only the actual fully healed rear party may withdraw');
 const next=dispatchCampaign(start,{type:'respondToEncounter',groupId:start.pendingEncounter.groupId,choice:'retreat',destination:'tucuman'});assert.equal(next.lastError,null);assert.equal(next.pendingEncounter,null);assert.equal(next.sectors.cordoba.owner,'royalist');
 for(const id of defenders){assert.equal(next.operativeState[id].hp,start.operativeState[id].hp);assert.equal(next.operativeState[id].location,'tucuman');assert.equal(next.operativeState[id].alive,true);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(next.operativeState[id].alive,false);
 report({event:'actualNorthernRearWithdrawal',hour:next.hour,sector:'cordoba',defenders,groupId:start.pendingEncounter.groupId});return next;
}

// Stabilize the actual critical survivor before the envoy carries the agreement.
export function completeHiredNorthernMission(start,{report=()=>{}}={}){
 let c=retreatNorthernRear(structuredClone(start),{report}),prior=structuredClone(start);
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};

 const relief=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location==='salta').sort((a,b)=>Number(b.id===11)-Number(a.id===11)||b.medical-a.medical).slice(0,6).map(op=>op.id);
 assert.ok(relief.includes(11),'the actual living envoy must remain in the relief party');
 order({type:'createSquad',ids:relief,sector:'salta',name:'Socorro de Salta'});
 const p=visit(c),aid=autoBandageBattle(p.battle);c=leave(sync({campaign:p.campaign,battle:aid.battle}));for(const id of relief){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0,'actual surviving relief receives finite first aid');}
 c=retreatNorthernRear(c,{report});order({type:'diplomacy',kind:'northPact'});
 order({type:'squad',ids:[11]});
 for(let leg=0;leg<16&&c.location!=='tucuman';leg++){c=completeTestTravel(c,{sector:'tucuman',mode:'posta'});c=retreatNorthernRear(c,{report});}
 assert.equal(c.location,'tucuman');assert.equal(c.squads.find(row=>row.id===c.activeSquadId).journey,undefined);c=attendYatasto(c);c=retreatNorthernRear(c,{report});
 assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.equal(c.operativeState[1000].alive,false);for(const [id,r] of Object.entries(prior.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[10].alive,prior.operativeState[10].alive);assert.equal(c.operativeState[57].hp,88);assert.ok(!c.recruited.includes(57));assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);

 return c;
}
