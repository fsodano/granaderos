import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {restoreNorthernRoad,prepareRestoredSalta} from './recovery-road-route.mjs';
import {operativeLocation} from '../game/squads.js';
import {contractQuote} from '../game/contracts.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fightNorthernSector,northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {createBattle} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';

// Continue the actual wounded survivor at Buenos Aires. Recruitment hydration
// uses the same createBattle record and NPC position as the application's talk handler.
export function recoverFreshNorthernDoctor(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
   while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<=c.hour+elapsed){const contract=c.contracts[id],next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  }
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
 };
 const patients=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp<r.maxHp;});
 assert.ok(patients.length&&patients.length<6,'a real wounded survivor needs relief');
 // Set up paid care at every actual patient location before any field visit
 // advances time for a distant, critically wounded survivor.
 // The recovering force keeps a healthy escort on its actual supply road.
 const escort=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)==='tucuman'&&!patients.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical<80).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(op=>op.id);
 let escortSquad;
 if(escort.length){
  order({type:'createSquad',name:'Escolta del hospital',ids:escort,sector:'tucuman'});
  for(const operativeId of escort)order({type:'assignCare',operativeId,assignment:'active'});
  escortSquad=c.activeSquadId;
 }
 const stabilizationDoctors=[];
 for(const at of new Set(patients.map(id=>c.operativeState[id].location))){
  let medic=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location===at&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  if(!medic){
   const candidate=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&op.medical>=20&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=Math.min(routeHiringCeiling(c,250),c.resources.treasury)).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'week').price-contractQuote(c,b,'week').price)[0];assert.ok(candidate);
   order({type:'recruitCivic',id:candidate.id,term:'week',destination:at});for(let h=0;h<24&&!c.recruited.includes(candidate.id);h++)order({type:'wait',hours:1});assert.ok(c.recruited.includes(candidate.id));medic=rosterFor(c).find(op=>op.id===candidate.id);
  }
  const localPatients=patients.filter(id=>c.operativeState[id].location===at);
  order({type:'createSquad',name:'Estabilización previa',ids:[...new Set([medic.id,...localPatients])],sector:at});
  for(const row of sectorInventoryModel(c,at,rosterFor(c),medic.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   const count=Math.min(row.count,10-c.operativeState[medic.id].medkits);if(count>0)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  }
  for(const operativeId of localPatients)order({type:'assignCare',operativeId,assignment:'patient'});
  order({type:'assignCare',operativeId:medic.id,assignment:'doctor'});stabilizationDoctors.push(medic.id);
 }
 if(escortSquad){const selected=c.activeSquadId;order({type:'selectSquad',id:escortSquad});order({type:'travel',sector:'cordoba',queue:true});order({type:'selectSquad',id:selected});}
 for(let h=0;h<24&&patients.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);h++){
  for(const id of stabilizationDoctors)if(!c.operativeState[id].medkits&&!c.operativeState[id].asleep)order({type:'purchaseMedicalSupplies',operativeId:id,quantity:1});
  order({type:'wait',hours:1});
 }
 for(const id of patients){assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
 for(const operativeId of [...patients,...stabilizationDoctors])order({type:'assignCare',operativeId,assignment:'active'});
 // Treat each actual location before the evacuation clock advances. The
 // defeated enemy may have routed a survivor back to a different province.
 for(const at of new Set(patients.map(id=>c.operativeState[id].location))){
  const local=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===at);
  let medic=rosterFor(c).filter(op=>local.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  if(!medic){
   const candidate=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&op.medical>=20&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=Math.min(routeHiringCeiling(c,250),c.resources.treasury)).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'week').price-contractQuote(c,b,'week').price)[0];assert.ok(candidate,'a real available paid medic must reach the isolated patient');
   order({type:'recruitCivic',id:candidate.id,term:'week',destination:at});
   medic=rosterFor(c).find(op=>op.id===candidate.id);assert.ok(c.recruited.includes(medic.id)&&c.operativeState[medic.id].location===at);
  }
  assert.ok(medic);
  const medicalParty=[...new Set([medic.id,...patients.filter(id=>c.operativeState[id].location===at)])];
  assert.ok(medicalParty.length<=6,'the doctor and actual patients must fit a real squad');
  order({type:'createSquad',name:'Puesto de socorro',ids:medicalParty,sector:at});
  for(const row of sectorInventoryModel(c,at,rosterFor(c),medic.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   const count=Math.min(row.count,10-c.operativeState[medic.id].medkits);if(count>0)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  }
  order({type:'visitSector'});const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates[at]));
  const synced=syncBattleTime(c,aid.battle);assert.equal(synced.error,null);c=synced.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
  for(const id of patients.filter(id=>c.operativeState[id].location===at)){assert.ok(c.operativeState[id].hp>=15,'stabilize critical wounds before travel');assert.equal(c.operativeState[id].bleeding,0);}
 }
 const sector='cordoba';
 for(const at of new Set(patients.map(id=>c.operativeState[id].location).filter(at=>at!==sector))){
  const evacuees=patients.filter(id=>c.operativeState[id].location===at);
  order({type:'createSquad',name:'Evacuación de heridos',ids:evacuees,sector:at});
  for(let leg=0;leg<6&&c.location!==sector;leg++){
   for(const operativeId of evacuees)order({type:'assignCare',operativeId,assignment:'rest'});
   for(let h=0;h<48&&evacuees.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
   for(const operativeId of evacuees)order({type:'assignCare',operativeId,assignment:'active'});
   order({type:'travel',sector});assert.equal(c.pendingEncounter,null);
  }
  assert.equal(c.location,sector);
 }
 order({type:'createSquad',name:'Hospital de Córdoba',ids:patients,sector});
 order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
 c=supplyRouteAmmunition(c,c.squad,{report}).campaign;

 for(const row of sectorInventoryModel(c,sector,rosterFor(c),1000).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(row.count,10-c.operativeState[1000].medkits);if(count<=0)break;
  order({type:'sectorInventory',sector,operativeId:1000,direction:'take',sourceKey:row.key,expected:row.expected,count});
 }
 const localPatients=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp<r.maxHp;});
 for(let h=0;h<96&&localPatients().length;h++){
  if(c.pendingEncounter){
   const encounter=c.pendingEncounter;
   report({event:'hospitalCounterattack',campaign:structuredClone(c)});
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.length);assert.ok(defenders,'a real local squad must defend the hospital');
   order({type:'selectSquad',id:defenders.id});
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   c=fightNorthernSector(c,encounter.sector,{controller:tucumanCombatOrder,report}).campaign;
   report({event:'hospitalDefended',campaign:structuredClone(c)});
  }
  const injured=localPatients();if(!injured.length)break;
  const medics=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location===sector&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20&&injured.some(id=>id!==op.id));
  medics.sort((a,b)=>Number(!injured.includes(b.id))-Number(!injured.includes(a.id))||b.medical-a.medical);
  const medic=medics[0];assert.ok(medic,'a living local medic must treat the remaining patients');
  for(const operativeId of injured)order({type:'assignCare',operativeId,assignment:'patient'});
  if(!c.operativeState[medic.id].medkits){
   const row=sectorInventoryModel(c,sector,rosterFor(c),medic.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(row)order({type:'sectorInventory',sector,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   else if(c.resources.treasury>=30)order({type:'purchaseMedicalSupplies',operativeId:medic.id,quantity:1});
  }
  order({type:'assignCare',operativeId:medic.id,assignment:c.operativeState[medic.id].medkits?'doctor':'rest'});
  order({type:'wait',hours:1});
 }
 assert.deepEqual(localPatients(),[],'surviving local patients must finish recovery');
 const party=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&operativeLocation(c,id)===sector&&!escort.includes(id);});
 assert.ok(party.length>0&&party.length<=6);
 order({type:'squad',ids:party});
 for(let leg=0;leg<6&&c.location!=='buenos_aires';leg++){
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
  for(let h=0;h<48&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'travel',sector:'buenos_aires'});assert.equal(c.pendingEncounter,null);
 }
 assert.equal(c.location,'buenos_aires');
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 c=meetRecruits(c,['paroissien','dorrego'],c.squad.find(id=>c.operativeState[id].alive));
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function reuniteFreshNorthernSquad(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
   while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<=c.hour+elapsed){const contract=c.contracts[id],next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  }
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
  while(elapsed&&c.pendingEncounter){
   const returning=c.activeSquadId,encounter=c.pendingEncounter;
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive));assert.ok(defenders,'the threatened sector needs its actual garrison');
   order({type:'selectSquad',id:defenders.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   c=fightNorthernSector(c,encounter.sector,{controller:tucumanCombatOrder,report}).campaign;
   order({type:'selectSquad',id:returning});
  }
 };
