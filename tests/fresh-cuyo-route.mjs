import {bankRouteIncome} from './route-income-banking.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {foundryFor} from '../game/campaign-foundry.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {artilleryTransportQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {queueSquadTravel,travelLegHours} from '../game/squad-travel.js';
import {operativeLocation} from '../game/squads.js';
import {careAssignmentReason,doctorRate} from '../game/medical-care.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {captureRouteStrategicInput,recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {artilleryTransferDelayCode} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
import {itemUsePreview} from '../game/tactical.js';
import {fightNorthernSector} from './northern-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {order as publicOrder,visit,tactical,leave,saved} from './local-contract-fixture.mjs';

export const freshRouteServingIds=s=>s.recruited.filter(id=>s.operativeState[id]?.alive&&!s.operativeState[id].captured);
const routeClock=s=>s.hour*3600+(s.secondOfHour??0);

// Test-route protection only: every intended serving survivor keeps an actual
// paid term. Explicit dismissals still return equipment through normal orders.
// Report an accepted action before checking its resulting loss/interruption.
export function createFreshRouteOrders(read,write,{report=()=>{},handledEncounters=[],onActionRefusal}={}){
 const intended=new Set(freshRouteServingIds(read()));
 const fail=message=>{report({event:'freshRouteStopped',reason:message,campaign:read()});throw Error(message);};
 const check=()=>{
  const s=read();
  for(const id of intended){const r=s.operativeState[id],expiry=contractExpiresSeconds(s.contracts[id]);
   if(!r?.alive||r.captured||!s.recruited.includes(id)||!s.contracts[id]||expiry!==null&&expiry<=routeClock(s))fail(`The intended serving survivor ${id} is no longer available.`);
  }
  for(const id of freshRouteServingIds(s))intended.add(id);
 };
 const retain=(seconds=3600)=>{
  check();let s=read();
  for(const id of intended){
   let contract=s.contracts[id],expiry=contractExpiresSeconds(contract);
   while(expiry!==null&&expiry<=routeClock(s)+seconds){
    const quote=contractQuote(s,rosterFor(s).find(op=>op.id===id),'day');
    if(!quote.available||s.resources.treasury<quote.price)fail(`The actual renewal for ${id} is unavailable: ${quote.reason??'insufficient treasury'}.`);
    const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0},cash=s.resources.treasury;
    const diagnosticBefore=onActionRefusal?captureRouteStrategicInput(s):null;
    const next=dispatchCampaign(s,action);if(next.lastError){onActionRefusal?.({campaign:diagnosticBefore??s,action,returnedCampaign:next,preDispatchInputIndependentlyCloned:diagnosticBefore!==null});fail(next.lastError);}write(next);s=next;
    assert.equal(s.resources.treasury,cash-quote.price);
    report({event:'freshRouteRenewal',action,id,price:quote.price,hour:s.hour,second:s.secondOfHour??0,campaign:s});
    contract=s.contracts[id];expiry=contractExpiresSeconds(contract);
   }
  }
  return s;
 };
 const medicalHour=()=>{
  const s=read(),roster=rosterFor(s),patients=roster.filter(op=>intended.has(op.id)&&s.operativeState[op.id].assignment==='patient'&&!careAssignmentReason(s,op,'patient'))
   .sort((a,b)=>Number(s.operativeState[b.id].bleeding>0)-Number(s.operativeState[a.id].bleeding>0)||s.operativeState[a.id].hp/s.operativeState[a.id].maxHp-s.operativeState[b.id].hp/s.operativeState[b.id].maxHp||a.id-b.id);
  const treated=new Set();
  for(const doctor of roster.filter(op=>intended.has(op.id)&&s.operativeState[op.id].assignment==='doctor'&&!careAssignmentReason(s,op,'doctor'))){
   const patient=patients.find(op=>op.id!==doctor.id&&!treated.has(op.id)&&operativeLocation(s,op.id)===operativeLocation(s,doctor.id)&&(s.operativeState[op.id].bleeding>0||s.operativeState[op.id].hp<s.operativeState[op.id].maxHp));
   if(patient)treated.add(patient.id);
  }
  return treated;
 };
 const order=action=>{
  check();const before=read();
  if(before.pendingBattle)fail('Return the actual tactical report before route preparation.');
  if(before.pendingEncounter&&action.type!=='respondToEncounter')fail('Resolve the actual encounter before route preparation.');
  let seconds=action.type==='wait'?action.hours*3600:0;
  if(action.type==='travel'&&!action.queue){
   const preview=structuredClone(before),q=preview.squads.find(q=>q.id===preview.activeSquadId);
   const journey=queueSquadTravel(preview,q,action);
   seconds=journey.path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(journey.path[i],to,journey.mode)*3600,0);
  }
  if(seconds){
   const treated=action.type==='wait'&&action.hours===1?medicalHour():new Set();
   for(const id of intended){const r=before.operativeState[id];if((r.hp<15||r.bleeding>0)&&!treated.has(id))fail(`Actual acute survivor ${id} needs finite care before this route clock advances.`);}
  }
  retain(Math.max(3600,seconds+1));
  const next=dispatchCampaign(read(),action);if(next.lastError)fail(`${JSON.stringify(action)}: ${next.lastError}`);write(next);
  report({event:'freshRouteOrder',action,hour:next.hour,second:next.secondOfHour??0,treasury:next.resources.treasury,campaign:next});
  if(action.type==='dismiss')intended.delete(action.id);
  check();
  if(next.pendingEncounter&&!handledEncounters.includes(next.pendingEncounter.sector))fail(`The actual encounter at ${next.pendingEncounter.sector} interrupts preparation.`);
  return next;
 };
 const adopt=(next,stage)=>{
  write(next);report({event:'freshRouteCheckpoint',stage,campaign:next});check();
  if(next.pendingEncounter&&!handledEncounters.includes(next.pendingEncounter.sector))fail(`The actual encounter at ${next.pendingEncounter.sector} interrupts ${stage}.`);
  return next;
 };
 return {order,retain,adopt,check,keepIds:()=>[...intended]};
}

