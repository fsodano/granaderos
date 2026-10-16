import {bankRouteIncome} from './route-income-banking.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {collectKnownCuyoDressings} from './cuyo-known-medical-courier.mjs';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {foundryFor} from '../game/campaign-foundry.js';
import {campaignRole} from '../game/campaign-roles.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {artilleryTransportQuote,artilleryTransportPath,storedArtilleryRecord} from '../game/artillery-transport.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {queueSquadTravel,travelLegHours} from '../game/squad-travel.js';
import {canReassignOperative,operativeLocation,operativeInTransit} from '../game/squads.js';
import {careAssignmentReason,careAssignmentBusy,doctorRate} from '../game/medical-care.js';
import {careRules,strategicBleedingPercent} from '../game/campaign-care-rules.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor} from '../game/ammo-types.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {captureRouteStrategicInput,recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {artilleryTransferDelayCode} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
import {itemUsePreview,artilleryContact,hasFirearm,firearmShotOptions,actionCosts,stanceCost,meleePreview} from '../game/tactical.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {fightNorthernSector} from './northern-route.mjs';
import {fight} from './opening-driver.mjs';
import {rescueClinicDefenseController} from './rescue-clinic-readiness.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernHospitalFortification} from './northern-hospital-fortification.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {order as publicOrder,visit,tactical,leave,saved} from './local-contract-fixture.mjs';
import {recaptureFoundryConvoy} from './foundry-convoy-recapture.mjs';
import {recoverNorthernLocalPatients} from './fresh-northern-fixture.mjs';
import {bookRouteHires,finishRouteHireArrivals} from './paid-route-hiring.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {knownRouteBystanderShotSafety} from './route-fire-safety.mjs';

export const freshRouteServingIds=s=>s.recruited.filter(id=>s.operativeState[id]?.alive&&!s.operativeState[id].captured);
const routeClock=s=>s.hour*3600+(s.secondOfHour??0);

// Test-route protection only: every intended serving survivor keeps an actual
// paid term. Explicit dismissals still return equipment through normal orders.
// Report an accepted action before checking its resulting loss/interruption.
export function createFreshRouteOrders(read,write,{report=()=>{},handledEncounters=[],onActionRefusal}={}){
 const intended=new Set(freshRouteServingIds(read()));
 const fail=message=>{const campaign=read();recordRouteStrategicEvidence({helper:'createFreshRouteOrders',stage:'route-stopped',campaign,error:message});report({event:'freshRouteStopped',reason:message,campaign});throw Error(message);};
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

// Send the two actual northern pieces while their serving crews are still
// local. Empty guns remain physical army property; transport adds no charge.
export function secureFreshNorthernBattery(start,{report=()=>{}}={}){
 const before=structuredClone(start);let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const original={id:c.activeSquadId,members:[...c.squad],location:c.location},events=[],shipments=[],renewals=[],deferred=[];
 const physical=state=>[...Object.values(state.artilleryDepots??{}).flat(),...Object.values(state.sectorStates??{}).flatMap(b=>b.artillery??[]),...(state.artilleryTransfers??[]).map(t=>t.gun)]
  .filter(g=>g.side==='player').map(storedArtilleryRecord).sort((a,b)=>a.id.localeCompare(b.id));
 const guns=physical(c),people=structuredClone(c.operativeState),groups=structuredClone(c.squads),cash=c.resources.treasury,clock=routeClock(c);
 const keep=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const order=action=>{c=publicOrder(c,action);events.push({event:'northernBatteryOrder',action:structuredClone(action),hour:c.hour,second:c.secondOfHour??0});};
 const capable=id=>{const r=c.operativeState[id];return keep.includes(id)&&r.hp>=15&&!r.unconscious&&!r.routed&&!r.asleep&&!operativeInTransit(c,id)&&!careAssignmentBusy(r.assignment)&&(r.energy??0)>0;};
 for(const sector of ['tucuman','salta'])for(const gun of [...(c.sectorStates[sector]?.artillery??[])].filter(g=>g.side==='player'&&g.type==='bronze4')){
  const required=artilleryProfile(c,gun).crew,local=keep.filter(id=>capable(id)&&operativeLocation(c,id)===sector);
  const crew=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.filter(id=>local.includes(id)).length>=required);
  const defer=(reason,quote=null)=>{const receipt={event:'northernBatteryDeferred',id:gun.id,sector,record:structuredClone(gun),requiredCrew:required,capableLocalIds:local,reason,quote};deferred.push(receipt);events.push(receipt);};
  if(!crew){defer(`No existing local squad supplies ${required} actual serving crew members.`);continue;}
  order({type:'selectSquad',id:crew.id});
  const quote=artilleryTransportQuote(c,sector,gun.id,'cordoba','carts','field');if(!quote.available){defer(quote.reason,structuredClone(quote));continue;}
  const deadline=(c.hour+quote.hours)*3600;
  for(const id of keep){let contract=c.contracts[id],expiry=contractExpiresSeconds(contract);
   while(expiry!==null&&expiry<=deadline){
    const renewal=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.equal(renewal.available,true,renewal.reason);
    const prior=structuredClone(contract),treasury=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
    const payFields=r=>Object.fromEntries(['morale','lastMoralePayAt','lastMoralePaySecond'].filter(key=>Object.hasOwn(r,key)).map(key=>[key,r[key]])),payBefore=payFields(c.operativeState[id]),expected=people[id];
    // Native payment rewards a living soldier at most once per24 real hours.
    // Predict only those three pay fields; every physical/body/role field stays exact.
    if(expected.lastMoralePayAt==null||clock-(expected.lastMoralePayAt*3600+(expected.lastMoralePaySecond??0))>=86400){expected.morale=Math.max(0,Math.min(100,expected.morale+2));expected.lastMoralePayAt=c.hour;if(c.secondOfHour)expected.lastMoralePaySecond=c.secondOfHour;else delete expected.lastMoralePaySecond;}
    order(action);assert.equal(c.resources.treasury,treasury-renewal.price);assert.equal(contractExpiresSeconds(c.contracts[id]),renewal.expiresAt*3600+(renewal.expiresSecond??0));
    const payAfter=payFields(c.operativeState[id]);assert.deepEqual(payAfter,payFields(expected));
    renewals.push({id,action,quote:structuredClone(renewal),before:prior,after:structuredClone(c.contracts[id]),paid:renewal.price,pay:{before:payBefore,after:payAfter,hour:c.hour,second:c.secondOfHour??0}});contract=c.contracts[id];expiry=contractExpiresSeconds(contract);
   }
  }
  const record=storedArtilleryRecord(gun),treasury=c.resources.treasury;
  order({type:'transportArtillery',sector,artilleryId:gun.id,to:'cordoba',mode:'carts',source:'field'});
  assert.equal(c.resources.treasury,treasury-quote.cost);
  const transfer=c.artilleryTransfers.find(t=>t.id===gun.id);assert.ok(transfer);assert.deepEqual(transfer.gun,record);assert.deepEqual(transfer.path,quote.path);assert.equal(transfer.dueAt,c.hour+quote.hours);
  assert.equal(c.sectorStates[sector].artillery.some(g=>g.id===gun.id),false);assert.deepEqual(physical(c),guns);
  const receipt={event:'northernBatteryForwarded',id:gun.id,from:sector,to:'cordoba',crewSquad:crew.id,crew:[...c.squad],quote:structuredClone(quote),record,transfer:structuredClone(transfer)};shipments.push(receipt);events.push(receipt);
 }
 order({type:'selectSquad',id:original.id});
 assert.deepEqual(c.squad,original.members);assert.equal(c.location,original.location);assert.deepEqual(c.squads,groups);assert.deepEqual(c.operativeState,people);assert.deepEqual(physical(c),guns);
 assert.equal(routeClock(c),clock);assert.equal(c.resources.treasury,cash-renewals.reduce((sum,r)=>sum+r.paid,0)-shipments.reduce((sum,r)=>sum+r.quote.cost,0));
 for(const receipt of deferred)assert.deepEqual(c.sectorStates[receipt.sector].artillery.find(g=>g.id===receipt.id),receipt.record,'An unavailable northern piece retains its complete actual field record.');
 for(const id of keep){assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive);const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>Math.max(clock,...shipments.map(s=>s.transfer.dueAt*3600)));}
 assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.deepEqual(c.sectors,start.sectors);assert.deepEqual(start,before);
 const campaign=decodeSave(encodeSave(c)).campaign;assert.deepEqual(campaign,c);
 for(const event of events)report(event);report({event:'northernBatterySecured',complete:deferred.length===0,shipments,renewals,deferred,campaign:structuredClone(campaign)});
 return {campaign,shipments,renewals,deferred};
}