const field=[...new Set([10,4,...c.squad])].filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id]?.captured);
order({type:'squad',ids:field});
for(let leg=0;leg<6&&c.location!=='cordoba';leg++){
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});
 assert.equal(c.pendingEncounter,null);
}
assert.equal(c.location,'cordoba');c=meetRecruits(c,['quiroga','paz']);
return restoreNorthernRoad(c,{report});
}

export const prepareFreshSaltaAssault=prepareRestoredSalta;

export function finishFreshNorthernCampaign(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{const next=dispatchCampaign(c,a);if(next.lastError)report({event:'northernHandoverStopped',campaign:structuredClone(c),action:a,error:next.lastError});c=next;assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const waitHour=()=>{
  if(c.pendingEncounter){
   const encounter=c.pendingEncounter;
   report({event:'saltaCounterattack',campaign:structuredClone(c)});
   const local=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive));assert.ok(local);
   order({type:'selectSquad',id:local.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   c=fightNorthernSector(c,encounter.sector,{controller:tucumanCombatOrder,report}).campaign;
   report({event:'saltaDefended',campaign:structuredClone(c)});
  }
  order({type:'wait',hours:1});
 };
 // Stabilize the actual local casualties before meetings advance tactical time.
 const urgent=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='salta'&&(r.bleeding||r.hp<15);});
 const careDoctors=new Set();
 for(let h=0;h<24&&urgent().length;h++){
  const patients=urgent(),doctor=rosterFor(c).filter(op=>{
   const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='salta'&&!patients.includes(op.id)&&r.hp>=15&&!r.bleeding&&r.energy>10&&r.medkits>0&&op.medical>=20;
  }).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'local urgent care needs an actual supplied doctor');
  careDoctors.add(doctor.id);order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
  waitHour();
 }
 assert.deepEqual(urgent(),[],'the handover must not abandon critical casualties');
 for(const operativeId of careDoctors)order({type:'assignCare',operativeId,assignment:'active'});
 const before=structuredClone(c.resources);order({type:'diplomacy',kind:'northPact'});
 assert.equal(c.resources.treasury,before.treasury-300);assert.deepEqual(Object.keys(c.resources),['treasury']);
 // Select the living envoy explicitly after a multi-squad victory. Other
 // survivors retain their records and equipment in Salta.
 const envoy=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp>=15&&r.location==='salta';}).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0];
 assert.ok(envoy,'a living local envoy must continue the northern mission');
 const envoySquad=c.squads.find(q=>q.members.includes(envoy.id));assert.ok(envoySquad);
 order({type:'selectSquad',id:envoySquad.id});order({type:'squad',ids:[envoy.id]});
 c=meetRecruits(c,['guemes','macacha'],envoy.id);
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)waitHour();for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'tucuman'});assert.equal(c.pendingEncounter,null);order({type:'visitMission',mission:'yatasto'});let b=enterSector(c.pendingBattle,c.sceneStates.yatasto);
for(const npcId of ['yatasto-belgrano','yatasto-san-martin','yatasto-san-martin']){b=approachNPC(b,String(envoy.id),npcId);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;order({type:'talkNPC',npcId,unitId:envoy.id,approach:'mission',sectorState:b});const saved=decodeSave(encodeSave(c,b));c=saved.campaign;b=saved.battle;}
order({type:'finishMission',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