// Actual transport, finite carried care and defense after fresh Yatasto.
export function prepareFreshCuyoDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['salta','cordoba']});
 const order=a=>{
  if(c.pendingEncounter?.sector==='salta'&&a.type!=='respondToEncounter'){
   const selected=c.activeSquadId,groupId=c.pendingEncounter.groupId;
   retained.order({type:'respondToEncounter',groupId,choice:'retreat',destination:'tucuman'});
   retained.order({type:'selectSquad',id:selected});
   report({event:'cuyoRearWithdrawal',groupId,hour:c.hour,destination:'tucuman'});
  }
  retained.order(a);
 };
 // Forward the remaining finite battery while the actual capable party is
 // still beside it. Infantry can complete its existing march and assembly
 // while the carts travel; a later crew return trip would abandon this task.
 const localBattery=[...(c.artilleryDepots.cordoba??[]),...(c.sectorStates.cordoba?.artillery??[])].some(gun=>gun.side==='player'&&gun.type==='bronze4'&&(gun.loaded||gun.ammo>0));
 const forwardable=c.location==='tucuman'&&!localBattery?(c.sectorStates.tucuman?.artillery??[]).filter(gun=>gun.side==='player'&&gun.type==='bronze4'&&(gun.loaded||gun.ammo>0)).sort((a,b)=>a.id.localeCompare(b.id)):[];
 for(const gun of forwardable){
  const quote=artilleryTransportQuote(c,'tucuman',gun.id,'cordoba','carts','field');if(!quote.available)continue;
  const record=storedArtilleryRecord(gun),cash=c.resources.treasury;
  order({type:'transportArtillery',sector:'tucuman',artilleryId:gun.id,to:'cordoba',mode:'carts',source:'field'});
  assert.equal(c.resources.treasury,cash-quote.cost);
  const transfer=c.artilleryTransfers.find(t=>t.id===gun.id);assert.deepEqual(transfer.gun,record);
  report({event:'cuyoBatteryForwarded',id:gun.id,from:'tucuman',to:'cordoba',cost:quote.cost,dueAt:transfer.dueAt,record,campaign:c});break;
 }
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
// Bring the surviving northern reserve to the assembly point before paying
// for the elite's short contract. Every reinforcement travels normally.
const assemblySquad=c.activeSquadId,reinforcementSquads=[];
const elsewhere=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location!=='cordoba';});
for(const sector of new Set(elsewhere.map(id=>c.operativeState[id].location))){
 const ids=elsewhere.filter(id=>c.operativeState[id].location===sector);
 for(let offset=0;offset<ids.length;offset+=6){
  const members=ids.slice(offset,offset+6);order({type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector});
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  reinforcementSquads.push(c.activeSquadId);order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 }
}
for(let h=0;h<48&&reinforcementSquads.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(reinforcementSquads.every(id=>c.squads.find(q=>q.id===id)?.location==='cordoba'));
order({type:'selectSquad',id:assemblySquad});
let assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
// A won northern battle can leave fewer people than the older route did.
// Rebuild five field positions and one real rear reserve before booking the
// separate marksman. Every replacement needs a current paid contract and its
// actual arrival; the earlier dead remain in their original records.
const priorDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>id);
while(assembled.length<6){
 const relief=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id],quote=contractQuote(c,op,'week');
  return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&!c.hiringArrivals?.some(arrival=>arrival.operativeId===op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&quote.available&&!quote.topTier;
 }).sort((a,b)=>contractQuote(c,a,'week').price-contractQuote(c,b,'week').price||a.id-b.id)[0];
 assert.ok(relief,'actual serving losses need an available regular replacement before Cuyo');
 const quote=contractQuote(c,relief,'week'),cash=c.resources.treasury,booked=routeClock(c),travelHours=hiringTravelHours(c,relief.id);
 assert.ok(cash>=quote.price,'the actual treasury must pay the quoted Cuyo replacement');
 order({type:'recruitCivic',id:relief.id,term:'week',destination:'cordoba'});
 assert.equal(c.resources.treasury,cash-quote.price);
 for(let h=0;!c.recruited.includes(relief.id)&&h<=travelHours;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(c.recruited.includes(relief.id),'the paid Cuyo replacement must actually arrive');
 assert.equal(operativeLocation(c,relief.id),'cordoba');assert.ok(contractExpiresSeconds(c.contracts[relief.id])>routeClock(c));
 for(const id of priorDeaths)assert.equal(c.operativeState[id].alive,false,'paid relief cannot revive an earlier casualty');
 report({event:'cuyoPaidRelief',id:relief.id,price:quote.price,bookedSeconds:booked,arrivalSeconds:routeClock(c),travelHours,contractExpiresAt:c.contracts[relief.id].expiresAt});
 assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
}
const candidates=rosterFor(c).filter(op=>assembled.includes(op.id)).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.marksmanship-a.marksmanship);
const field=[...new Set([1,0,8,...candidates.map(op=>op.id)])].filter(id=>assembled.includes(id)).slice(0,5);
assert.equal(field.length,5,'keep five actual soldiers and a slot for the paid marksman');
order({type:'squad',ids:field});const main=c.activeSquadId;
const reserve=assembled.filter(id=>!field.includes(id));
for(let offset=0;offset<reserve.length;offset+=6)order({type:'createSquad',name:'Reserva de Cuyo',ids:reserve.slice(offset,offset+6),sector:'cordoba'});
order({type:'selectSquad',id:main});