// Actual transport, finite carried care and defense after fresh Yatasto.
export function prepareFreshCuyoDefense(start,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareFreshCuyoDefense',stage:'preparation-input',campaign:start});
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
 // Dispatch both remaining records before pulling their local guards south.
 // The normal assembly/care clock delivers them through the controlled route.
 const secured=secureFreshNorthernBattery(c,{report});retained.adopt(secured.campaign,'northern-battery-custody');
 for(const shipment of secured.shipments)report({event:'cuyoBatteryForwarded',id:shipment.id,from:shipment.from,to:shipment.to,cost:shipment.quote.cost,dueAt:shipment.transfer.dueAt,record:structuredClone(shipment.record),campaign:structuredClone(c)});
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
const ensurePatientDressings=(physician,patientId)=>{
 if(c.operativeState[physician.id].medkits)return;
 const attempted=[];
 try{
  const supplied=supplyRouteDressings(c,physician.id,1,{report:event=>attempted.push(event)});
  retained.adopt(supplied,'cuyo-local-care');for(const event of attempted)report(event);
 }catch(error){
  if(!error.message.startsWith('No actual reachable finite dressings remain for '))throw error;
  const patient=c.operativeState[patientId],requested=Math.ceil((patient.maxHp-patient.hp)/doctorRate(physician));
  assert.ok(requested>0,'An actual finite courier needs an observed clinical supply requirement.');
  collectKnownCuyoDressings(()=>c,order,physician.id,requested,{report});
 }
};
for(const patientId of patients){
 const physician=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return assembled.includes(op.id)&&op.id!==patientId&&r.alive&&r.hp>=15&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical)[0];
 assert.ok(physician,'a living local physician must treat the actual Cuyo patient');

 ensurePatientDressings(physician,patientId);
 order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
 for(let i=0;i<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);i++){assert.equal(c.pendingEncounter,null);ensurePatientDressings(physician,patientId);order({type:'wait',hours:1});}
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
 recordRouteStrategicEvidence({helper:'prepareFreshCuyoDefense',stage:'route-checkpoint',campaign:c,inputCapture,context:{shipments:secured.shipments,renewals:secured.renewals,deferred:secured.deferred,assembled,field,patients,defenderId,defenderQuote,capturePhase:'Actual full preparation return after its original finite care, paid arrivals, firearm supply and encounter request orders; no additional state or actions.'}});
 return c;
}

