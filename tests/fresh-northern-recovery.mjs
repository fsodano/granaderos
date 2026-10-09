import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {restoreNorthernRoad,prepareRestoredSalta} from './recovery-road-route.mjs';
import {operativeLocation} from '../game/squads.js';
import {contractQuote} from '../game/contracts.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fightNorthernSector,northernCombatOrder,northernClinicDefenseOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {createBattle,teamCanSee,hasLineOfSight,firearmShotOptions,actionCosts} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {careRules} from '../game/campaign-care-rules.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

// A guarded roof can have a valid low-probability lane while the ordinary
// infantry policy wants to advance. Pay for the real previewed shot first.
export function northernHospitalCoverOrder(battle,unit){
 const action=northernClinicDefenseOrder(battle,unit);if(action||unit.knockedDown||unit.entangled||unit.routed||unit.unconscious||unit.hp<15||!unit.loaded||unit.jammed||!['primary','secondary'].includes(unit.activeSlot))return action;
 const shots=[];
 for(const target of battle.units.filter(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.unconscious&&!target.routed&&!target.surrendered&&teamCanSee(battle,unit.side,target)&&hasLineOfSight(battle,unit,target))){
  const cost=actionCosts(battle,unit,target);if(unit.ap<cost.fire)continue;
  for(const option of firearmShotOptions(battle,unit,target,Math.min(4,Math.floor((unit.ap-cost.fire)/cost.aim))))if(option.chance>=5&&option.damageFactor>0)shots.push({score:option.chance*option.damageFactor,action:{type:'fire',unitId:unit.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation}});
 }
 return shots.sort((a,b)=>b.score-a.score)[0]?.action??null;
}

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
 // Book the already-planned relief officer at the isolated rear clinic before
 // a field visit advances the bleeding patient's clock. Its issued dressings
 // are finite; a returning former doctor does not receive replacement stock.
 if(!c.officer&&patients.some(id=>c.operativeState[id].location==='cordoba')){
  const localPatients=patients.filter(id=>c.operativeState[id].location==='cordoba'),cash=c.resources.treasury;
  order({type:'createSquad',name:'Socorro de Córdoba',ids:localPatients,sector:'cordoba'});
  order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
  assert.equal(cash-c.resources.treasury,300);assert.equal(c.operativeState[1000].medkits,2);
  for(const operativeId of localPatients)order({type:'assignCare',operativeId,assignment:'patient'});
  order({type:'assignCare',operativeId:1000,assignment:'doctor'});
  report({event:'northernReliefOfficer',operativeId:1000,sector:'cordoba',cost:300,dressings:2,hour:c.hour});
 }
 // Set up paid care at every actual patient location before any field visit
 // advances time for a distant, critically wounded survivor.
 // Keep the healthy local guard while the doctor and actual patients evacuate.
 const escort=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)==='tucuman'&&!patients.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical<80).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(op=>op.id);
 if(escort.length){
  order({type:'createSquad',name:'Guardia de Tucumán',ids:escort,sector:'tucuman'});
  for(const operativeId of escort)order({type:'assignCare',operativeId,assignment:'active'});
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
  // Stop the critical patient's bleeding with the already observed dressing
  // before the physician walks to the cache and spends real tactical time.
  if(at==='tucuman'&&localPatients.some(id=>c.operativeState[id].bleeding)){order({type:'wait',hours:1});for(const id of localPatients)assert.ok(c.operativeState[id].alive);}
  if(c.operativeState[medic.id].medkits<3&&at==='tucuman'){c=collectRouteItems(c,medic.id,{item:'medkits'},12).campaign;order({type:'assignCare',operativeId:medic.id,assignment:'doctor'});}
 }
 for(let h=0;h<24&&patients.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);h++){
  for(const id of stabilizationDoctors)if(!c.operativeState[id].medkits&&!c.operativeState[id].asleep&&patients.some(patient=>c.operativeState[patient].location===c.operativeState[id].location&&(c.operativeState[patient].hp<15||c.operativeState[patient].bleeding)))c=collectRouteItems(c,id,{item:'medkits'},1).campaign;
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
  const evacuees=[...new Set([...patients.filter(id=>c.operativeState[id].location===at),...stabilizationDoctors.filter(id=>c.operativeState[id].location===at)])];
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
 if(!c.officer)order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
 c=supplyRouteAmmunition(c,c.squad,{report}).campaign;

 for(const row of sectorInventoryModel(c,sector,rosterFor(c),1000).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(row.count,10-c.operativeState[1000].medkits);if(count<=0)break;
  order({type:'sectorInventory',sector,operativeId:1000,direction:'take',sourceKey:row.key,expected:row.expected,count});
 }
 for(let level=c.sectors[sector].fort;level<3;level++){const cash=c.resources.treasury;order({type:'fortify',sector});assert.equal(cash-c.resources.treasury,150);report({event:'hospitalFortification',sector,cost:150,level:c.sectors[sector].fort,hour:c.hour});}
 c=stageRouteRoofDefenders(c,c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp>=15&&!r.bleeding&&!r.asleep;}),{report});
 const localPatients=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp<r.maxHp;});
 const recoveryHours=96+Math.max(...patients.map(id=>c.operativeState[id].maxHp-c.operativeState[id].hp))*careRules(c).restHealingHours;
 for(let h=0;h<recoveryHours&&localPatients().length;h++){
  if(c.pendingEncounter){
   const encounter=c.pendingEncounter;
   report({event:'hospitalCounterattack',campaign:structuredClone(c)});
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.length);assert.ok(defenders,'a real local squad must defend the hospital');
   order({type:'selectSquad',id:defenders.id});
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   c=fightNorthernSector(c,encounter.sector,{controller:northernHospitalCoverOrder,report}).campaign;
   report({event:'hospitalDefended',campaign:structuredClone(c)});
  }
  const injured=localPatients();if(!injured.length)break;
  const medics=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location===sector&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20&&injured.some(id=>id!==op.id));
  medics.sort((a,b)=>Number(c.operativeState[b.id].medkits>0)-Number(c.operativeState[a.id].medkits>0)||Number(!injured.includes(b.id))-Number(!injured.includes(a.id))||b.medical-a.medical);
  const medic=medics[0];assert.ok(medic,'a living local medic must treat the remaining patients');
  for(const operativeId of injured)order({type:'assignCare',operativeId,assignment:c.operativeState[operativeId].hp<15||c.operativeState[operativeId].bleeding?'patient':'rest'});
  if(!c.operativeState[medic.id].medkits){
   const row=sectorInventoryModel(c,sector,rosterFor(c),medic.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(row)order({type:'sectorInventory',sector,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  }
  if(c.operativeState[medic.id].medkits){const patient=injured.filter(id=>id!==medic.id).sort((a,b)=>c.operativeState[a].hp/c.operativeState[a].maxHp-c.operativeState[b].hp/c.operativeState[b].maxHp)[0];order({type:'assignCare',operativeId:patient,assignment:'patient'});}
  order({type:'assignCare',operativeId:medic.id,assignment:c.operativeState[medic.id].medkits?'doctor':'rest'});
  order({type:'wait',hours:1});
 }
 assert.deepEqual(localPatients(),[],'surviving local patients must finish recovery');
 const party=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&operativeLocation(c,id)===sector&&!escort.includes(id);});
 assert.ok(party.length>0&&party.length<=6);
 order({type:'squad',ids:party});
 const resolveReturnContact=()=>{
  while(c.pendingEncounter){
   const returning=c.activeSquadId,encounter=c.pendingEncounter;
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));
   assert.ok(defenders,'the threatened sector needs its actual local guard');
   order({type:'selectSquad',id:defenders.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   const defense=fightNorthernSector(c,encounter.sector,{controller:northernHospitalCoverOrder,report});c=defense.campaign;
   report({event:'northernReturnDefended',groupId:encounter.groupId,...defense.summary});
   order({type:'selectSquad',id:returning});
  }
 };
 const journey=()=>c.squads.find(q=>q.id===c.activeSquadId)?.journey;
 for(let leg=0;leg<6&&c.location!=='buenos_aires';leg++){
  resolveReturnContact();
  // A remote defense stops the clock without cancelling this physical route.
  for(let h=0;h<240&&journey()?.status==='moving';h++){order({type:'wait',hours:1});resolveReturnContact();}
  assert.notEqual(journey()?.status,'moving','the real return leg must finish or stop for rest');
  if(c.location==='buenos_aires')break;
  if(journey())assert.equal(journey().status,'paused','the medical return must remain a normal travel route');
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
  for(let h=0;h<48&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){order({type:'wait',hours:1});resolveReturnContact();}
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  order(journey()?{type:'resumeTravel'}:{type:'travel',sector:'buenos_aires'});resolveReturnContact();
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