// Budget care from actual wounds and carried dressings. A healthy party must
// not spend 450 pesos on a fixed bulk purchase before signing its defender.
const patients=assembled.filter(id=>{const r=c.operativeState[id];return r.alive&&(r.bleeding>0||r.hp<r.maxHp);});
for(const patientId of patients){
 const physician=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return assembled.includes(op.id)&&op.id!==patientId&&r.alive&&r.hp>=15&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical)[0];
 assert.ok(physician,'a living local physician must treat the actual Cuyo patient');

 if(!c.operativeState[physician.id].medkits)c=supplyRouteDressings(c,physician.id,1,{report});
 order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
 for(let i=0;i<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);i++){assert.equal(c.pendingEncounter,null);if(!c.operativeState[physician.id].medkits)c=supplyRouteDressings(c,physician.id,1,{report});order({type:'wait',hours:1});}
 assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
}
const defender=rosterFor(c).filter(op=>{
 const unit=c.operativeState[op.id],quote=contractQuote(c,op,'day');
 return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&unit.alive&&!unit.captured&&unit.hp===unit.maxHp&&unit.morale>=50&&op.marksmanship>=65&&quote.available;
}).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price)[0];
assert.ok(defender,'An actual ready marksman must be available for the paid defense.');
const defenderId=defender.id,defenderQuote=contractQuote(c,defender,'day');
assert.equal(defenderQuote.available,true,defenderQuote.reason);
const defenderBudget=Math.max(1400,defenderQuote.price+1000);
c=bankRouteIncome(c,defenderBudget,{keepIds:retained.keepIds(),report});
assert.ok(c.resources.treasury>=defenderBudget,'actual port income funds the paid defender and finite equipment reserve');
report({event:'cuyoFunding',hour:c.hour,treasury:c.resources.treasury,availableGuns:sectorInventoryModel(c,'cordoba',rosterFor(c),assembled[0]).entries.filter(row=>JSON.parse(row.expected).weapon).length});
const defenderCash=c.resources.treasury;order({type:'recruitCivic',id:defenderId,term:'day'});
assert.equal(c.resources.treasury,defenderCash-defenderQuote.price);
for(let h=0;h<24&&!c.recruited.includes(defenderId);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(c.recruited.includes(defenderId),'the paid defender must arrive before receiving ammunition');
report({event:'cuyoPaidDefender',id:defenderId,price:defenderQuote.price,arrivalHour:c.hour,contractExpiresAt:c.contracts[defenderId].expiresAt});
c=supplyRouteAmmunition(c,[defenderId],{target:12,report}).campaign;
for(const id of c.squad){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));if(row&&![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}const type=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===type)){const count=Math.min(row.count,Math.max(0,10-availableAmmunition(c.operativeState[id],type)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}order({type:'assignCare',operativeId:id,assignment:'rest'});}
// The following assault uses the same prospective regular-recruit rule as
// the created route. A six-person assembly cap is not an affordability quote.
// Book before the defense checkpoint, then equip its actual rear reserves.
const regulars=rosterFor(c).filter(op=>{
 const r=c.operativeState[op.id],day=contractQuote(c,op,'day');
 return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&!c.hiringArrivals.some(a=>a.operativeId===op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&day.available&&day.price<=routeHiringCeiling(c,30);
});
for(const op of regulars){
 const week=contractQuote(c,op,'week'),cash=c.resources.treasury;
 if(!week.available||week.total>cash)continue;
 const booked=routeClock(c),travelHours=hiringTravelHours(c,op.id);
 order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});
 assert.equal(c.resources.treasury,cash-week.total);
 for(let h=0;!c.recruited.includes(op.id)&&h<=travelHours;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(c.recruited.includes(op.id),'the affordable regular must actually arrive');
 assert.equal(operativeLocation(c,op.id),'cordoba');assert.ok(contractExpiresSeconds(c.contracts[op.id])>routeClock(c));
 for(const id of priorDeaths)assert.equal(c.operativeState[id].alive,false);
 report({event:'cuyoPaidMendozaRegular',id:op.id,price:week.price,guarantee:week.guarantee,total:week.total,dayPrice:contractQuote(c,op,'day').price,dayCeiling:routeHiringCeiling(c,30),bookedSeconds:booked,arrivalSeconds:routeClock(c),travelHours,contractExpiresAt:c.contracts[op.id].expiresAt});
}
// The stronger northern route leaves a real Salta garrison. Withdraw it
// through the offered adjacent exit before the separate Córdoba defense.
const fieldSquad=c.activeSquadId;
assert.equal(c.contracts[defenderId].term,'day');assert.ok(c.contracts[defenderId].paid>0);
for(let i=0;i<24&&(c.pendingEncounter||c.enemyGroups.some(group=>['marching','waiting'].includes(group.status)&&group.target==='cordoba'));i++){
 if(c.pendingEncounter?.sector==='salta'){
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'retreat',destination:'tucuman'});
  order({type:'selectSquad',id:fieldSquad});
 }
 if(c.pendingEncounter)break;
 order({type:'wait',hours:1});
}
if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});}
 return c;
}