// Known owned records are finite. Prefer actual remaining charges over the
// convenience of a nearer piece; the normal crew/transport helper pays the trip.
export function strongestFreshOwnedBattery(state,{type='bronze4',destination=state.location}={}){
 const rows=[...Object.entries(state.artilleryDepots??{}).flatMap(([sector,guns])=>guns.map(gun=>({sector,source:'depot',gun}))),...Object.entries(state.sectorStates??{}).flatMap(([sector,scene])=>(scene.artillery??[]).map(gun=>({sector,source:'field',gun})))];
 const usable=rows.filter(row=>row.gun.side==='player'&&row.gun.type===type&&row.gun.ammo+Number(row.gun.loaded)>0&&state.sectors[row.sector]?.owner==='patriot'&&(row.sector===destination||artilleryTransportPath(state,row.sector,destination,'carts')));
 const chosen=usable.sort((a,b)=>b.gun.ammo+Number(b.gun.loaded)-a.gun.ammo-Number(a.gun.loaded)||Number(b.sector===destination)-Number(a.sector===destination)||a.gun.id.localeCompare(b.gun.id))[0];
 return chosen?{sector:chosen.sector,source:chosen.source,record:storedArtilleryRecord(chosen.gun),charges:chosen.gun.ammo+Number(chosen.gun.loaded)}:null;
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
 const strongest=strongestFreshOwnedBattery(c,{destination:'cordoba'}),excludeIds=strongest?[...new Set([...exhausted,...[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(scene=>scene.artillery??[])].filter(gun=>gun.side==='player'&&gun.id!==strongest.record.id).map(gun=>gun.id)])]:exhausted;
 const battery=prepareRouteBattery(c,['bronze4'],{destination:'cordoba',excludeIds,keepServing:retained.keepIds(),report});c=battery.campaign;
 if(strongest){const actual=c.artilleryDepots.cordoba.find(gun=>gun.id===strongest.record.id);assert.ok(actual);assert.deepEqual(actual,strongest.record);assert.equal(battery.selections[0],`depot:${strongest.record.id}`);report({event:'mendozaStrongestOwnedBattery',selected:strongest,selections:battery.selections,record:structuredClone(actual),hour:c.hour,second:c.secondOfHour??0});}
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
export function recoverFoundryCannons(start,target,{report=()=>{}}={}){
 let c=target===3?recoverDelayedFoundryConvoy(start,{report}):start;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 if(target<3&&!c.pendingEncounter){const rear=prepareFoundryBatteryRear(c,{report});retained.adopt(rear.campaign,'foundry-battery-rear-readiness');}
 const resolveEncounter=state=>{const next=resolveFoundryBatteryEncounter(state,{report});retained.adopt(next,'foundry-battery-encounter');return next;};
 const result=prepareRouteBattery(retained.retain(),Array.from({length:target},()=> 'bronze4'),{destination:'mendoza',keepServing:retained.keepIds(),resolveEncounter,report});
 retained.adopt(result.campaign,'foundry-battery');
 assert.ok(ownedArtilleryCount(result.campaign)>=target);return result.campaign;
}

// Battery journeys can release a raid before the later twelve-person convoy
// reaches Tucumán. Prepare only the actual local rear, not a forecast garrison.
// Reloads and all paid roof steps share the existing one-hour staging bound.
export function prepareFoundryBatteryRear(start,{deadlineSeconds=routeClock(start)+3600,report=()=>{}}={}){
 const sector='tucuman',before=structuredClone(start),began=routeClock(start),selected=start.activeSquadId,orders=[],reloads=[];let c=start,staging=null;
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>began&&deadlineSeconds<=began+3600,'The actual rear shares one existing roof-preparation hour.');
 const local=c.recruited.filter(id=>{const r=c.operativeState[id];return canReassignOperative(c,id)&&operativeLocation(c,id)===sector&&!operativeInTransit(c,id)&&!c.contracts[id]?.departurePending&&['active','rest','doctor','patient'].includes(r.assignment??'active')&&!c.militiaTraining.some(course=>course.trainerId===id);});
 const receipt=()=>({sector,ids:local,startSeconds:began,endSeconds:routeClock(c),deadlineSeconds,orders,reloads,staging});
 if(!local.length||!c.sectorStates[sector]?.upperSurfaces?.some(p=>!p.blocked&&['roof','platform'].includes(p.kind)))return {campaign:c,receipt:{...receipt(),skipped:local.length?'no-current-roof':'no-local-rear'}};
 const fit=id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&!r.routed&&!r.unconscious&&!r.surrendered;};
 assert.ok(local.every(fit),'Only actual stable awake local rear soldiers can prepare.');
 const homes=c.squads.filter(q=>q.location===sector&&!q.journey&&q.members.some(id=>local.includes(id)));
 assert.ok(local.every(id=>homes.some(q=>q.members.includes(id))),'The actual rear keeps its existing local homes.');
 assert.ok(homes.every(q=>q.members.every(id=>local.includes(id))),'Do not interrupt another duty inside a rear home.');
 const assignments=local.map(id=>({id,assignment:c.operativeState[id].assignment??'active'})),roster=rosterFor(c),crew=new Set();
 for(const gun of c.sectorStates[sector].artillery??[]){
  if(gun.side!=='player'||!(gun.loaded||gun.ammo>0))continue;
  const contacts=roster.filter(op=>{const r=c.operativeState[op.id],p=r?.residentPosition;return local.includes(op.id)&&!crew.has(op.id)&&op.medical<60&&!['doctor','patient','militia_doctor','militia_patient'].includes(r.assignment)&&r.residentSector===sector&&(r.residentScene??null)===null&&p&&artilleryContact(c.sectorStates[sector],{...op,...r,id:String(op.id),side:'player',...p},gun);}).sort((a,b)=>a.id-b.id).slice(0,artilleryProfile(c,gun).crew);
  if(contacts.length===artilleryProfile(c,gun).crew)for(const op of contacts)crew.add(op.id);
 }
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>{if(event.event==='freshRouteOrder'||event.event==='freshRouteRenewal')orders.push({action:event.action,hour:event.hour,second:event.second});report(event);}});
 const check=()=>{retained.check();assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null,'An actual interruption stops rear preparation before another order.');assert.ok(routeClock(c)<=deadlineSeconds,'Reload and roof staging share the original preparation deadline.');};
 const order=action=>{check();retained.order(action);check();};
 try{
  retained.retain(deadlineSeconds-routeClock(c)+1);check();
  for(const home of homes){
   order({type:'selectSquad',id:home.id});for(const id of c.squad)if(c.operativeState[id].assignment!=='active')order({type:'assignCare',operativeId:id,assignment:'active'});
   const loaded=finishReloadsBeforeMarch(c,{deadlineSeconds,report:event=>{if(event.event==='boundedPreMarchReload')reloads.push(event);report(event);}});retained.adopt(loaded,'foundry-battery-rear-reload');check();
   for(const id of home.members){const body=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);assert.ok(hasFirearm(body)&&!body.weaponDropped&&body.loaded>0,'An actual rear firearm needs its own finite loaded charge before battery time advances.');}
  }
  const ground=local.filter(id=>!crew.has(id)&&(c.operativeState[id].residentPosition?.tacticalLevel??0)===0),reservedPositions=c.recruited.filter(id=>!ground.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&c.operativeState[id].residentSector===sector&&(c.operativeState[id].residentScene??null)===null&&(c.operativeState[id].residentPosition?.tacticalLevel??0)>0).map(id=>({id,...c.operativeState[id].residentPosition}));
  if(ground.length){
   const physicians=ground.filter(id=>{const op=roster.find(op=>op.id===id),assignment=assignments.find(row=>row.id===id).assignment;return op.medical>=careRules(c).minimumSkill&&c.operativeState[id].medkits>0&&['active','rest'].includes(assignment);}).sort((a,b)=>roster.find(op=>op.id===b).medical-roster.find(op=>op.id===a).medical||c.operativeState[b].medkits-c.operativeState[a].medkits||a-b);
   const physicianId=physicians.find(id=>ground.some(other=>other!==id&&roster.find(op=>op.id===other).medical<60&&['active','rest'].includes(assignments.find(row=>row.id===other).assignment)));
   const landingGuardIds=ground.filter(id=>{const op=roster.find(op=>op.id===id),assignment=assignments.find(row=>row.id===id).assignment;return id!==physicianId&&op.medical<60&&['active','rest'].includes(assignment);});
   const prepared=stageRouteRoofDefenders(c,ground,{reservedPositions,landingGuardIds,...(physicianId===undefined?{}:{physicianId}),bounded:{deadlineSeconds},report});retained.adopt(prepared.campaign,'foundry-battery-rear-roof');staging=prepared.receipt;check();
  }
  for(const {id,assignment}of assignments)if(c.operativeState[id].assignment!==assignment)order({type:'assignCare',operativeId:id,assignment});
  if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  for(const id of crew)assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition,'An existing complete gun crew keeps its actual paid post.');
  assert.deepEqual(c.squads,start.squads);assert.deepEqual(start,before);check();
  const evidence={...receipt(),crewIds:[...crew]};report({event:'foundryBatteryRearPrepared',...evidence});return {campaign:c,receipt:evidence};
 }catch(error){recordRouteStrategicEvidence({helper:'prepareFoundryBatteryRear',stage:'preparation-failure',campaign:c,returnedCampaign:error.campaign,context:{receipt:receipt(),nestedReload:error.boundedPreMarchReload,nestedRoof:error.routeRoofDefenders,battle:error.battle},error});throw error;}
}

