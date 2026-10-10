import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {adjacentCells,cellLegHours} from '../game/world-cells.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {recoverRescueForce} from './rescue-recovery.mjs';
import {prepareSaltaAssault,completeNorthernMission} from './salta-route.mjs';
import {runOpeningCampaign} from './opening-campaign.mjs';
import {prepareNorthernSupport} from './northern-support-fixture.mjs';
import {stageNorthernCare,prepareNorthernSquad,prepareTucumanSquad,prepareRescueSquad,stabilizeRescued,fightNorthernSector,advanceOnCitadelOrder,northernReconOrder,northernCombatOrder} from './northern-route.mjs';

const assertBattleClock=({campaign,summary})=>{assert.ok(summary.turns>=1&&summary.actions>0);assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),summary.startSeconds+summary.elapsedSeconds);};
const preserveDeaths=(before,after)=>{for(const [id,r] of Object.entries(before.operativeState))if(!r.alive)assert.equal(after.operativeState[id].alive,false);};

test('established southern campaign reaches Yatasto through combat, defeat, rescue and paid recovery',async t=>{
 const opening=runOpeningCampaign(),evidence={battles:[],medical:[],captures:[],rescues:[]};let cordoba,tucumanLoss,rescued,recovered,salta,captiveIds,northernStaging;
 await t.test('real San Lorenzo remains supply a legally present relief doctor after the completed mission',()=>{
  const original=structuredClone(opening.campaign),staged=stageNorthernCare(opening.campaign),start=staged.campaign,before=structuredClone(start),town=structuredClone(start.sectorStates.san_nicolas);
  northernStaging=staged;assert.deepEqual(opening.campaign,original);preserveDeaths(original,start);assert.equal(staged.staging.hiringCost,routeHiringCeiling(original,294));
  if(original.location!==start.location)assert.ok(start.hour>original.hour,'paid relief doctors make a real march before collecting local equipment');
  const roster=rosterFor(start),candidates=sectorInventoryModel(start,'san_lorenzo',roster).candidates;
  const model=candidates.map(candidate=>sectorInventoryModel(start,'san_lorenzo',roster,candidate.id)).find(model=>!model.reason&&model.entries.some(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'));
  assert.ok(model,'a paid doctor who reached the sector can collect remaining medical supplies');const operativeId=model.operativeId;
  assert.equal(model.reason,null);
  const row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row);
  const action={type:'sectorInventory',sector:'san_lorenzo',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1};
  const picked=dispatchCampaign(start,action);assert.equal(picked.lastError,null);
  assert.equal(picked.operativeState[operativeId].medkits,start.operativeState[operativeId].medkits+1);
  assert.deepEqual(picked.sectorStates.san_nicolas,town);assert.deepEqual(start,before);
  assert.equal(sectorInventoryModel(picked,'san_lorenzo',rosterFor(picked),operativeId).entries.find(r=>r.key===row.key)?.count??0,row.count-1);
  assert.ok(dispatchCampaign(picked,action).lastError);
  for(const id of opening.casualties)assert.equal(picked.operativeState[id].alive,false);
  assert.deepEqual(decodeSave(encodeSave(picked)).campaign,picked);
 });
 await t.test('survivors recover with finite supplies and paid replacements capture Córdoba',()=>{
  const before=structuredClone(opening.campaign),prepared=prepareNorthernSquad(opening.campaign,{ammunitionTarget:6});
  evidence.medical.push({stage:'northernPreparation',...prepared.recovery});
  assert.deepEqual(opening.campaign,before);assert.ok(prepared.recovery.patients.length?prepared.recovery.usedDressings>0:prepared.recovery.usedDressings===0);
  assert.equal(prepared.recovery.staging.hiringCost,routeHiringCeiling(before,294));preserveDeaths(before,prepared.campaign);
  assert.equal(prepared.recovery.boughtDressings,0);assert.ok(prepared.recovery.laterRecoveredDressings>=prepared.recovery.medicalTrips.reduce((sum,trip)=>sum+trip.quantity,0));
  for(const trip of prepared.recovery.medicalTrips){assert.ok(trip.endHour>trip.startHour);assert.equal(trip.cost,trip.quantity*trip.unitPrice);}
  for(const receipt of prepared.recovery.ammunitionTransactions){
   assert.equal(receipt.sector,'san_nicolas');assert.ok(prepared.campaign.squad.includes(receipt.action.operativeId));
   assert.equal(receipt.cost,receipt.action.direction==='buy'?receipt.action.quantity*receipt.unitPrice:0);
  }
  for(const id of prepared.campaign.squad){
   const op=rosterFor(prepared.campaign).find(op=>op.id===id),unit=carriedAmmunition(op,prepared.campaign.operativeState[id]);
   const family=ammoTypeFor({...unit,activeSlot:'primary'});
   if(family&&!unit.weaponDropped)assert.ok(unit.loaded+ammoCount(unit,family)>=6,'each actual gun has its selected matching load before the march');
  }
  assert.equal(prepared.recovery.donatedDressings,prepared.recovery.donors.reduce((sum,donor)=>sum+donor.count,0));
  for(const donor of prepared.recovery.donors){assert.equal(before.operativeState[donor.id].alive,true);assert.equal(donor.count,before.operativeState[donor.id].medkits);assert.equal(prepared.campaign.operativeState[donor.id].medkits,0);}
  for(const id of prepared.recovery.patients)assert.equal(prepared.campaign.operativeState[id].hp,prepared.campaign.operativeState[id].maxHp);
  assert.deepEqual(prepared.campaign.squad,prepared.recovery.fieldIds);assert.equal(new Set(prepared.campaign.squad).size,6);
  for(const id of prepared.recovery.replacements){assert.ok(!before.recruited.includes(id));assert.equal(before.operativeState[id].alive,true);assert.ok(prepared.campaign.contracts[id]);}
  for(const id of prepared.campaign.squad)assert.equal(prepared.campaign.operativeState[id].alive,true);
  const support=prepareNorthernSupport(prepared.campaign,'cordoba',{maxWeeklyPrice:routeHiringCeiling(prepared.campaign,250),preferMarksmanship:true});
  assert.equal(support.campaign.pendingBattle.squad.length,12);
  const result=fightNorthernSector(support.campaign,'cordoba',{controller:northernCombatOrder});evidence.battles.push({...result.summary,support:{ids:support.ids,cost:support.cost}});
  for(const id of opening.casualties)assert.equal(result.campaign.operativeState[id].alive,false);
  assert.equal(result.campaign.phase,2);assert.equal(result.campaign.completed,false);cordoba=result.campaign;
 });
 await t.test('paid recovery reaches Tucumán; an exposed advance preserves actual deaths and captivity',subtest=>{
  if(!cordoba)return subtest.skip('Córdoba recovery and victory must pass first');
  assert.ok(cordoba);const before=structuredClone(cordoba),prepared=prepareTucumanSquad(cordoba);
  assert.deepEqual(cordoba,before);assert.equal(prepared.recovery.startHour,cordoba.hour);assert.ok(prepared.recovery.endHour>cordoba.hour);
  for(const id of prepared.recovery.patients)assert.equal(prepared.campaign.operativeState[id].hp,prepared.campaign.operativeState[id].maxHp);
  assert.equal(prepared.recovery.boughtDressings,prepared.events.filter(event=>event.action.type==='purchaseMedicalSupplies').reduce((sum,event)=>sum+event.action.quantity,0));
  assert.ok(prepared.recovery.patients.length?prepared.recovery.usedDressings>0:prepared.recovery.usedDressings===0,'care consumes supplies only when the battle left surviving patients');
  for(const id of prepared.recovery.replacements){assert.equal(before.operativeState[id].alive,true);assert.ok(!before.recruited.includes(id));assert.ok(prepared.campaign.contracts[id]);}
  const patrolMedical=prepared.recovery.patrolMedicalReadiness;assert.deepEqual(patrolMedical.field,prepared.campaign.squad);
  assert.equal(patrolMedical.cost,0);assert.equal(patrolMedical.elapsedSeconds,0);assert.equal(patrolMedical.policy.perPatrolMember,2);
  assert.equal(patrolMedical.totalTaken,patrolMedical.takes.reduce((sum,row)=>sum+row.count,0));
  for(const row of patrolMedical.takes){assert.equal(row.sourceAfter,row.sourceBefore-row.count);assert.equal(row.medicalPoolAfter,row.medicalPoolBefore-row.count);assert.equal(row.carriedAfter,row.carriedBefore+row.count);}
  for(const id of prepared.campaign.squad)assert.ok(prepared.campaign.operativeState[id].medkits>=2,'the exposed patrol carries finite first-aid stock before its original march');
  // The faster road schedule can bring the depot raid during clinic care,
  // before the exposed patrol leaves. Verify it in its actual phase.
  for(const defense of prepared.recovery.clinicDefenses){
   assert.equal(defense.sector,'cordoba');assert.equal(defense.status,'victory');assert.ok(defense.actions>0&&defense.elapsedSeconds>0);
   assert.equal(prepared.campaign.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');
   assert.ok(prepared.campaign.encounterHistory.some(event=>event.groupId===defense.groupId&&event.outcome==='victory'));
   for(const unit of defense.units.filter(unit=>unit.side==='player'&&unit.hp<=0))assert.equal(prepared.campaign.operativeState[unit.id].alive,false,'actual clinic defense casualties stay dead');
   evidence.battles.push(defense);
  }
  const result=fightNorthernSector(prepared.campaign,'tucuman',{expectedOutcome:'defeat',controller:advanceOnCitadelOrder}),returned=result.campaign;
  assert.equal(result.summary.startSeconds/3600%24>=20,true,'the exposed patrol reaches the citadel at night');
  assertBattleClock(result);evidence.battles.push(result.summary);evidence.medical.push({stage:'cordoba',...prepared.recovery});
  assert.equal(returned.hour,prepared.campaign.hour+12);preserveDeaths(cordoba,returned);
  const field=result.summary.units.filter(unit=>unit.side==='player'&&prepared.recovery.fieldIds.includes(Number(unit.id))),dead=field.filter(unit=>unit.hp<=0);
  assert.equal(field.length,prepared.recovery.fieldIds.length,'the native outcome accounts for every actual deployed patrol member');preserveDeaths(prepared.campaign,returned);
  captiveIds=field.filter(unit=>unit.hp>0).map(unit=>Number(unit.id));evidence.captures.push({sector:'tucuman',ids:captiveIds});assert.ok(captiveIds.length>0);
  assert.equal(dead.length+captiveIds.length,prepared.recovery.fieldIds.length,'every actual patrol member is dead or captured after the genuine defeat');
  for(const id of prepared.recovery.fieldIds){assert.ok(!returned.recruited.includes(id));assert.ok(!returned.squads.some(squad=>squad.members.includes(id)));}
  for(const unit of dead)assert.equal(returned.operativeState[unit.id].alive,false);
  for(const id of captiveIds){
   const record=returned.operativeState[id];assert.equal(record.alive,true);assert.equal(record.captured,true);assert.equal(record.capturedSector,'tucuman');
   assert.equal(record.hp,field.find(unit=>Number(unit.id)===id).hp);
   assert.ok(!returned.recruited.includes(id));assert.ok(!returned.squads.some(squad=>squad.members.includes(id)));
   assert.ok(record.capturedContract);assert.equal(returned.contracts[id],undefined);
  }
  assert.equal(returned.operativeState[139].location,'cordoba');assert.equal(returned.operativeState[139].captured,false);
  assert.equal(returned.sectors.cordoba.owner,'patriot');assert.deepEqual(returned.squad,[]);
  assert.equal(returned.phase,2);assert.equal(returned.completed,false);assert.equal(returned.defeated,false);tucumanLoss=returned;
 });
 await t.test('reserves recapture the persistent garrison and stabilize the released captives with finite supplies',subtest=>{
  if(!tucumanLoss)return subtest.skip('The real Tucumán defeat and captivity must pass first');
  assert.ok(tucumanLoss);const before=structuredClone(tucumanLoss),prepared=prepareRescueSquad(tucumanLoss);
  assert.deepEqual(tucumanLoss,before);assert.ok(prepared.staging.startHour>=tucumanLoss.hour+12);
  if(prepared.staging.corridor.loss){assert.equal(prepared.staging.corridor.loss.status,'defeat');assert.equal(prepared.staging.corridor.recapture.status,'victory');assert.ok(prepared.staging.corridor.recapture.actions>0);assert.equal(prepared.campaign.sectors.buenos_aires.owner,'patriot');assert.equal(prepared.campaign.enemyGroups.find(group=>group.id===prepared.staging.corridor.loss.groupId).status,'defeated');assert.ok(prepared.campaign.encounterHistory.some(event=>event.groupId===prepared.staging.corridor.loss.groupId&&event.outcome==='defeat'));}
  assert.equal(prepared.campaign.hour,prepared.staging.departureHour+12,'the rescue still makes its complete second march after resting and defending the depot');
  assert.ok(prepared.staging.defenses.length>0||prepared.staging.corridor.loss||evidence.battles.some(battle=>battle.groupId&&battle.sector==='cordoba'&&battle.status==='victory'),'the actual incoming raid receives a real tactical response in its arrival phase');
  assert.equal(prepared.campaign.pendingEncounter,null);
  assert.ok(!prepared.campaign.enemyGroups.some(group=>group.target==='cordoba'&&['marching','waiting'].includes(group.status)),'the rescue does not leave an unresolved depot raid behind');
  for(const defense of prepared.staging.defenses){
   assert.equal(defense.sector,'cordoba');assert.equal(defense.status,'victory');assert.ok(defense.actions>0&&defense.elapsedSeconds>0);
   assert.equal(prepared.campaign.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');
   assert.ok(prepared.campaign.encounterHistory.some(event=>event.groupId===defense.groupId&&event.outcome==='victory'));
  }
  assert.ok(prepared.staging.renewals.every(renewal=>renewal.cost>0),'every necessary extension uses a paid renewal');
  assert.deepEqual(prepared.staging.renewals.map(r=>r.id),prepared.events.filter(e=>e.action.type==='renewContract').map(e=>e.action.id));
  for(const id of [...prepared.fieldIds,...prepared.supportIds])assert.ok(prepared.campaign.contracts[id].expiresAt===null||prepared.campaign.contracts[id].expiresAt>prepared.campaign.hour,'each deployed contract must still cover the actual arrival');
  assert.ok(prepared.hiringCost>0);assert.equal(prepared.hiringCost,prepared.hiringLedger.reduce((sum,receipt)=>sum+receipt.paid,0),'every real hire stays in the expense ledger, including fallen volunteers');
  for(const id of prepared.hired){assert.equal(before.operativeState[id].alive,true);assert.ok(!before.recruited.includes(id));assert.ok(prepared.campaign.contracts[id]);}
  assert.equal(prepared.fieldIds.length,6);assert.equal(prepared.supportIds.length,6);
  assert.ok(prepared.supportHires.length>0);
  for(const id of prepared.supportHires){assert.ok(prepared.hired.includes(id));assert.equal(prepared.campaign.contracts[id].term,'day');assert.ok(prepared.campaign.contracts[id].expiresAt>prepared.campaign.hour);}
  for(const id of [...prepared.fieldIds,...prepared.supportIds])assert.ok(prepared.campaign.pendingBattle.squad.some(unit=>Number(unit.id)===id));
  for(const unit of prepared.campaign.pendingBattle.squad){const family=ammoTypeFor(unit);assert.ok(family,'each relief soldier enters with a selected firearm');assert.ok(unit.loaded+ammoCount(unit,family)>=10,'the deployed relief retains ten real matching cartridges after its march');}
  for(const receipt of prepared.ammunitionTransactions){assert.equal(receipt.sector,'cordoba');assert.ok(receipt.quantity>0);assert.equal(receipt.cost,0);assert.ok([...prepared.fieldIds,...prepared.supportIds].includes(receipt.action.operativeId));}
  for(const defense of prepared.staging.defenses)for(const unit of defense.units.filter(unit=>unit.side==='player'&&unit.hp<=0))assert.equal(prepared.campaign.operativeState[unit.id].alive,false,'actual defense casualties stay dead');
  for(const id of [...prepared.fieldIds,...prepared.supportIds])assert.equal(prepared.campaign.operativeState[id].hp,prepared.campaign.operativeState[id].maxHp,'paid care restores the living relief before its next assault');
  assert.ok(prepared.staging.recovery.patients.length?prepared.staging.recovery.usedDressings>0:prepared.staging.recovery.usedDressings===0,'only actual staging wounds consume dressings');
  assert.equal(prepared.staging.replacements.length,(prepared.staging.losses??[]).length,'each actual staging loss receives one paid replacement');
  for(const replacement of prepared.staging.replacements){assert.ok(replacement.cost>0);assert.ok(prepared.hiringLedger.some(receipt=>receipt.id===replacement.id&&receipt.paid===replacement.cost));}
  assert.ok(prepared.staging.artillery.cost>=0);const piece=prepared.campaign.pendingBattle.artillery.find(gun=>gun.id===prepared.staging.artillery.record.id);assert.ok(piece,'the actual recovered gun enters the rescue');assert.equal(piece.type,prepared.staging.artillery.record.type);assert.equal(piece.loaded,prepared.staging.artillery.record.loaded);assert.equal(piece.ammo,prepared.staging.artillery.record.ammo);
  const result=fightNorthernSector(prepared.campaign,'tucuman',{controller:stableCrewController()}),returned=result.campaign;
  assertBattleClock(result);preserveDeaths(tucumanLoss,returned);evidence.battles.push(result.summary,...prepared.staging.defenses);evidence.corridor=prepared.staging.corridor;evidence.medical.push({stage:'rescuePreparation',purchases:prepared.medicalPurchases});evidence.rescues.push({sector:'tucuman',ids:prepared.captives.map(p=>p.id)});
  assert.equal(returned.hour,prepared.campaign.hour);
  for(const {id,record} of prepared.captives){
   const released=returned.operativeState[id];assert.equal(released.captured,false);assert.equal(released.hp,record.hp);assert.equal(released.bleeding,record.bleeding);
   assert.deepEqual(released.outfit,record.outfit);assert.deepEqual(released.inventory,record.inventory);assert.equal(released.condition,record.condition);
   assert.deepEqual(released.capturedAmmunition,{loaded:0,ammo:0});assert.equal(released.capturedContract,null);
   const expiry=contractExpiresSeconds(record.capturedContract),releaseSeconds=returned.hour*3600+(returned.secondOfHour??0),capturedSeconds=record.capturedAt*3600+(record.capturedAtSecond??0);
   assert.equal(contractExpiresSeconds(returned.contracts[id]),expiry===null?null:releaseSeconds+Math.max(0,expiry-capturedSeconds));
  }
  const stable=stabilizeRescued(returned,{patients:captiveIds});assert.ok(stable.campaign.hour>returned.hour&&stable.campaign.hour<=returned.hour+captiveIds.length+1);
  preserveDeaths(returned,stable.campaign);evidence.medical.push({stage:'releasedCaptives',usedDressings:stable.usedDressings});
  assert.equal(stable.campaign.phase,2);assert.equal(stable.campaign.completed,false);rescued=stable.campaign;
 });
 await t.test('a real medical courier recovers finite supplies while paid care restores the freed squad',subtest=>{
  if(!rescued)return subtest.skip('The rescue and stabilization must pass first');
  assert.ok(rescued);const before=structuredClone(rescued),result=recoverRescueForce(rescued,{patients:captiveIds});
  assert.deepEqual(rescued,before);assert.equal(result.recovery.endHour,result.campaign.hour);assert.ok(result.recovery.endHour>=rescued.hour+24+6,'the courier makes both real marches and the squad rests');
  assert.equal(result.recovery.boughtDressings,0);assert.ok(result.recovery.foundDressings>0&&result.recovery.foundDressings<=13);assert.equal(result.recovery.unitPrice,0);assert.equal(result.recovery.cost,result.recovery.boughtDressings*result.recovery.unitPrice);
  const availableDoctors=rosterFor(before).filter(op=>{const r=before.operativeState[op.id];return before.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&!captiveIds.includes(op.id)&&op.medical>=70;});
  const availableDoctorIds=new Set(availableDoctors.map(op=>op.id)),rearIds=new Set();
  for(const receipt of result.recovery.rearPhysicians){
   const op=rosterFor(before).find(op=>op.id===receipt.id),record=before.operativeState[receipt.id];
   assert.ok(op&&op.medical>=70&&before.recruited.includes(receipt.id)&&record.alive&&!record.captured&&!captiveIds.includes(receipt.id),'rear relief must come from a genuinely serving qualified physician');
   assert.equal(record.location,'cordoba');assert.ok(record.hp>=15&&!record.asleep&&record.energy>10);assert.ok(before.contracts[receipt.id].paid>0);
   assert.ok(!rearIds.has(receipt.id)&&!availableDoctorIds.has(receipt.id),'count each actual physician once');rearIds.add(receipt.id);
   assert.equal(receipt.sourceSector,'cordoba');assert.equal(receipt.arrivalSector,'tucuman');
   const {marchQuote}=receipt;assert.equal(marchQuote.valid,true);assert.equal(marchQuote.reason,null);assert.ok(marchQuote.hours>0);
   assert.equal(marchQuote.path[0],receipt.sourceSector);assert.equal(marchQuote.path.at(-1),receipt.arrivalSector);
   assert.ok(marchQuote.path.slice(1).every((point,index)=>adjacentCells(marchQuote.path[index],point)));
   assert.equal(marchQuote.path.slice(1).reduce((hours,point,index)=>hours+cellLegHours(marchQuote.path[index],point,'march'),0),marchQuote.hours);
   assert.deepEqual(marchQuote.action,{type:'travel',sector:'tucuman',mode:'march',queue:true});
   assert.ok(receipt.orders.some(row=>row.scope==='campaign'&&JSON.stringify(row.action)===JSON.stringify(marchQuote.action)),'the quoted march must appear in the actual order receipt');
   assert.deepEqual(receipt.orders.filter(row=>row.scope==='tactical').map(row=>row.action),receipt.aidSteps);
   assert.ok(Number.isSafeInteger(receipt.aidElapsedSeconds)&&receipt.aidElapsedSeconds>=0);
   if(record.bleeding)assert.ok(receipt.aidElapsedSeconds>0&&receipt.aidSteps.some(action=>action.type==='useItem'&&action.unitId===String(receipt.id)&&action.targetId===String(receipt.id)),'the injured rear physician must perform ordinary self aid');
   if(receipt.sourceTake){const take=receipt.sourceTake;assert.equal(take.action.type,'sectorInventory');assert.equal(take.action.direction,'take');assert.equal(take.action.sector,receipt.sourceSector);assert.equal(take.action.operativeId,receipt.id);assert.equal(JSON.parse(take.action.expected).item,'medkits');assert.equal(take.action.count,1);assert.equal(take.medicalPoolAfter,take.medicalPoolBefore-1);assert.equal(take.carriedAfter,take.carriedBefore+1);assert.ok(receipt.orders.some(row=>row.scope==='campaign'&&JSON.stringify(row.action)===JSON.stringify(take.action)));}
   assert.equal(receipt.marchElapsedSeconds,marchQuote.hours*3600);assert.equal(receipt.elapsedSeconds,receipt.aidElapsedSeconds+receipt.marchElapsedSeconds);
   const arrived=result.campaign.operativeState[receipt.id];assert.ok(result.campaign.recruited.includes(receipt.id)&&arrived.alive&&!arrived.captured);assert.equal(arrived.location,'tucuman');assert.ok(arrived.hp>=15);assert.equal(arrived.bleeding,0);assert.ok(result.recovery.doctors.includes(receipt.id));
   availableDoctorIds.add(receipt.id);
  }
  assert.equal(result.recovery.hiredDoctors.length,Math.max(0,2-availableDoctorIds.size));assert.equal(result.recovery.hiringCost,result.recovery.hiredDoctors.reduce((sum,id)=>sum+result.campaign.contracts[id].paid,0));
  assert.equal(new Set(result.recovery.doctors).size,2,'two distinct actual qualified physicians provide the recovery');
  for(const id of result.recovery.doctors)assert.ok(rosterFor(result.campaign).find(op=>op.id===id).medical>=70);
  for(const id of result.recovery.doctors)assert.ok(result.campaign.contracts[id].paid>0,'surviving or replacement doctors work on real paid contracts');
  for(const id of result.recovery.hiredDoctors){assert.ok(!before.recruited.includes(id));assert.equal(before.operativeState[id].alive,true);assert.equal(result.campaign.operativeState[id].location,'tucuman');assert.ok(result.recovery.doctors.includes(id));assert.ok(rosterFor(result.campaign).find(op=>op.id===id).medical>=70);}
  assert.ok(result.recovery.recoveredDressings>=0);assert.ok(result.recovery.donatedDressings>=0);preserveDeaths(rescued,result.campaign);
  for(const id of captiveIds)assert.equal(result.campaign.operativeState[id].energy,100);
  const coast=result.campaign.enemyGroups.filter(group=>group.theater==='coast');assert.ok(coast.length>0,'the actual coastal threat remains in the campaign');
  assert.equal(result.campaign.blockade,coast.some(group=>group.status==='stationed'));
  for(const group of coast.filter(group=>group.status==='marching'))assert.ok(group.arrivalAt>result.campaign.hour,'a flotilla still in transit cannot impose its blockade early');
  assert.equal(result.campaign.sectors.buenos_aires.owner,'patriot');
  evidence.medical.push({stage:'medicalCourier',...result.recovery});recovered=result.campaign;
 });
 await t.test('two paid squads arrive together and capture Salta with actual losses',subtest=>{
  if(!recovered)return subtest.skip('The courier and paid recovery must pass first');
  assert.ok(recovered);const before=structuredClone(recovered),prepared=prepareSaltaAssault(recovered);
  assert.deepEqual(recovered,before);
  assert.equal(prepared.field.length,6);assert.equal(prepared.support.length,6);assert.ok(prepared.hiringCost>0);
  for(const id of prepared.hired){
   assert.equal(before.operativeState[id].alive,true);assert.ok(prepared.campaign.contracts[id].paid>0);
   assert.ok(prepared.events.some(event=>event.action.type==='recruitCivic'&&event.action.id===id),'every hired member receives a real contract transaction');
   assert.ok(prepared.campaign.contracts[id].started>=before.hour,'the actual paid contract begins during preparation');
   assert.ok(!before.recruited.includes(id),'new paid hiring remains separate from the existing rear relief');
  }
  const reserve=prepared.reservePreparation;
  assert.ok(reserve.care.patients.length?reserve.care.hours>0&&reserve.care.usedDressings>0:reserve.care.hours===0&&reserve.care.usedDressings===0);
  for(const id of reserve.care.patients)assert.ok(before.operativeState[id].hp<before.operativeState[id].maxHp||before.operativeState[id].bleeding,'rear care treats actual wounds');
  for(const id of reserve.returning){assert.ok(before.recruited.includes(id));assert.equal(before.operativeState[id].alive,true);assert.equal(before.operativeState[id].location,'cordoba');assert.equal(prepared.campaign.operativeState[id].location,'salta');}
  assert.equal(before.operativeState[reserve.hired].alive,true);assert.ok(!before.recruited.includes(reserve.hired));assert.equal(prepared.campaign.contracts[reserve.hired].paid,reserve.hiringCost);assert.equal(reserve.weaponCost,230);
  assert.equal(prepared.campaign.pendingEncounter,null,'the assault cannot bypass a pending encounter');
  assert.ok(prepared.campaign.enemyGroups.every(group=>group.status!=='waiting'),'no arrived raid remains unanswered');
  for(const group of before.enemyGroups.filter(group=>group.target==='cordoba'&&group.status==='marching'&&group.arrivalAt<=prepared.campaign.hour))assert.ok(prepared.defenses.some(defense=>defense.groupId===group.id),'resolve every depot raid that actually arrives during preparation');
  for(const defense of prepared.defenses){assert.equal(defense.status,'victory');assert.ok(defense.actions>0);assert.equal(prepared.campaign.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');assert.ok(prepared.campaign.encounterHistory.some(event=>event.groupId===defense.groupId&&event.outcome==='victory'));}
  assert.ok(prepared.care.patients.every(id=>before.operativeState[id].hp<before.operativeState[id].maxHp),'care treats actual surviving wounds, without requiring a scripted critical casualty');assert.ok(prepared.care.patients.length?prepared.care.usedDressings>0:prepared.care.usedDressings===0);
  for(const id of prepared.care.patients)assert.equal(prepared.campaign.operativeState[id].hp,prepared.campaign.operativeState[id].maxHp);
  // Advance the actual infantry together and use observed body-region previews.
  const result=fightNorthernSector(prepared.campaign,'salta',{controller:northernReconOrder});evidence.battles.push(...prepared.defenses,result.summary);evidence.reservePreparation=reserve;evidence.medical.push({stage:'saltaPreparation',...prepared.care});
  assertBattleClock(result);
  assert.equal(result.campaign.hour,prepared.departure+12);
  preserveDeaths(recovered,result.campaign);
  for(const unit of result.summary.units.filter(u=>u.side==='player'))assert.equal(result.campaign.operativeState[unit.id].alive,unit.hp>0);
  assert.ok(result.summary.units.some(u=>u.side==='player'&&u.hp<=0&&recovered.operativeState[u.id]?.alive),'the actual Salta assault has permanent losses');salta=result.campaign;
 });
 await t.test('survivors receive any needed care and complete Yatasto after the paid northern pact',subtest=>{
  if(!salta)return subtest.skip('The joint Salta assault must pass first');
  assert.ok(salta);const before=structuredClone(salta),result=completeNorthernMission(salta);
  assert.deepEqual(salta,before);assert.equal(result.campaign.hour,salta.hour+12+result.care.hours);
  evidence.medical.push({stage:'yatasto',...result.care});subtest.diagnostic(JSON.stringify({checkpoint:'critical-first-aid',phase:result.campaign.phase,hour:result.campaign.hour,second:result.campaign.secondOfHour,treasury:result.campaign.resources.treasury,deaths:Object.entries(result.campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),captured:Object.entries(result.campaign.operativeState).filter(([,r])=>r.captured).map(([id])=>Number(id)),...evidence}));
  assert.equal(result.campaign.phase,3);assert.ok(result.campaign.resources.treasury>=0);assert.ok(result.care.patients.length?result.care.usedDressings>0:result.care.usedDressings===0);preserveDeaths(salta,result.campaign);assert.equal(result.campaign.missions.yatasto.completed,true);
 });
});