export function prepareFreshMendozaAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const order=retained.order;
 const veterans=[...c.squad],main=c.activeSquadId,columns=[main];
 // Use the actual surviving and prospectively paid rear reserves from Cuyo.
 // Leave every past casualty and every carried item unchanged.
 const relief=c.recruited.filter(id=>!veterans.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
 assert.ok(relief.length,'the actual surviving rear guard supports the battery');
 for(const id of relief){
  const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
  if(![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){
   const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));assert.ok(row);
   const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  }
 }
 // Put the steady surviving command beside the gun before the shaken rear
 // guard. A low-morale first actor must not become its default lead crew.
 const participants=[...veterans,...relief],fieldIds=[...participants.filter(id=>c.operativeState[id].morale>=50),...participants.filter(id=>c.operativeState[id].morale<50)].slice(0,6);
 order({type:'squad',ids:fieldIds});const support=[...relief,...veterans].filter(id=>!fieldIds.includes(id));
 for(let offset=0;offset<support.length;offset+=6){order({type:'createSquad',name:'Reserva de Mendoza',ids:support.slice(offset,offset+6),sector:'cordoba'});columns.push(c.activeSquadId);}
 order({type:'selectSquad',id:main});
 const localBattery=()=>[...(c.artilleryDepots.cordoba??[]),...(c.sectorStates.cordoba?.artillery??[])].some(gun=>gun.side==='player'&&gun.type==='bronze4'&&(gun.loaded||gun.ammo>0));
 const incoming=c.artilleryTransfers.filter(t=>t.to==='cordoba'&&t.gun.type==='bronze4'&&(t.gun.loaded||t.gun.ammo>0)).sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id))[0];
 if(!localBattery()&&incoming){
  const started=c.hour;
  for(let h=0;h<720&&c.artilleryTransfers.some(t=>t.id===incoming.id);h++){
   assert.equal(c.pendingEncounter,null,'resolve an actual raid before waiting for the battery');
   assert.ok(c.hour<incoming.dueAt,'the actual forwarded battery delivery is delayed');order({type:'wait',hours:1});
  }
  assert.deepEqual(c.artilleryDepots.cordoba?.find(gun=>gun.id===incoming.id),incoming.gun,'the exact shipped gun must arrive without added ammunition');
  report({event:'mendozaBatteryDeliveryWait',id:incoming.id,startHour:started,endHour:c.hour,dueAt:incoming.dueAt,record:structuredClone(incoming.gun),campaign:c});
 }
 // Custody alone is not artillery support. Keep exhausted pieces unchanged
 // and recover only a real controlled gun with a remaining finite shot.
 const exhausted=[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(scene=>scene.artillery??[])].filter(gun=>gun.side==='player'&&!gun.loaded&&gun.ammo===0).map(gun=>gun.id);
 const battery=prepareRouteBattery(c,['bronze4'],{destination:'cordoba',excludeIds:exhausted,keepServing:retained.keepIds(),report});c=battery.campaign;
 report({event:'mendozaReserveBattery',field:fieldIds,support,selections:battery.selections,cost:0,hour:c.hour});order({type:'configureArtillery',types:[]});
 c=supplyRouteAmmunition(c,[...fieldIds,...support],{target:12,report}).campaign;
 const field=columns.flatMap(id=>c.squads.find(q=>q.id===id).members);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<24&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 for(const id of field){assert.equal(c.operativeState[id].energy,100);assert.equal(c.operativeState[id].fatigue,0);assert.equal(c.operativeState[id].asleep,false);}
 for(const id of columns){
  order({type:'selectSquad',id});
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});
 }
 order({type:'configureArtillery',types:battery.selections});
 for(const id of columns){order({type:'selectSquad',id});order({type:'attack',sector:'mendoza',queue:true,mode:'posta'});}
 for(let i=0;i<24&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');i++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));
 // Hold at the assembly point until the troops can approach in daylight.
 for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'mendoza'});
 assert.deepEqual(c.pendingBattle.squad.map(unit=>unit.id).sort((a,b)=>a-b),[...field].sort((a,b)=>a-b));
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// Acquire the historical army's battery from the same physical conquered
// arsenals. Foundry organization never manufactures or restocks guns.
function recoverFoundryCannons(start,target,{report=()=>{}}={}){
 let c=target===3?recoverDelayedFoundryConvoy(start,{report}):start;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const result=prepareRouteBattery(retained.retain(),Array.from({length:target},()=> 'bronze4'),{destination:'mendoza',keepServing:retained.keepIds(),report});
 retained.adopt(result.campaign,'foundry-battery');
 assert.ok(ownedArtilleryCount(result.campaign)>=target);return result.campaign;
}