// Preserve the original twelve when they are still available. Actual losses
// can leave other paid local veterans in their place; the engineer stays home.
function availableFoundryConvoyVeterans(c){
 const engineer=campaignRole(c,'foundryEngineer')?.id,now=routeClock(c);
 const available=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id],contract=c.contracts[op.id],expiry=contractExpiresSeconds(contract);
  return op.id!==engineer&&canReassignOperative(c,op.id)&&operativeLocation(c,op.id)==='mendoza'&&
   r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed&&['active','rest'].includes(r.assignment??'active')&&
   !c.militiaTraining.some(course=>course.trainerId===op.id)&&contract&&!contract.departurePending&&(expiry===null||expiry>now);
 });
 const eligible=new Set(available.map(op=>op.id)),preferred=[11,1,103,111,125,127,140,144,8,122,139,116].filter(id=>eligible.has(id));
 const reserves=available.filter(op=>!preferred.includes(op.id)).sort((a,b)=>c.operativeState[b.id].morale-c.operativeState[a.id].morale||b.marksmanship-a.marksmanship||a.id-b.id);
 return [...preferred,...reserves.map(op=>op.id)];
}

export function selectFoundryConvoyVeterans(c){
 const field=availableFoundryConvoyVeterans(c).slice(0,12);
 assert.equal(field.length,12,'the earned convoy recapture needs its actual twelve available veterans');
 return field;
}

// Replace real losses through ordinary paid immediate arrivals. Do not borrow
// the foundry engineer, interrupt another duty, or advance an untreated rear.
export function prepareFoundryConvoyVeterans(start,{report=()=>{}}={}){
 let c=start;const hires=[],engineer=campaignRole(c,'foundryEngineer')?.id;
 try{
 while(availableFoundryConvoyVeterans(c).length<12){
  const replacement=rosterFor(c).filter(op=>{
   const r=c.operativeState[op.id],quote=contractQuote(c,op,'day');
   return op.id!==engineer&&civicStatus(c,op.id).available&&r.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed&&
    ['active','rest'].includes(r.assignment??'active')&&hiringTravelHours(c,op.id)===0&&quote.available&&quote.total<=c.resources.treasury;
  }).sort((a,b)=>contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||b.marksmanship-a.marksmanship||a.id-b.id)[0];
  assert.ok(replacement,'the earned convoy recapture needs an affordable immediate paid replacement for its twelve-person force');
  const count=availableFoundryConvoyVeterans(c).length,booked=bookRouteHires(c,[replacement.id],{term:'day',destination:'mendoza',report});
  c=finishRouteHireArrivals(booked.campaign,booked.hires,{minimumWaitHours:0,report});hires.push(...booked.hires);
  assert.equal(availableFoundryConvoyVeterans(c).length,count+1);
 }
 return {campaign:c,field:selectFoundryConvoyVeterans(c),hires};
 }catch(error){
  recordRouteStrategicEvidence({helper:'prepareFoundryConvoyVeterans',stage:'preparation-failure',campaign:c,context:{hires},error});
  report({event:'foundryConvoyStopped',campaign:c,hires,reason:error.message});throw error;
 }
}

