import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote,contractRenewalQuote} from '../game/contracts.js';
import {isContractOperative} from '../game/content-character-ids.js';
import {doctorRate,careAssignmentIssue} from '../game/medical-care.js';
import {hiringArrivalReason,hiringTravelHours} from '../game/hiring-arrivals.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {supplyRouteDressings} from './route-dressings.mjs';
import {expandedCapitalWaitNotice} from './created-expanded-capital-return.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);

// Quote actual local clinical care before choosing a replacement force. A
// small surviving party still needs care; this is not assault readiness.
export function livingNorthernReliefPlan(c,{commanderId=57,maxCareHours=24}={}){
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 assert.ok(Number.isSafeInteger(maxCareHours)&&maxCareHours>0&&maxCareHours<=120);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId),roster=rosterFor(c);
 assert.ok(keepers.includes(commanderId)&&field.length,'Retain the real serving commander and every actual survivor.');
 for(const id of keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.equal(r.bleeding,0,'Resolve real bleeding before clinical recovery.');assert.ok(expiry===null||expiry>clock(c));}
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const clinics=[...new Set(patients.map(id=>c.operativeState[id].location))].map(sector=>{
  assert.equal(c.sectors[sector].owner,'patriot');
  const localPatients=patients.filter(id=>c.operativeState[id].location===sector);
  const doctor=roster.filter(op=>keepers.includes(op.id)&&!localPatients.includes(op.id)&&c.operativeState[op.id].location===sector&&op.medical>=60&&!careAssignmentIssue(c,op,'doctor')).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
  assert.ok(doctor,'Current patients need a real local qualified physician, with supplies and actual service.');
  const rate=doctorRate(doctor,c),dressings=localPatients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/rate),0);
  assert.ok(dressings<=maxCareHours,'The quoted clinical horizon must cover the real remaining wounds.');
  return {sector,patients:localPatients,doctorId:doctor.id,rate,dressings};
 });
 const candidates=roster.filter(op=>isContractOperative(c,op)&&!c.recruited.includes(op.id)&&c.operativeState[op.id]?.alive&&!c.operativeState[op.id].captured&&!c.operativeState[op.id].serviceEquipmentReturn&&civicStatus(c,op.id).available&&contractQuote(c,op,'day').available).map(op=>({id:op.id,location:c.operativeState[op.id].location,hp:c.operativeState[op.id].hp,maxHp:c.operativeState[op.id].maxHp,bleeding:c.operativeState[op.id].bleeding,medical:op.medical,marksmanship:op.marksmanship,day:contractQuote(c,op,'day'),week:contractQuote(c,op,'week'),arrivalHours:hiringTravelHours(c,op.id),arrivalReason:hiringArrivalReason(c,c.location)})).sort((a,b)=>a.day.total-b.day.total||b.marksmanship-a.marksmanship||a.id-b.id);
 return {commanderId,keepers,field,patients,clinics,maxCareHours,candidates};
}

export function recoverLivingNorthernClinic(start,{report=()=>{},...options}={}){
 const before=structuredClone(start),plan=livingNorthernReliefPlan(start,options),originalGuns=guns(start),deaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive);
 let c=decodeSave(encodeSave(start)).campaign;const events=[],emit=e=>{events.push(e);report(e);};
 const safe=()=>{assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(living(c),plan.keepers);assert.deepEqual(guns(c),originalGuns);for(const[id,r]of deaths){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}for(const id of plan.keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(r.alive&&!r.captured&&!r.bleeding);assert.equal(r.location,start.operativeState[id].location);assert.ok(expiry===null||expiry>clock(c));}};
 const order=action=>{const seconds=clock(c),treasury=c.resources.treasury,next=dispatchCampaign(c,action);if(next.lastError){emit({event:'livingNorthernClinicRefused',action,reason:next.lastError,hour:c.hour,second:c.secondOfHour??0});throw Error(JSON.stringify(action)+' '+next.lastError);}c=next;safe();emit({event:'livingNorthernClinicOrder',action,startSeconds:seconds,endSeconds:clock(c),treasuryBefore:treasury,treasuryAfter:c.resources.treasury});};
 const retain=seconds=>{for(const id of plan.keepers){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=clock(c)+seconds){const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.contracts[id].expiresAt,quote.expiresAt);assert.equal(c.contracts[id].expiresSecond??0,quote.expiresSecond??0);assert.ok(contractExpiresSeconds(c.contracts[id])>expiry);expiry=contractExpiresSeconds(c.contracts[id]);emit({event:'livingNorthernClinicRenewal',id,quote});}}};
 const complete=()=>plan.patients.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding);
 try{
  for(const clinic of plan.clinics){
   const kits=c.operativeState[clinic.doctorId].medkits,cash=c.resources.treasury,seconds=clock(c),receipts=[];
   const next=supplyRouteDressings(c,clinic.doctorId,Math.max(kits,clinic.dressings),{report:e=>receipts.push(e)});c=next;safe();assert.equal(c.resources.treasury,cash);assert.equal(clock(c),seconds);for(const receipt of receipts)emit(receipt);
   order({type:'assignCare',operativeId:clinic.doctorId,assignment:'doctor'});for(const operativeId of clinic.patients)order({type:'assignCare',operativeId,assignment:'patient'});
  }
  const began=clock(c),limit=began+plan.maxCareHours*3600;let pauses=0;
  // Each explicit wait is a new at-most-one-hour request. A genuine partial
  // clinical-completion stop ends that request; no full-hour retry is added.
  while(!complete()&&clock(c)<limit){
   assert.ok(limit-clock(c)>=3600,'Do not request care beyond its actual elapsed-time bound.');retain(3601);
   const time=clock(c);order({type:'wait',hours:1});const elapsed=clock(c)-time;assert.ok(elapsed>=0&&elapsed<=3600);
   if(!elapsed){const notice=expandedCapitalWaitNotice(c,{startedSeconds:time,requestedHours:1});assert.ok(++pauses<=3,'Bound repeated real zero-time assignment notices.');emit({event:'livingNorthernClinicPaused',notice});}else pauses=0;
  }
  assert.ok(complete(),'Actual finite clinical care must finish inside the unchanged care bound.');
  for(const clinic of plan.clinics){order({type:'assignCare',operativeId:clinic.doctorId,assignment:'active'});for(const operativeId of clinic.patients)order({type:'assignCare',operativeId,assignment:'active'});}
  assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  const current=livingNorthernReliefPlan(c,options);emit({event:'livingNorthernClinicReady',plan,currentQuotes:current.candidates,elapsedSeconds:clock(c)-began,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:structuredClone(c),scope:'Real local survivor care and public replacement quotes only; no hire, readiness, north request or ending claim.'});return c;
 }catch(error){assert.deepEqual(start,before);emit({event:'livingNorthernClinicStopped',reason:error.message,input:structuredClone(start),lastObservedCampaign:structuredClone(c),scope:'Failure evidence only; no returned or adopted campaign.'});throw error;}
}