// A retained piece cannot arrive through occupied Salta. Recapture the real
// convoy route with the available paid veterans, then give every actual
// wounded survivor finite care before returning to foundry preparation.
export function recoverDelayedFoundryConvoy(start,{report=()=>{}}={}){
 const transfer=start.artilleryTransfers.find(t=>t.gun.type==='bronze4'&&artilleryTransferDelayCode(start,t)==='route_cut');
 if(!transfer)return start;
 assert.equal(transfer.from,'salta');assert.equal(transfer.to,'cordoba');
 assert.deepEqual(transfer.path.filter(id=>start.sectors[id].owner!=='patriot'),['salta']);
 const original=structuredClone(start),origin=start.activeSquadId,priorDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 let c=saved({campaign:start}).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const order=action=>{
  if(c.pendingEncounter){
   assert.equal(c.pendingEncounter.sector,'tucuman');const selected=c.activeSquadId;
   retained.order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'auto'});
   assert.equal(c.pendingBattle,null);retained.order({type:'selectSquad',id:selected});
  }
  return retained.order(action);
 };
 const field=[11,1,103,111,125,127,140,144,8,122,139,116].filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza');
 assert.equal(field.length,12,'the earned convoy recapture needs its actual twelve available veterans');
 assert.ok(field.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding));
 const columns=[];
 for(let offset=0;offset<field.length;offset+=6){order({type:'createSquad',name:'Recuperación del convoy',ids:field.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);}
 for(const id of field)order({type:'assignCare',id,assignment:'active'});
 for(const id of columns){order({type:'selectSquad',id});order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});}
 for(let h=0;h<168&&columns.some(id=>c.squads.find(q=>q.id===id).journey);h++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='tucuman'&&!c.squads.find(q=>q.id===id).journey));
 for(const id of field)order({type:'assignCare',id,assignment:'rest'});
 for(let h=0;h<72&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const id of field)order({type:'assignCare',id,assignment:'active'});
 for(const id of columns){order({type:'selectSquad',id});order({type:'attack',sector:'salta',queue:true,mode:'posta'});}
 for(let h=0;h<72&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');h++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));
 order({type:'beginAssault',sector:'salta'});
 const initial=enterSector(c.pendingBattle,c.sectorStates.salta),result=fightNorthernSector(c,'salta',{controller:coastalBatteryController(initial,{sharedArtillerySight:true}),report});
 c=result.campaign;assert.equal(c.sectors.salta.owner,'patriot');
 const surviving=c.recruited.filter(id=>c.operativeState[id].alive),patients=surviving.filter(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding);
 const care=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 care.retain(3*3600);
 if(patients.length){
  const sectors=new Set(patients.map(id=>c.operativeState[id].location));assert.equal(sectors.size,1);
  const sector=[...sectors][0];assert.equal(sector,'cell-12-8');
  const doctor=rosterFor(c).filter(op=>surviving.includes(op.id)&&c.operativeState[op.id].location==='salta'&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  assert.ok(doctor);c=publicOrder(c,{type:'createSquad',name:'Socorro del convoy',ids:[doctor.id],sector:'salta'});
  // Reserve two strokes for each actual critical patient and one for each
  // other bleeder. Take only existing reachable dressings from known custody.
  const needed=patients.reduce((sum,id)=>sum+(c.operativeState[id].hp<15?2:1),0);
  while(c.operativeState[doctor.id].medkits<needed){
   const model=sectorInventoryModel(c,'salta',rosterFor(c),doctor.id),row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits'&&r.count>0);
   assert.equal(model.reason,null);assert.ok(row,'actual convoy care needs known finite dressings');
   const count=Math.min(row.count,needed-c.operativeState[doctor.id].medkits),before=c.operativeState[doctor.id].medkits;
   c=publicOrder(c,{type:'sectorInventory',sector:'salta',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   assert.equal(c.operativeState[doctor.id].medkits,before+count);report({event:'convoyFiniteDressings',doctorId:doctor.id,sourceKey:row.key,count});
  }
  // Equip before departure. A critical roadside patient has no spare time
  // for a weapon change after the actual two-hour rural march.
  let p=visit(c);p=tactical(p,{type:'weapon',unitId:String(doctor.id),slot:'medical'});c=leave(p);
  c=publicOrder(c,{type:'travel',sector,mode:'march'});
  assert.ok(patients.every(id=>c.operativeState[id].alive&&c.operativeState[id].hp>0));
  c=publicOrder(c,{type:'createSquad',name:'Socorro del convoy',ids:[doctor.id,...patients],sector,returnToService:true});p=visit(c);
  const dressings=p.battle.units.find(u=>u.id===String(doctor.id)).medkits;let treatments=0,careSteps=0;
  for(const id of [...patients].sort((a,b)=>c.operativeState[a].hp-c.operativeState[b].hp)){
   const patient=()=>p.battle.units.find(u=>u.id===String(id));
   while(patient().hp<15||patient().bleeding){
    const medic=p.battle.units.find(u=>u.id===String(doctor.id)),quote=itemUsePreview(p.battle,medic,patient());assert.ok(quote.valid,quote.reason);
    const before=medic.medkits,action={type:'useItem',unitId:medic.id,targetId:String(id)};p=tactical(p,action);
    const used=before-p.battle.units.find(u=>u.id===medic.id).medkits;assert.ok(used===0||used===1);treatments+=used;
    assert.ok(patient().hp>0);assert.ok(treatments<=dressings);assert.ok(++careSteps<=dressings*3+patients.length,'finite convoy care must make bounded progress');report({event:'convoyActualCare',action,used,hp:patient().hp,bleeding:patient().bleeding});
    p=saved(p);
   }
  }
  assert.equal(p.battle.units.find(u=>u.id===String(doctor.id)).medkits,dressings-treatments);c=leave(p);
 }
 assert.ok(surviving.every(id=>c.operativeState[id].alive&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding));
 const resumed=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 if(c.artilleryTransfers.some(t=>t.id===transfer.id))resumed.order({type:'wait',hours:1});
 assert.ok(!c.artilleryTransfers.some(t=>t.id===transfer.id));
 assert.deepEqual(c.artilleryDepots[transfer.to].find(gun=>gun.id===transfer.id),transfer.gun,'the real recaptured convoy delivers its exact spent piece');
 resumed.order({type:'selectSquad',id:origin});assert.equal(c.location,'mendoza');
 for(const id of priorDeaths)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(start,original);
 report({event:'foundryConvoyRecovered',id:transfer.id,record:transfer.gun,battle:result.summary,carePatients:patients,deaths:field.filter(id=>!c.operativeState[id].alive),hour:c.hour,second:c.secondOfHour});
 return saved({campaign:c}).campaign;
}

export function startFreshFoundry(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const order=retained.order;
 const local=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp>=15&&r.location==='mendoza';});
 const envoy=local.filter(op=>op.leadership>=60).sort((a,b)=>b.leadership-a.leadership)[0]?.id;
 assert.notEqual(envoy,undefined,'a living local leader must meet the actual recruitment requirement');
 // The selected assault squad can have lost its leader. Use actual local
 // command and leave room for living residents who can still join.
 const delegates=[envoy,...local.map(op=>op.id).filter(id=>id!==envoy)].slice(0,4);
 order(c.location==='mendoza'?{type:'squad',ids:delegates}:{type:'createSquad',sector:'mendoza',ids:delegates,name:'Comitiva de la fundición'});
 c=bankRouteIncome(retained.retain(),foundryFor(c).setupCost+150,{keepIds:retained.keepIds(),report});
 c=meetRecruits(c,['beltran'],envoy);
 const before=c.resources.treasury;order({type:'foundry'});
 assert.equal(c.resources.treasury,before-foundryFor(c).setupCost);
 order({type:'diplomacy',kind:'emancipation'});
 if(c.operativeState[7].alive&&!c.operativeState[7].captured&&!c.recruited.includes(7))c=meetRecruits(c,['barcala'],envoy);
 // A lone paid survivor first brings the real permanent founders into
 // service. Only then can the expensive short assignment end safely.
 const permanentLeader=rosterFor(c).find(op=>c.recruited.includes(op.id)&&c.contracts[op.id]?.expiresAt===null&&c.operativeState[op.id].alive&&c.operativeState[op.id].location==='mendoza'&&op.leadership>=60);
 if(permanentLeader)for(const id of [...c.recruited]){
  const contract=c.contracts[id],unit=c.operativeState[id];
  if(!unit.alive||unit.location!=='mendoza'||contract?.term!=='day'||contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price<=600)continue;
  const cash=c.resources.treasury,injuries=structuredClone(unit);order({type:'dismiss',id});
  assert.equal(c.resources.treasury,cash);for(const key of ['hp','maxHp','bleeding','bandaged','alive'])assert.equal(c.operativeState[id][key],injuries[key]);
  report({event:'foundrySpecialistReleased',id,price:contract.paid,hour:c.hour,treasury:c.resources.treasury,leader:permanentLeader.id,founders:[2,7].filter(founder=>c.recruited.includes(founder)&&c.operativeState[founder].alive)});
 }
 c=recoverFoundryCannons(c,1,{report});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshArmyFunding(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const order=retained.order;
 const local=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
 const patients=local.filter(id=>{const r=c.operativeState[id];return r.bleeding>0||r.hp<r.maxHp;});
 const readyPhysician=physician=>{
  const needsRest=()=>{const r=c.operativeState[physician.id];return r.energy<100||r.fatigue||r.asleep;};
  if(!needsRest())return;
  if(c.operativeState[physician.id].assignment!=='rest')order({type:'assignCare',operativeId:physician.id,assignment:'rest'});
  for(let h=0;h<48&&needsRest();h++)order({type:'wait',hours:1});
  assert.equal(c.operativeState[physician.id].energy,100);assert.equal(c.operativeState[physician.id].fatigue,0);assert.equal(c.operativeState[physician.id].asleep,false);
 };
 const supplyPhysician=physician=>{
  if(c.operativeState[physician.id].medkits)return;
  const model=sectorInventoryModel(c,'mendoza',rosterFor(c),physician.id);
  const available=model.entries.some(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits')||local.some(id=>id!==physician.id&&c.operativeState[id].medkits>0&&!sectorInventoryModel(c,'mendoza',rosterFor(c),id).reason);
  if(available){c=supplyRouteDressings(c,physician.id,1,{report});return;}
  assert.ok(local.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding),'stabilize every actual local patient before the medical courier departs');
  for(const operativeId of local)if(c.operativeState[operativeId].assignment!=='rest')order({type:'assignCare',operativeId,assignment:'rest'});
  readyPhysician(physician);
  const needed=patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(physician,c)),0);
  if(!needed)return;
  const delivery=collectRouteMedicalSupplies(retained.retain(),physician.id,needed,{report});
  retained.adopt(delivery.campaign,'funding-medical-courier');
  assert.ok(delivery.collected>0);assert.equal(c.operativeState[physician.id].location,'mendoza');
  report({event:'fundingMedicalCourier',operativeId:physician.id,collected:delivery.collected,remainingPatients:patients.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),hour:c.hour,second:c.secondOfHour,campaign:c});
 };
 for(const patientId of patients){
  if(c.operativeState[patientId].hp===c.operativeState[patientId].maxHp&&!c.operativeState[patientId].bleeding)continue;
  const physician=rosterFor(c).filter(op=>local.includes(op.id)&&op.id!==patientId&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];
  assert.ok(physician,'an actual local physician must provide foundry recovery');

  supplyPhysician(physician);
  readyPhysician(physician);
  if(c.operativeState[patientId].hp===c.operativeState[patientId].maxHp&&!c.operativeState[patientId].bleeding)continue;
  if(c.operativeState[physician.id].assignment!=='doctor')order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});
  if(c.operativeState[patientId].assignment!=='patient')order({type:'assignCare',operativeId:patientId,assignment:'patient'});
  for(let h=0;h<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);h++){
   assert.equal(c.pendingEncounter,null);supplyPhysician(physician);
   if(careAssignmentReason(c,physician,'doctor'))readyPhysician(physician);
   if(c.operativeState[patientId].hp===c.operativeState[patientId].maxHp&&!c.operativeState[patientId].bleeding)break;
   if(c.operativeState[physician.id].assignment!=='doctor')order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});
   if(c.operativeState[patientId].assignment!=='patient')order({type:'assignCare',operativeId:patientId,assignment:'patient'});
   order({type:'wait',hours:1});
  }
  assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
 }
 for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';}))order({type:'assignCare',operativeId,assignment:'rest'});
 c=recoverFoundryCannons(c,2,{report});
 assert.equal(c.flags.armyFunded,false);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Leave a trained local defense, recover a three-piece army battery and pay its project cost.