// Only already-paid roof defenders hold cover. Ordinary ground actors keep
// the existing controller; finite adjacent first aid remains its first work.
export function foundryConvoyDefenseController(initial,{reserveFieldDressings=0}={}){
 assert.ok(Number.isSafeInteger(reserveFieldDressings)&&reserveFieldDressings>=0);
 const ordinary=coastalBatteryController(initial,{sharedArtillerySight:true}),policy=rescueClinicDefenseController(initial),roof=policy.controller,physicianId=policy.roles.physicianId;
 const choose=(battle,unit)=>{
  if(!((unit.tacticalLevel??0)>0))return ordinary(battle,unit);
  const action=roof(battle,unit);
  if(unit.id!==physicianId||action?.type!=='fire')return action;
  // The held physician keeps ordinary medical work, but a proposed rifle
  // miss must also protect known friendly bodies, including this doctor's
  // newly treated patient. Quote only the same current public shot.
  const view=publicRouteView(battle,unit),target=view.units.find(other=>other.id===action.targetId);
  const option=target&&firearmShotOptions(view,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
  return knownRouteBystanderShotSafety(view,unit,target)(option)?action:null;
 };
 return (battle,unit)=>{
  const action=choose(battle,unit);
  if(!reserveFieldDressings||unit.id!==physicianId||unit.medkits>reserveFieldDressings||!(action?.type==='useItem'||action?.type==='weapon'&&action.slot==='medical'))return action;
  const view=publicRouteView(battle,unit),prepared={...unit,activeSlot:'medical'},medicalView={...view,units:view.units.map(other=>other.id===unit.id?prepared:other)};
  const critical=view.units.some(other=>other.side===unit.side&&other.hp>0&&other.hp<15&&itemUsePreview(medicalView,prepared,medicalView.units.find(patient=>patient.id===other.id))?.valid);
  // Preserve Native critical care. A physician retaining the last dressings
  // can still switch to the actual loaded rifle and take a safe public shot.
  if(critical)return action;
  if(!hasFirearm({...unit,activeSlot:'primary'})||!firearmServiceable(unit)||!unit.loaded||unit.jammed||unit.weaponDropped||unit.hp<15||unit.unconscious||unit.knockedDown||unit.entangled)return null;
  if((unit.activeSlot??'primary')!=='primary')return unit.ap>=actionCosts(battle,unit).weapon?{type:'weapon',unitId:unit.id,slot:'primary'}:null;
  const options={shotSafety:knownRouteBystanderShotSafety},shot=usefulRouteRifleShot(view,unit,options);if(shot)return shot;
  // A known enemy already in reach does not require unsafe rifle fire or a
  // pursuit. Native quotes the held stock, actual rise and strike together.
  for(const target of view.units.filter(other=>other.side!==unit.side&&other.hp>0&&!other.unconscious&&!other.routed&&!other.surrendered&&!other.departure).sort((a,b)=>a.hp-b.hp||String(a.id).localeCompare(String(b.id)))){
   const contact=meleePreview(view,unit,target);if(contact.valid&&contact.movePa===0)return {type:'melee',unitId:unit.id,targetId:target.id};
  }
  if(unit.mounted||unit.stance==='standing')return null;
  const paid=stanceCost(unit,'standing'),standing={...unit,stance:'standing',movementMode:'walk',weaponReady:false,momentum:0,ap:unit.ap-paid};
  const posed={...view,units:view.units.map(other=>other.id===unit.id?standing:other)};
  return paid>0&&standing.ap>0&&usefulRouteRifleShot(posed,standing,options)?{type:'stance',unitId:unit.id,stance:'standing'}:null;
 };
}

// Spend only the actual remaining dressings after victory. The physician
// comes before travel; other wounds follow their real hourly survival time.
// Adjacent Native previews and the existing synchronized executor own every
// hand switch, stroke, elapsed second and official midpoint replay.
export function aidFoundryBatteryRear(start,{execute,report=()=>{}}={}){
 let pair=start;const orders=[],kept=start.battle.units.filter(unit=>unit.side==='player'&&unit.hp>0&&!unit.departure).map(unit=>unit.id);
 assert.ok(start.battle.status==='victory'||start.battle.mode==='exploration');
 const patients=()=>pair.battle.units.filter(unit=>kept.includes(unit.id)&&medicalPatientAvailable(unit)&&(unit.hp<15||unit.bleeding>0));
 const act=action=>{pair=execute(pair,action);orders.push(structuredClone(action));for(const id of kept)assert.ok(pair.battle.units.find(unit=>unit.id===id)?.hp>0,'Every actual battery survivor must remain alive during field aid.');};
 const stock=()=>pair.battle.units.filter(unit=>kept.includes(unit.id)).reduce((sum,unit)=>sum+(unit.medkits??0),0);
 const initialStock=stock(),limit=initialStock*2+1;
 if(initialStock&&patients().length&&pair.battle.status==='victory')act({type:'explore'});
 for(let attempt=0;stock()&&patients().length&&attempt<limit;attempt++){
  const battle=pair.battle,percent=strategicBleedingPercent(pair.campaign);
  const doctors=battle.units.filter(unit=>kept.includes(unit.id)&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.fled&&!unit.surrendered&&!unit.asleep&&!unit.captured&&unit.energy>0&&unit.medical>0&&unit.medkits>0);
  const category=patient=>patient.hp<15?0:doctors.some(doctor=>doctor.id===patient.id)&&patient.bleeding>0?1:2;
  const survival=patient=>{const loss=Math.ceil(patient.bleeding*percent/100);return loss?Math.ceil(patient.hp/loss):Infinity;};
  const plans=patients().flatMap(patient=>doctors.flatMap(doctor=>{
   const prepared={...doctor,activeSlot:'medical'},view={...battle,units:battle.units.map(unit=>unit.id===doctor.id?prepared:unit)},target=view.units.find(unit=>unit.id===patient.id),quote=itemUsePreview(view,prepared,target);
   return quote?.valid&&quote.movePa===0?[{doctor,patient}]:[];
  })).sort((a,b)=>category(a.patient)-category(b.patient)||survival(a.patient)-survival(b.patient)||b.doctor.medical-a.doctor.medical||String(a.patient.id).localeCompare(String(b.patient.id)));
  const plan=plans[0];assert.ok(plan,'The actual battery group needs adjacent Native aid before waiting for delivery.');
  const {doctor,patient}=plan,action=doctor.activeSlot!=='medical'?{type:'weapon',unitId:doctor.id,slot:'medical'}:{type:'useItem',unitId:doctor.id,targetId:patient.id};
  act(action);
  const returned=pair.battle.units.find(unit=>unit.id===patient.id),medic=pair.battle.units.find(unit=>unit.id===doctor.id);
  assert.ok(action.type==='weapon'?medic.activeSlot==='medical':medic.medkits<doctor.medkits&&(returned.hp>patient.hp||returned.bleeding<patient.bleeding),'Every field-aid order must earn actual finite progress.');
 }
 report({event:'foundryBatteryFieldAid',orders,dressingsSpent:initialStock-stock(),remainingPatients:patients().map(({id,hp,bleeding})=>({id,hp,bleeding})),elapsedSeconds:pair.battle.elapsedSeconds-start.battle.elapsedSeconds});
 return pair;
}

// Resolve only the convoy's actual Tucuman interruption with the existing
// public tactical policy. The retained set still rejects any earned loss.
export function resolveFoundryConvoyTucumanEncounter(start,{report=()=>{},reserveFieldDressings=0}={}){
 assert.equal(start.pendingEncounter?.sector,'tucuman');
 const selected=start.activeSquadId;let c=start;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 retained.order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 const initial=enterSector(c.pendingBattle,c.sectorStates.tucuman);
 let observed=null;const reserveDecisions=[];
 const executeBattle=(request,previous,options)=>{
  const controller=reserveFieldDressings&&process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR?(battle,unit)=>{
   const action=options.controller(battle,unit);
   if(unit.medical>=60&&unit.medkits<=reserveFieldDressings&&reserveDecisions.length<8)reserveDecisions.push(structuredClone({battle,unit,action}));
   return action;
  }:options.controller;
  const result=fight(request,previous,{...options,controller});observed??=result;
  if(reserveFieldDressings&&result.battle.status!=='victory')recordRouteStrategicEvidence({helper:'resolveFoundryConvoyTucumanEncounter',stage:'battery-reserve-battle-outcome-failure',campaign:c,context:{reserveFieldDressings,reserveDecisions,result},error:'The actual battery raid did not earn victory.'});
  return result;
 };
 const defense=fightNorthernSector(c,'tucuman',{controller:foundryConvoyDefenseController(initial,{reserveFieldDressings}),executeBattle,report,...(reserveFieldDressings?{beforeSettlement:aidFoundryBatteryRear}:{})});
 retained.adopt(defense.campaign,'foundry-convoy-tucuman-defense');
 // Passive evidence from the same successful driver result, after the normal
 // victory, replay, save, settlement and intended-survivor guards. No new order.
 const fieldOrders=defense.summary.beforeSettlement?.orders??[],settled=defense.summary.beforeSettlement?.units??observed.battle.units.filter(unit=>unit.side==='player');
 report({event:'foundryConvoyDefenseMedicine',orders:[...observed.orders,...fieldOrders].filter(action=>action.type==='useItem').map(action=>({...action})),before:initial.units.filter(unit=>unit.side==='player').map(unit=>({id:unit.id,medkits:unit.medkits})),after:settled.map(unit=>({id:unit.id,medkits:unit.medkits}))});
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 retained.order({type:'selectSquad',id:selected});
 return {campaign:c,summary:defense.summary};
}

// The battery leaf receives this actual normal return through its existing
// resolver API. Unsupported sectors and every newly earned loss still stop.
export function resolveFoundryBatteryEncounter(start,{report=()=>{}}={}){
 assert.equal(start.pendingBattle,null);
 assert.ok(start.pendingEncounter&&['tucuman','salta'].includes(start.pendingEncounter.sector),'Only the existing northern battery encounters have an ordinary response.');
 const selected=start.activeSquadId,sector=start.pendingEncounter.sector,groupId=start.pendingEncounter.groupId;let c=start;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman','salta']});
 if(sector==='tucuman'){
  const defense=resolveFoundryConvoyTucumanEncounter(c,{report,reserveFieldDressings:2});
  retained.adopt(defense.campaign,'foundry-battery-tucuman-defense');
 }else retained.order({type:'respondToEncounter',groupId,choice:'retreat',destination:'tucuman'});
 assert.equal(c.pendingBattle,null,'the actual northern encounter must settle');assert.equal(c.pendingEncounter,null);
 retained.order({type:'selectSquad',id:selected});
 report({event:'foundryBatteryEncounterResolved',sector,groupId,hour:c.hour,second:c.secondOfHour??0});return c;
}

// Known roof cover is paid before the convoy's hourly rest. Staging and actual
// interruptions consume the same original72-hour interval, not a new window.
export function prepareFoundryConvoyRest(start,{field,deadlineSeconds=routeClock(start)+72*3600,report=()=>{}}={}){
 const before=structuredClone(start),ids=[...field],startSeconds=routeClock(start),defenses=[];let c=start,staging=null,fortification=null,restRequests=0;
 assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>startSeconds&&deadlineSeconds<=startSeconds+72*3600,'Convoy preparation shares the original72-hour rest allowance.');
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.ok(ids.every(id=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='tucuman'&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding),'The same twelve actual stable arrivals must prepare locally.');
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const checkTime=()=>assert.ok(routeClock(c)<=deadlineSeconds,'Actual convoy staging, rest and defense share the original72-hour interval.');
 const settle=()=>{
  if(!c.pendingEncounter)return;
  report({event:'foundryConvoyEncounter',sector:c.pendingEncounter.sector,campaign:c});
  const defense=resolveFoundryConvoyTucumanEncounter(c,{report});retained.adopt(defense.campaign,'foundry-convoy-tucuman-defense');defenses.push(defense.summary);checkTime();
 };
 const order=action=>{settle();retained.order(action);checkTime();settle();};
 try{
  // Buy the existing native cover before staging or a real rest raid.
  const fortified=prepareNorthernHospitalFortification(c,{sector:'tucuman',report});
  retained.adopt(fortified.campaign,'foundry-convoy-fortification');fortification=fortified.receipt;checkTime();
  if(c.sectorStates.tucuman?.upperSurfaces?.some(point=>!point.blocked&&['roof','platform'].includes(point.kind))){
   const reservedPositions=c.recruited.filter(id=>!ids.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='tucuman'&&c.operativeState[id].residentSector==='tucuman'&&(c.operativeState[id].residentScene??null)===null&&(c.operativeState[id].residentPosition?.tacticalLevel??0)>0).map(id=>{const p=c.operativeState[id].residentPosition;return {id,x:p.x,y:p.y,tacticalLevel:p.tacticalLevel};});
   retained.retain(Math.min(3600,deadlineSeconds-routeClock(c))+1);
   const prepared=stageRouteRoofDefenders(c,ids,{report,reservedPositions,bounded:{deadlineSeconds}});
   retained.adopt(prepared.campaign,'foundry-convoy-roof-rest');staging=prepared.receipt;checkTime();
  }
  for(const id of ids)order({type:'assignCare',id,assignment:'rest'});
  for(;restRequests<72&&ids.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep);restRequests++){
   assert.ok(routeClock(c)+3600<=deadlineSeconds,'The next actual convoy rest hour must fit the original72-hour deadline.');order({type:'wait',hours:1});
  }
  assert.ok(ids.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep));
  for(const id of ids)order({type:'assignCare',id,assignment:'active'});
  retained.check();checkTime();assert.deepEqual(start,before);
  const evidence={field:ids,startSeconds,endSeconds:routeClock(c),deadlineSeconds,restRequests,fortification,staging,defenses};report({event:'foundryConvoyRestPrepared',...evidence});return {campaign:c,evidence};
 }catch(error){
  recordRouteStrategicEvidence({helper:'prepareFoundryConvoyRest',stage:'preparation-failure',campaign:c,returnedCampaign:error.campaign,context:{field:ids,startSeconds,deadlineSeconds,restRequests,fortification,staging,defenses,nestedBattle:error.battle,scope:'Last normal caller prefix plus raw nested diagnostic references only; no failed-state continuation.'},error});throw error;
 }
}

