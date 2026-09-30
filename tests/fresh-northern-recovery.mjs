import {ammoResourceKey} from '../game/campaign-ammunition.js';
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
 // Treat each actual location before the evacuation clock advances. The
 // defeated enemy may have routed a survivor back to a different province.
 for(const at of new Set(patients.map(id=>c.operativeState[id].location))){
  const local=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===at);
  const medic=rosterFor(c).filter(op=>local.includes(op.id)&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];assert.ok(medic);
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
 const ammunition={};
 for(const op of rosterFor(c).filter(op=>c.squad.includes(op.id))){const type=weaponAmmoType(op.weapon);if(type)ammunition[type]=(ammunition[type]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],type)-(c.operativeState[op.id].carriedLoaded??0));}
 for(const [ammoType,count]of Object.entries(ammunition)){const key=ammoResourceKey(ammoType),quantity=Math.max(0,count-(c.resources[key]??0)-(c.depots[sector]?.[key]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}

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
 const party=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector;});
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
// Hold the supply road with the returning officers while the local threat arrives.
const holdingSquad=c.activeSquadId;order({type:'createSquad',name:'Refuerzo de Tucumán',ids:[9]});const forwardSquad=c.activeSquadId;
order({type:'travel',sector:'tucuman',queue:true});order({type:'selectSquad',id:holdingSquad});
for(const id of c.squad){
 const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));
 if(row&&![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){
  const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon&&JSON.parse(r.expected).instanceId===gun.instanceId);assert.ok(item);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
 }
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){
  const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));
  if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
 }
}
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
const localSquad=c.activeSquadId;
for(let h=0;h<48&&(c.squads.find(q=>q.id===forwardSquad)?.journey||c.pendingEncounter);h++){
 if(!c.squads.find(q=>q.id===forwardSquad)?.journey&&c.operativeState[9].assignment==='active')order({type:'assignCare',operativeId:9,assignment:'rest'});
 if(c.pendingEncounter?.sector==='tucuman'){
  const defenders=c.squads.find(q=>q.location==='tucuman'&&q.members.length);assert.ok(defenders);
  order({type:'selectSquad',id:defenders.id});order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
  c=fightNorthernSector(c,'tucuman',{controller:tucumanCombatOrder,report}).campaign;
  order({type:'selectSquad',id:localSquad});
 }
 if(c.pendingEncounter)break;
 order({type:'wait',hours:1});
}
// The hospital defense may already have defeated this counterattack. Resolve
// an encounter only when the live campaign actually reports one.
if(c.pendingEncounter){
 assert.equal(c.pendingEncounter.sector,'cordoba');
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 c=fightNorthernSector(c,'cordoba',{controller:northernCombatOrder,report}).campaign;
}
assert.equal(c.sectors.cordoba.owner,'patriot');

// Pay a local rear guard before the officers leave the supply road.
const roadCommand=c.activeSquadId,rear=[],rearCash=c.resources.treasury;
for(const id of [127,104,101,102,108,139]){
 if(!c.operativeState[id].alive||c.operativeState[id].captured||c.recruited.includes(id))continue;
 order({type:'recruitCivic',id,term:'week'});rear.push(id);
 const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const row=model().entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
 if(row){
  const gun=JSON.parse(row.expected);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const item=model().carried.find(row=>row.equip?.some(option=>option.slot==='primary'&&option.valid)&&JSON.parse(row.expected).weapon===gun.weapon);assert.ok(item);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
 }
}
if(rear.length)order({type:'createSquad',name:'Guardia del camino de Córdoba',ids:rear});
report({event:'roadGuardHired',sector:'cordoba',ids:rear,paid:rearCash-c.resources.treasury,hour:c.hour});
order({type:'selectSquad',id:roadCommand});
// Keep the recovering column on the supply road for one day before leaving
// it unguarded. Resolve actual arrivals through the normal encounter path.
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let hour=0;hour<24;hour++){
 if(c.pendingEncounter){
  assert.equal(c.pendingEncounter.sector,'cordoba');
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
  c=fightNorthernSector(c,'cordoba',{controller:northernCombatOrder,report}).campaign;
 }
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
  const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
 }
 order({type:'wait',hours:1});
}
if(c.pendingEncounter){
 assert.equal(c.pendingEncounter.sector,'cordoba');
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 c=fightNorthernSector(c,'cordoba',{controller:northernCombatOrder,report}).campaign;
}

for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'tucuman'});assert.equal(c.pendingEncounter,null);assert.equal(c.location,'tucuman');
const available=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&c.operativeState[op.id].location==='tucuman').sort((a,b)=>b.leadership-a.leadership).map(op=>op.id);
assert.ok(available.length);
order({type:'squad',ids:available.slice(0,5)});const mainSquad=c.activeSquadId;
for(let offset=5;offset<available.length;offset+=6)order({type:'createSquad',name:'Reserva del norte',ids:available.slice(offset,offset+6)});
order({type:'selectSquad',id:mainSquad});
for(const operativeId of available)order({type:'assignCare',operativeId,assignment:'active'});order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy'],available[0]);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSaltaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
// Fill existing vacancies with affordable living recruits before committing
// low-morale veterans alone. Every hire draws real equipment and a paid term.
for(const id of [100,119,130]){
 const vacancy=c.squads.find(q=>q.location==='tucuman'&&!q.journey&&q.members.length>0&&q.members.length<6);
 if(!vacancy)break;
 if(c.recruited.includes(id)||!c.operativeState[id].alive||c.operativeState[id].captured)continue;
 order({type:'selectSquad',id:vacancy.id});order({type:'recruitCivic',id,term:'week'});
}
// Reinforce the officers with the actual living Tucumán survivors.
// Each squad still travels and deploys through its own ordinary route.
const assault=c.squads.filter(q=>q.members.length&&q.location==='tucuman'&&!q.journey);
const squads=assault.map(q=>q.id),ids=assault.flatMap(q=>q.members);
for(const id of ids){const model=()=>sectorInventoryModel(c,'tucuman',rosterFor(c),id);
 const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));
 if(row&&![1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));if(count)order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 order({type:'assignCare',operativeId:id,assignment:'rest'});
}
for(let i=0;i<24&&ids.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
// Stage the coordinated assault through the ordinary campaign clock.
order({type:'wait',hours:4});
for(const id of squads){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c);}
for(const id of squads){order({type:'selectSquad',id});order({type:'attack',sector:'salta',queue:true});}for(let i=0;i<30&&!squads.every(id=>c.squads.find(q=>q.id===id)?.journey?.status==='ready');i++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'salta'});
assert.equal(c.pendingBattle.squad.length,ids.length);
for(const unit of c.pendingBattle.squad)assert.ok(!unit.weaponDropped&&unit.loaded>0&&unit.ammo>0,`soldier ${unit.id} needs a loaded firearm and compatible reserves before Salta`);
return c;
}

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
 const before=structuredClone(c.resources);order({type:'diplomacy',kind:'northPact'});
 assert.equal(c.resources.muskets,before.muskets-20);assert.equal(c.resources.horses,before.horses-10);assert.equal(c.resources.powder,before.powder-10);
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