export function completeFreshArmyFunding(start,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'completeFreshArmyFunding',stage:'preparation-input',campaign:start});
 let c=start;
 try{
 c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman','salta'],onActionRefusal:detail=>recordRouteStrategicEvidence({helper:'completeFreshArmyFunding',stage:'campaign-action-refusal',...detail,inputCapture,error:detail.returnedCampaign.lastError})});
 const resolveNorthernDefense=()=>{
  if(!c.pendingEncounter)return;
  assert.ok(['tucuman','salta'].includes(c.pendingEncounter.sector));
  const selected=c.activeSquadId,sector=c.pendingEncounter.sector;
  retained.order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,...(sector==='salta'?{choice:'retreat',destination:'tucuman'}:{choice:'auto'})});
  assert.equal(c.pendingBattle,null,'the ordinary automatic northern defense must settle');
  retained.order({type:'selectSquad',id:selected});
 };
 const order=action=>{resolveNorthernDefense();return retained.order(action);};
 const finishJourney=sector=>{
  for(let hour=0;hour<168&&c.squads.find(q=>q.id===c.activeSquadId).journey;hour++){
   resolveNorthernDefense();const journey=c.squads.find(q=>q.id===c.activeSquadId).journey;if(!journey)break;
   assert.notEqual(journey.status,'ready','foundry travel must not enter an unresolved assault');
   if(journey.status==='paused')order({type:'resumeTravel'});else order({type:'wait',hours:1});
  }
  resolveNorthernDefense();assert.equal(c.squads.find(q=>q.id===c.activeSquadId).journey,undefined);assert.equal(c.location,sector);
 };
 // Earn actual port income before paying for travel and the rear course.
 c=bankRouteIncome(retained.retain(),200,{keepIds:retained.keepIds(),report});
 // Secure the existing rear piece before the course advances the clock.
 // A later occupation cannot supply a gun left in its former arsenal.
 c=recoverFoundryCannons(c,3,{report});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba',mode:'posta'});
 finishJourney('cordoba');
 const trainer=rosterFor(c).filter(op=>op.id!==2&&op.leadership>=30&&c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&c.operativeState[op.id].location==='cordoba').sort((a,b)=>Number(b.id===7)-Number(a.id===7)||Number(c.contracts[b.id]?.expiresAt===null)-Number(c.contracts[a.id]?.expiresAt===null)||b.leadership-a.leadership)[0];
 assert.ok(trainer,'an actual living local leader must meet the militia course requirement');
 const before=c.resources.treasury;
 order({type:'militia',sector:'cordoba',trainerId:trainer.id,rank:0});
 assert.equal(c.resources.treasury,before-60);
 for(let i=0;i<60&&c.militiaTraining.length;i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.militiaTraining.length,0);assert.equal(c.sectors.cordoba.militia[0],3);
 const workers=c.recruited.filter(id=>{const r=c.operativeState[id];return id!==trainer.id&&r.alive&&!r.captured&&r.location==='cordoba';});
 const foundryWorkers=[2,...workers.filter(id=>id!==2)].filter(id=>workers.includes(id)).slice(0,6);
 assert.ok(foundryWorkers.includes(2),'the living founder must return to the foundry');
 order({type:'createSquad',name:'Fundición de Mendoza',ids:foundryWorkers,sector:'cordoba'});
 order({type:'travel',sector:'mendoza',mode:'posta'});
 finishJourney('mendoza');
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 c=recoverFoundryCannons(c,3,{report});
 for(let i=0;i<240&&c.resources.treasury<foundryFor(c).fundingCost;i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);
  const before=c.hour;order({type:'wait',hours:1});assert.ok(c.hour>before||c.assignmentAttention.notice,'a paused wait must report its assignment notice');
 }
 const funding=c.resources.treasury;order({type:'fundArmy'});
 assert.equal(c.resources.treasury,funding-foundryFor(c).fundingCost);assert.equal(c.flags.armyFunded,true);assert.ok(ownedArtilleryCount(c)>=3);
 assert.equal(c.sectors.cordoba.owner,'patriot');
 assert.equal(c.squads.find(q=>q.members.includes(trainer.id)).location,'cordoba');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
 }catch(error){
  recordRouteStrategicEvidence({helper:'completeFreshArmyFunding',stage:'preparation-failure',campaign:c,inputCapture,error});throw error;
 }
}