// A defense only deploys local, uncommitted people. A moving or ready
// approach remains at its paid boundary and must not be disbanded to re-arm.
export function prepareFoundryConvoyArmament(start,{field,columns,sector,report=()=>{}}={}){
 const before=structuredClone(start),ids=[...field],events=[],defenses=[],at=routeClock(start);
 assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);assert.equal(columns.length,2);assert.equal(new Set(columns).size,2);
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.deepEqual(new Set(columns.flatMap(id=>c.squads.find(q=>q.id===id).members)),new Set(ids));
 for(const id of columns){const home=c.squads.find(q=>q.id===id);assert.equal(home.location,sector);assert.ok(!home.journey||sector==='tucuman'&&['moving','ready'].includes(home.journey.status)&&home.journey.intent==='attack'&&home.journey.path.at(-1)==='salta','Only actual ongoing Salta approaches can remain committed during armament.');}
 const local=columns.filter(id=>!c.squads.find(q=>q.id===id).journey),retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const settle=()=>{
  if(!c.pendingEncounter)return;
  report({event:'foundryConvoyEncounter',sector:c.pendingEncounter.sector,campaign:c});
  const defended=resolveFoundryConvoyTucumanEncounter(c,{report});retained.adopt(defended.campaign,'foundry-convoy-tucuman-defense');defenses.push(defended.summary);
 };
 const order=action=>{settle();return retained.order(action);},emit=event=>{events.push(event);report(event);};
 const adopt=(next,stage)=>{retained.adopt(next,stage);settle();assert.equal(c.pendingBattle,null);};
 for(const id of local){
  const home=c.squads.find(q=>q.id===id);
  assert.ok(home.members.every(operativeId=>canReassignOperative(c,operativeId)&&operativeLocation(c,operativeId)===sector&&c.operativeState[operativeId].hp>=15&&!c.operativeState[operativeId].bleeding&&!c.operativeState[operativeId].asleep),'The actual uncommitted veterans need stable local bodies before re-armament.');
  order({type:'selectSquad',id});
  for(const operativeId of c.squad){
   const carried=carriedAmmunition(rosterFor(c).find(op=>op.id===operativeId),c.operativeState[operativeId]);
   adopt(recoverRoutePrimary(c,operativeId,{replace:!['ammoMusket','ammoRifle'].includes(ammoTypeFor(carried)),report:emit}),'foundry-convoy-primary');
  }
  const supplied=supplyRouteAmmunition(c,c.squad,{target:12,report:emit});adopt(supplied.campaign,'foundry-convoy-finite-ammunition');
  adopt(finishReloadsBeforeMarch(c,{report:emit}),'foundry-convoy-paid-reload');
 }
 for(const id of ids){const r=c.operativeState[id],carried=carriedAmmunition(rosterFor(c).find(op=>op.id===id),r);assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.asleep&&!carried.weaponDropped&&['ammoMusket','ammoRifle'].includes(ammoTypeFor(carried))&&carried.loaded>0&&carried.loaded+availableAmmunition(carried)>=12,'Every convoy veteran needs a real loaded long gun and twelve actual total rounds.');}
 retained.check();assert.deepEqual(start,before);
 const evidence={sector,ids,columns:local,committed:columns.filter(id=>!local.includes(id)),startSeconds:at,endSeconds:routeClock(c),events};
 report({event:'foundryConvoyArmament',...evidence,campaign:c});return {campaign:c,evidence,defenses};
}

// Match the established multi-cut convoy's long-gun, twelve-round and paid
// reload preparation. The same twelve people and original three wait windows
// remain authoritative; daylight shares the existing approach request budget.
export function prepareFoundryConvoyAssault(start,{field,report=()=>{}}={}){
 const before=structuredClone(start),ids=[...field],columns=[],armament=[],defenses=[];
 assert.equal(start.location,'mendoza');assert.equal(start.pendingEncounter,null);assert.equal(start.pendingBattle,null);
 assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);
 const physical=c=>[...Object.values(c.artilleryDepots??{}).flat(),...(c.artilleryTransfers??[]).map(row=>row.gun),...Object.values(c.sectorStates??{}).flatMap(scene=>scene.artillery??[])].filter(gun=>gun.side==='player').map(storedArtilleryRecord).sort((a,b)=>a.id.localeCompare(b.id));
 const guns=physical(start),dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>id);
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const settle=()=>{
  if(!c.pendingEncounter)return;
  report({event:'foundryConvoyEncounter',sector:c.pendingEncounter.sector,campaign:c});
  const defended=resolveFoundryConvoyTucumanEncounter(c,{report});
  retained.adopt(defended.campaign,'foundry-convoy-tucuman-defense');defenses.push(defended.summary);
 };
 const order=action=>{settle();return retained.order(action);};
 const prepareArms=sector=>{
  const prepared=prepareFoundryConvoyArmament(c,{field:ids,columns,sector,report});
  retained.adopt(prepared.campaign,'foundry-convoy-armament');armament.push(prepared.evidence);defenses.push(...prepared.defenses);
 };
 for(let offset=0;offset<ids.length;offset+=6){order({type:'createSquad',name:'Recuperación del convoy',ids:ids.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);}
 for(const id of ids)order({type:'assignCare',id,assignment:'active'});
 prepareArms('mendoza');
 for(const id of columns){order({type:'selectSquad',id});order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});}
 let journeyRequests=0;
 for(;journeyRequests<168&&columns.some(id=>c.squads.find(q=>q.id===id).journey);journeyRequests++){order({type:'wait',hours:1});settle();}
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='tucuman'&&!c.squads.find(q=>q.id===id).journey));
 const rest=prepareFoundryConvoyRest(c,{field:ids,deadlineSeconds:routeClock(c)+72*3600,report});
 retained.adopt(rest.campaign,'foundry-convoy-protected-rest');defenses.push(...rest.evidence.defenses);const restRequests=rest.evidence.restRequests;
 prepareArms('tucuman');
 const queueApproach=()=>{
  for(const id of columns){
   const home=c.squads.find(q=>q.id===id);assert.equal(home.location,'tucuman');
   if(!home.journey){order({type:'selectSquad',id});order({type:'attack',sector:'salta',queue:true,mode:'posta'});}
  }
 };
 const ready=()=>columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');
 const daylight=()=>c.hour%24>=6&&c.hour%24<=10;
 queueApproach();let approachRequests=0,daylightWaits=0;
 for(;approachRequests<72&&(!ready()||!daylight());approachRequests++){
  if(ready()&&!daylight())daylightWaits++;
  const fought=defenses.length;order({type:'wait',hours:1});settle();
  // A local defense cancels only its deployed homes' journeys. Re-arm the
  // uncommitted columns and requeue only missing approaches within this loop.
  if(defenses.length!==fought){prepareArms('tucuman');queueApproach();}
 }
 assert.ok(ready());assert.ok(daylight(),'The original approach budget must earn an actual daylight assault.');
 retained.check();assert.deepEqual(physical(c),guns);for(const id of dead)assert.equal(c.operativeState[id].alive,false);
 order({type:'beginAssault',sector:'salta'});assert.equal(c.pendingBattle.sector,'salta');
 assert.deepEqual(new Set(c.pendingBattle.squad.map(op=>Number(op.id))),new Set(ids));
 for(const op of c.pendingBattle.squad)assert.ok(!op.weaponDropped&&['ammoMusket','ammoRifle'].includes(ammoTypeFor(op))&&op.loaded>0&&op.loaded+availableAmmunition(op)>=12);
 assert.deepEqual(start,before);
 const evidence={field:ids,columns,journeyRequests,restRequests,approachRequests,daylightWaits,armament,defenses,startSeconds:routeClock(start),endSeconds:routeClock(c)};
 report({event:'foundryConvoyAssaultPrepared',...evidence,campaign:c});return {campaign:c,evidence};
}

// A retained piece cannot arrive through occupied Salta. Recapture the real
// convoy route with the available paid veterans, then give every actual
// wounded survivor finite care before returning to foundry preparation.
export function recoverDelayedFoundryConvoy(start,{report=()=>{}}={}){
 const transfer=start.artilleryTransfers.find(t=>t.gun.type==='bronze4'&&artilleryTransferDelayCode(start,t)==='route_cut');
 if(!transfer)return start;
 assert.equal(transfer.from,'salta');assert.equal(transfer.to,'cordoba');
 if(transfer.path.filter(id=>start.sectors[id].owner!=='patriot').length>1){
  return recaptureFoundryConvoy(start,{transferId:transfer.id,createOrders:createFreshRouteOrders,recoverPatients:recoverNorthernLocalPatients,report}).campaign;
 }
 assert.deepEqual(transfer.path.filter(id=>start.sectors[id].owner!=='patriot'),['salta']);
 const original=structuredClone(start),origin=start.activeSquadId,priorDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 let c=saved({campaign:start}).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman']});
 const prepared=prepareFoundryConvoyVeterans(c,{report});retained.adopt(prepared.campaign,'foundry-convoy-replacements');
 const field=prepared.field;
 assert.equal(field.length,12,'the earned convoy recapture needs its actual twelve available veterans');
 assert.ok(field.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding));
 const assault=prepareFoundryConvoyAssault(c,{field,report});retained.adopt(assault.campaign,'foundry-convoy-assault');
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
 c=bankRouteIncome(retained.retain(),foundryFor(c).setupCost+250,{keepIds:retained.keepIds(),report});
 c=meetRecruits(c,['beltran'],envoy);
 const before=c.resources.treasury;order({type:'foundry'});
 assert.equal(c.resources.treasury,before-foundryFor(c).setupCost);
 // Weekly unanswered claims can lower the real Pardos reputation before
 // Cuyo. Pay both existing guarantees before asking Barcala to join; an
 // emancipation decree alone need not meet his actual recruitment gate.
 if(!c.flags.emancipation)order({type:'diplomacy',kind:'emancipation'});
 if(!c.flags.commission)order({type:'diplomacy',kind:'commission'});
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
  const next=resolveFoundryBatteryEncounter(c,{report});retained.adopt(next,'foundry-battery-encounter');
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
