import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {rosterFor,civicStatus,dailyIncome,dispatchCampaign} from '../packages/game/campaign.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {applyItemQuantity,extractItemQuantity} from '../packages/game/tactical-inventory.js';
import {operativeLocation,operativeInTransit,canReassignOperative} from '../packages/game/squads.js';
import {careAssignmentProgress,careAssignmentReason,doctorRate} from '../packages/game/medical-care.js';
import {careRules} from '../packages/game/campaign-care-rules.js';
import {contractQuote,contractRenewalQuote} from '../packages/game/contracts.js';

import {baseMorale} from '../packages/game/morale.js';
import {campaignRole} from '../packages/game/campaign-roles.js';
import {worldOwner} from '../packages/game/world-cells.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {mountainCommandRolePlan} from './mountain-command-role-plan.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {restRecovery} from '../packages/game/strategic-rest.js';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {knownRouteMedicalSources,authoredRouteMedicalDiscoveries,attemptCollectRouteItems} from './finite-route-equipment.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {assertRouteEquipmentDebit} from './route-equipment-inventory-receipt.mjs';
import {attemptRouteDressings} from './route-dressings.mjs';
import {finiteCachesFor} from '../packages/game/campaign-physical.js';
import {transportPath} from '../packages/game/logistics.js';
import {travelLegHours} from '../packages/game/squad-travel.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {enterSector} from '../packages/game/world.js';
import {syncBattleTime} from '../packages/game/time.js';
import {getReachable,lookPreview,environmentPreview,stanceCost} from '../packages/game/tactical.js';
import {tactical as cacheTactical} from './local-contract-fixture.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const physical=({item,...record})=>record;
const free=(c,op)=>['active','rest','patient'].includes(c.operativeState[op.id].assignment)||c.operativeState[op.id].assignment==='doctor'&&careAssignmentProgress(c,op,rosterFor(c)).code==='no_patients';
const fit=(c,op,sector,exclude)=>{
 const r=c.operativeState[op.id];
 return !exclude.includes(op.id)&&r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.unconscious&&!r.routed&&!r.surrendered&&!operativeInTransit(c,op.id)&&operativeLocation(c,op.id)===sector;
};
const stableReturned=(c,op,sector,exclude)=>{
 const r=c.operativeState[op.id];
 return !exclude.includes(op.id)&&r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed&&!r.surrendered&&!operativeInTransit(c,op.id)&&operativeLocation(c,op.id)===sector;
};
const ready=r=>r.morale>=50&&r.energy===100&&!r.fatigue&&!r.asleep;
const restHours=(c,op,paidCare=false,careHours=0)=>{
 const r=c.operativeState[op.id],rate=restRecovery(op,r,c);let morale=Math.max(0,6*Math.ceil(50-r.morale)-(r.moraleRestHours??0));
 // Only the new finite-care phase quotes day renewals. A whole 24 hours of
 // paid service is a conservative reward interval; actual orders still own
 // eligibility, payment and morale. No forecast is applied to a person.
 if(paidCare&&(!c.recruited.includes(op.id)||c.contracts[op.id]?.term==='day')&&!contractQuote(c,op,'day').permanent){
  const period=contractQuote(c,op,'day').hours,interval=Math.max(24,period),contract=c.contracts[op.id],expiry=contract?.expiresAt===null?Infinity:contract?contract.expiresAt*3600+(contract.expiresSecond??0):clock(c)+period*3600,last=r.lastMoralePayAt===null?-Infinity:r.lastMoralePayAt*3600+(r.lastMoralePaySecond??0),first=Math.max(24,Math.ceil((expiry-clock(c))/3600),Math.ceil((last+86400-clock(c))/3600));
  const blocked=Math.max(careHours,Math.max(0,Math.floor((59-r.energy)/rate.energy))),credit=blocked?0:r.moraleRestHours??0;
  morale=Infinity;
  for(let hours=0;hours<=600;hours++)if(r.morale+Math.floor((credit+Math.max(0,hours-blocked))/6)+2*(hours<first?0:1+Math.floor((hours-first)/interval))>=50){morale=hours;break;}
 }
 return Math.max(0,morale,Math.ceil((100-r.energy)/rate.energy),Math.ceil(r.fatigue/rate.fatigue));
};

// A forecast names actual current bodies and quotes. It does not count an
// unserving offer as a serving soldier or change its morale or equipment.
export function mountainReturnedAdmissionPlan(c,{sector,fieldCount,doctorCount,exclude=[],fieldPool,preparingIds=[],careDoctorId=null}){
 const roster=rosterFor(c),serving=roster.filter(op=>fit(c,op,sector,exclude)&&c.recruited.includes(op.id)&&(free(c,op)||op.id===careDoctorId&&c.operativeState[op.id].assignment==='doctor')&&canReassignOperative(c,op.id)&&!careAssignmentReason(c,op,'rest')&&baseMorale(op)>=50);
 const preparing=roster.filter(op=>preparingIds.includes(op.id)&&!fit(c,op,sector,exclude)&&stableReturned(c,op,sector,exclude)&&c.recruited.includes(op.id)&&free(c,op)&&canReassignOperative(c,op.id)&&!careAssignmentReason(c,op,'patient'));
 const booked=new Set((c.hiringArrivals??[]).map(row=>row.operativeId)),late=fieldPool(c).filter(op=>!c.recruited.includes(op.id)&&!booked.has(op.id));
 const early=roster.filter(op=>stableReturned(c,op,sector,exclude)&&!c.recruited.includes(op.id)&&op.id>=100&&op.id<1000&&c.operativeState[op.id].morale<50&&baseMorale(op)>=50&&contractQuote(c,op,'day').available&&civicStatus(c,op.id).available&&(fit(c,op,sector,exclude)||c.operativeState[op.id].location===sector))
  .sort((a,b)=>contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||c.operativeState[b.id].morale-c.operativeState[a.id].morale||a.id-b.id);
 const pending=(c.hiringArrivals??[]).filter(row=>row.destination===sector&&!exclude.includes(row.operativeId)).map(row=>roster.find(op=>op.id===row.operativeId)).filter(op=>op&&fit(c,op,sector,exclude));
 const pool=[...serving,...preparing,...pending,...late],chosen=[];
 const roles=()=>mountainCommandRolePlan({commanders:pool.filter(op=>op.leadership>=80),physicians:pool.filter(op=>op.medical>=60),count:doctorCount});
 while(pool.length<fieldCount||!roles()){
  const next=early.find(op=>!chosen.includes(op.id)&&(pool.length<fieldCount||op.medical>=60||op.leadership>=80));
  assert.ok(next,'Actual returned people must supply the missing field body and distinct required roles.');
  chosen.push(next.id);pool.push(next);
  assert.ok(chosen.length+preparingIds.length<=6,'Use the existing bounded six-person reserve admission.');
 }
 const rolePlan=roles(),base=[rolePlan.commander.id,...rolePlan.doctors.map(op=>op.id)],rank=pool.filter(op=>!base.includes(op.id)).sort((a,b)=>Number(c.recruited.includes(b.id))-Number(c.recruited.includes(a.id))||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.marksmanship-a.marksmanship||a.id-b.id);
 const fieldIds=[...base,...rank.slice(0,fieldCount-base.length).map(op=>op.id)];assert.equal(new Set(fieldIds).size,fieldCount);
 return {fieldIds,earlyIds:chosen,preparingIds:preparing.map(op=>op.id),pendingIds:pending.map(op=>op.id),servingIds:serving.map(op=>op.id),lateIds:late.map(op=>op.id),commanderId:rolePlan.commander.id,doctorIds:rolePlan.doctors.map(op=>op.id)};
}

function returnedCarePlan(c,plan,sector,reserves,careDoctorId){
 const roster=rosterFor(c),patients=[...plan.earlyIds,...plan.preparingIds].filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 if(!patients.length)return null;
 const doctor=roster.filter(op=>plan.servingIds.includes(op.id)&&op.medical>=careRules(c).minimumSkill&&(free(c,op)||op.id===careDoctorId&&c.operativeState[op.id].assignment==='doctor')&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10).sort((a,b)=>Number(b.id===careDoctorId)-Number(a.id===careDoctorId)||doctorRate(b,c)-doctorRate(a,c)||a.id-b.id)[0];
 assert.ok(doctor,'Actual stable returned wounds need a present serving physician before admission.');
 const strokes=patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(doctor,c)),0),floors=reserves??Object.fromEntries(plan.doctorIds.map(id=>[id,Math.max(5,c.operativeState[id].medkits)]));
 const seen=new Set(),physical=sectorInventorySites(c,sector).reduce((sum,site)=>{
  const model=sectorInventoryModel(c,site.id,roster,doctor.id);assert.equal(model.operativeId,doctor.id);assert.equal(model.carriedReason,null,model.carriedReason);
  return sum+model.entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&!seen.has(site.id+'|'+row.key)&&seen.add(site.id+'|'+row.key)).reduce((n,row)=>n+row.count,0);
 },0)+[...plan.servingIds,...plan.preparingIds].reduce((sum,id)=>sum+c.operativeState[id].medkits,0);
 const shortfall=Math.max(0,strokes+Object.values(floors).reduce((a,b)=>a+b,0)-physical);
 const record=c.operativeState[doctor.id];assert.ok(record.energy-strokes*careRules(c).energyCost>10,'The actual supplied physician must remain capable through the quoted finite care.');
 const recovery=restRecovery(doctor,record,c),rest=Math.max(Math.ceil(strokes*careRules(c).energyCost/recovery.energy),Math.ceil(strokes*careRules(c).fatigueCost/recovery.fatigue));
 return {doctorId:doctor.id,patients,strokes,rate:doctorRate(doctor,c),reserves:floors,physical,shortfall,cost:0,hours:strokes+rest};
}

// Initial cache quantities nominate a public discovery, never available stock.
// Reserve every remaining candidate's real route, one discovery hour and three
// full carrier-rest windows. Accepted trips later replace this conservative sum.
function careCollectionPlan(c,sector,shortfall,exclude){
 if(!shortfall)return {seconds:0,cost:0,sources:[],carrierId:null};
 const protectedIds=new Set([...exclude,...['foundryEngineer','marchCommander'].map(key=>campaignRole(c,key)?.id)]),roster=rosterFor(c);
 const carrier=roster.filter(op=>fit(c,op,sector,[])&&c.recruited.includes(op.id)&&!protectedIds.has(op.id)&&op.medical<60&&['active','rest'].includes(c.operativeState[op.id].assignment)&&canReassignOperative(c,op.id)&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&!c.operativeState[op.id].residentPosition&&!c.operativeState[op.id].residentSector&&!c.militiaTraining.some(row=>row.trainerId===op.id))
  .filter(op=>{const model=sectorInventoryModel(c,sector,roster,op.id);if(model.operativeId!==op.id||model.reason)return false;try{applyItemQuantity(model.personal,{item:'medkits',count:shortfall});return true;}catch{return false;}})
  .sort((a,b)=>contractRenewalQuote(c,a,'day').price-contractRenewalQuote(c,b,'day').price||a.id-b.id)[0];
 assert.ok(carrier,'Actual finite care needs a free nonclinical keeper with carrying room and no retained post.');
 assert.ok(c.squads.some(q=>q.location===sector&&!q.journey&&!q.members.length),'Actual finite collection needs an existing empty local home.');
 const rate=restRecovery(carrier,c.operativeState[carrier.id],c),rest=Math.max(Math.ceil(100/rate.energy),Math.ceil(100/rate.fatigue));assert.ok(rest<=48);
 const remembered=knownRouteMedicalSources(c,sector),known=new Set(remembered.map(row=>row.at)),sources=[...remembered,...authoredRouteMedicalDiscoveries(c,sector).filter(row=>!known.has(row.at))].map(source=>{
  const outward=transportPath(c,sector,source.at),returning=transportPath(c,source.at,sector);assert.ok(outward&&returning);
  const hours=path=>path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(path[i],to,'posta',c),0),seconds=(hours(outward)+hours(returning)+3*rest+(source.admission==='discovery-required'?1:0))*3600,cost=(outward.length+returning.length-2)*10;
  return {...source,outward,returning,seconds,cost,restHours:rest};
 }).sort((a,b)=>Number(a.admission==='discovery-required')-Number(b.admission==='discovery-required')||a.seconds-b.seconds||a.at.localeCompare(b.at));
 assert.ok(sources.length,'No controlled public finite medical source or authored discovery remains.');
 return {carrierId:carrier.id,seconds:sources.reduce((sum,row)=>sum+row.seconds,0),cost:sources.reduce((sum,row)=>sum+row.cost,0),sources};
}

// Reserve the next real step and the complete current public departure. No
// future income, hypothetical parcel or already paid hire is credited twice.
export function quoteReturnedMountainAdmission(c,{sector,fieldCount,doctorCount,exclude=[],fieldPool,departurePlan,nextSeconds=0,supplyReserve=2000,preparingIds=[],careReserves=null,careDoctorId=null}){
 const plan=mountainReturnedAdmissionPlan(c,{sector,fieldCount,doctorCount,exclude,fieldPool,preparingIds,careDoctorId}),now=clock(c),roster=rosterFor(c),care=returnedCarePlan(c,plan,sector,careReserves,careDoctorId),paidCare=Boolean(care||preparingIds.length),collection=careCollectionPlan(c,sector,care?.shortfall??0,exclude),arrivalSeconds=Math.max(0,...plan.pendingIds.map(id=>{const row=c.hiringArrivals.find(row=>row.operativeId===id);return row.dueAt*3600+(row.dueSecond??0)-now;})),restSeconds=Math.max(0,...[...plan.servingIds,...plan.earlyIds,...plan.preparingIds,...plan.pendingIds].map(id=>restHours(c,roster.find(op=>op.id===id),paidCare,care?.doctorId===id?care.hours:0)*3600));
 // The cheap keepers rest during the real courier waits. Expensive former
 // hires sign only after collection AND current keeper readiness are complete.
 const beforeHireSeconds=care&&!preparingIds.length?Math.max(collection.seconds,...plan.servingIds.map(id=>restHours(c,roster.find(op=>op.id===id),true)*3600)):collection.seconds;
 const newHireRest=Math.max(0,...[...plan.earlyIds,...plan.pendingIds].map(id=>restHours(c,roster.find(op=>op.id===id),paidCare)*3600));
 const preparationSeconds=care&&!preparingIds.length?beforeHireSeconds+Math.max(nextSeconds,arrivalSeconds+newHireRest,care.hours*3600):Math.max(nextSeconds,arrivalSeconds+restSeconds,(care?.hours??0)*3600),departure=departurePlan(c,plan.fieldIds,now+preparationSeconds);
 assert.ok(departure.horizonSeconds>=now+nextSeconds&&Number.isSafeInteger(departure.fixedCost));
 const early=plan.earlyIds.map(id=>{const op=roster.find(op=>op.id===id),quote=contractQuote(c,op,'day'),arrivalHours=0,days=Math.max(1,Math.floor((departure.horizonSeconds-now-beforeHireSeconds-arrivalHours*3600)/(quote.hours*3600))+1);return {id,quote,arrivalHours,days,cost:quote.guarantee+days*quote.price};});
 const pending=plan.pendingIds.map(id=>{const row=c.hiringArrivals.find(row=>row.operativeId===id),quote=contractQuote(c,roster.find(op=>op.id===id),'day'),expiry=row.dueAt*3600+(row.dueSecond??0)+row.serviceHours*3600,renewals=Math.max(0,Math.floor((departure.horizonSeconds-expiry)/(quote.hours*3600))+1);return {id,quote,expiry,renewals,cost:renewals*quote.price};});
 const needed=Math.max(0,fieldCount-plan.servingIds.length-plan.preparingIds.length-early.length-pending.length),mandatory=plan.fieldIds.filter(id=>plan.lateIds.includes(id)&&[plan.commanderId,...plan.doctorIds].includes(id));
 // The later selector retains its own skill ordering. Reserve the largest
 // current quoteable subset of that size, rather than assuming cheap hires.
 const lateOffers=plan.lateIds.map(id=>{const quote=contractQuote(c,roster.find(op=>op.id===id),'day'),days=Math.max(1,Math.floor((departure.horizonSeconds-now-preparationSeconds)/(quote.hours*3600))+1);return {id,quote,days,cost:quote.guarantee+days*quote.price};}).sort((a,b)=>b.cost-a.cost||a.id-b.id),late=[...lateOffers.filter(row=>mandatory.includes(row.id)),...lateOffers.filter(row=>!mandatory.includes(row.id)).slice(0,Math.max(0,needed-mandatory.length))];
 assert.equal(late.length,Math.max(needed,mandatory.length));
 const keepIds=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),fixedCost=supplyReserve+departure.fixedCost+collection.cost+[...early,...pending,...late].reduce((sum,row)=>sum+row.cost,0),budget=quoteMountainServiceBudget(c,{keepIds,horizonSeconds:departure.horizonSeconds,fixedCost});
 // Current cash reserves every readiness term and every proposed late hire.
 // Departure service remains a separate full quote, never future income.
 const readyAt=now+preparationSeconds,readinessEarly=early.reduce((sum,row)=>sum+row.quote.guarantee+(Math.floor(Math.max(0,readyAt-now-beforeHireSeconds-row.arrivalHours*3600)/(row.quote.hours*3600))+1)*row.quote.price,0),readinessPending=pending.reduce((sum,row)=>sum+Math.max(0,Math.floor((readyAt-row.expiry)/(row.quote.hours*3600))+1)*row.quote.price,0);
 const readinessBudget=quoteMountainServiceBudget(c,{keepIds,horizonSeconds:readyAt,fixedCost:supplyReserve+departure.fixedCost+collection.cost+readinessEarly+readinessPending+late.reduce((sum,row)=>sum+row.cost,0)});
 return {plan,preparationSeconds,beforeHireSeconds,departure,early,pending,late,supplyReserve,care,collection,paidCare,readinessBudget,budget};
}

// Collect every blocking local fallback through current public inventory.
// Deposit each accepted parcel again; its finite identity remains available
// for the existing later equipment step. No marker is edited by this helper.
export function prepareReturnedMountainService(start,options){
 const {sector='mendoza',fieldCount=16,doctorCount=3,exclude=[],deadlineSeconds,fieldPool,departurePlan,report=()=>{}}=options;
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(start));
 assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);assert.equal(worldOwner(start,sector),'patriot');
 let c=start,lastClock=clock(c),lastCash=c.resources.treasury,careReserves=null,careDoctorId=null;const preparingIds=[],originalSelection=c.activeSquadId,orders=[],events=[],receipt={sector,fieldCount,doctorCount,deadlineSeconds,startSeconds:clock(c),orders,events,collected:[],hires:[],completedDuties:[],banking:[],care:[],supply:[],budgets:[],completed:false};
 const emit=event=>{const {campaign,battle,...row}=event;events.push(structuredClone(row));if(['freshRouteOrder','freshRouteRenewal'].includes(event.event)){orders.push({kind:'campaign',action:structuredClone(event.action),from:lastClock,to:clock(c),cost:lastCash-c.resources.treasury});lastClock=clock(c);lastCash=c.resources.treasury;}report(event);};
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:emit});
 const order=action=>{const seconds=action.type==='wait'?action.hours*3600:0;assert.ok(clock(c)+seconds<=deadlineSeconds,'Returned service shares the original mountain readiness deadline.');return retained.order(action);};
 const quote=seconds=>quoteReturnedMountainAdmission(c,{sector,fieldCount,doctorCount,exclude,fieldPool,departurePlan,nextSeconds:seconds,preparingIds,careReserves,careDoctorId});
 const recordBudget=(current,stage)=>{receipt.lastBudget=current;if(current.paidCare){const row={stage,at:clock(c),quote:current};receipt.budgets.push(row);report({event:'mountainReturnedReadinessBudget',...row,campaign:c});}return current;};
 const funded=seconds=>{const current=recordBudget(quote(seconds),'paid-step'),budget=current.paidCare?current.readinessBudget:current.budget;assert.equal(budget.available,true,budget.reason);return current;};
 const nextStep=()=>{const budget=quoteMountainServiceBudget(c,{keepIds:retained.keepIds(),horizonSeconds:clock(c)+3601});receipt.nextStepBudget=budget;assert.equal(budget.available,true,budget.reason);};
 const accepted=(next,action,kind='campaign')=>{
  // Only a normal successful return enters this function. Record that prefix
  // before retained.adopt can stop on a newly released actual encounter.
  orders.push({kind,action:structuredClone(action),from:lastClock,to:clock(next),cost:lastCash-next.resources.treasury});lastClock=clock(next);lastCash=next.resources.treasury;
  retained.adopt(next,'finite-care-collection');assert.equal(c.pendingEncounter,null,'An actual encounter stops finite care collection.');assert.ok(clock(c)<=deadlineSeconds,'Returned service shares the original mountain readiness deadline.');
 };
 const collectCareDressings=()=>{
  let current=recordBudget(quote(0),'physical-supply');if(!current.care?.shortfall)return;
  const visited=new Set();
  while(current.care.shortfall){
   const source=current.collection.sources.find(row=>!visited.has(row.at));assert.ok(source,'Actual controlled finite medical stock is exhausted after the admitted discoveries.');visited.add(source.at);
   const id=current.collection.carrierId,r=c.operativeState[id],home=c.squads.find(q=>q.members.includes(id)),empty=c.squads.find(q=>q.location===sector&&!q.journey&&!q.members.length);assert.ok(home&&empty);
   const original={homeId:home.id,members:[...home.members],assignment:r.assignment,selected:c.activeSquadId,kits:r.medkits},others=c.squads.filter(q=>q.id!==home.id&&q.id!==empty.id).map(q=>structuredClone(q)),posts=Object.fromEntries(c.recruited.map(id=>[id,{sector:c.operativeState[id].residentSector,position:structuredClone(c.operativeState[id].residentPosition)}]));
   const trip={operativeId:id,source:source.at,admission:source.admission,requested:current.care.shortfall,start:clock(c),quote:source,departure:current.departure,fullBudget:current.budget,orders:[],collected:0};receipt.supply.push(trip);
   const tripEnd=clock(c)+source.seconds;assert.ok(tripEnd<=deadlineSeconds,'The complete physical supply trip must fit the original mountain readiness deadline.');
   const tripBudget=()=>{const budget=quoteMountainServiceBudget(c,{keepIds:retained.keepIds(),horizonSeconds:Math.max(tripEnd,clock(c)+3601),fixedCost:source.cost});trip.lastBudget=budget;assert.equal(budget.available,true,budget.reason);return budget;};tripBudget();
   const issue=action=>{tripBudget();assert.ok(clock(c)+(action.type==='wait'?action.hours*3600:0)<=tripEnd,'The next actual courier action must fit its reserved trip horizon.');const before=clock(c);order(action);trip.orders.push({action:structuredClone(action),from:before,to:clock(c)});assert.equal(c.pendingEncounter,null,'An actual encounter stops the finite courier.');if(action.type!=='visitSector')assert.equal(c.pendingBattle,null);assert.ok(clock(c)<=tripEnd,'Actual collection cannot exceed its reserved trip horizon.');};
   issue({type:'assignToSquad',operativeId:id,squadId:empty.id});issue({type:'assignCare',operativeId:id,assignment:'active'});
   const resting=()=>{const began=clock(c);let notices=0;while(c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep){
    assert.ok(clock(c)-began<source.restHours*3600,'The actual courier must recover within its quoted ordinary rest window.');if(c.operativeState[id].assignment!=='rest')issue({type:'assignCare',operativeId:id,assignment:'rest'});
    const before=clock(c);issue({type:'wait',hours:1});notices=clock(c)===before?notices+1:0;assert.ok(notices<3,'Courier rest stopped after repeated zero-time notices.');
   }if(c.operativeState[id].assignment!=='active')issue({type:'assignCare',operativeId:id,assignment:'active'});};
   resting();
   const outward=previewStrategicRoute(c,empty.id,source.at,'posta'),returnView={...c,squads:c.squads.map(q=>q.id===empty.id?{...q,location:source.at}:q)},returning=previewStrategicRoute(returnView,empty.id,sector,'posta');
   assert.equal(outward.valid,true,outward.reason);assert.equal(returning.valid,true,returning.reason);assert.deepEqual(outward.path,source.outward);assert.deepEqual(returning.path,source.returning);trip.outward=outward;trip.returning=returning;
   const travel=at=>{
    const preview=previewStrategicRoute(c,empty.id,at,'posta');assert.equal(preview.valid,true,preview.reason);assert.ok(clock(c)+preview.hours*3600<=tripEnd);issue(preview.action);let notices=0;
    for(let steps=0;c.squads.find(q=>q.id===empty.id).journey&&steps<240;steps++){
     assert.equal(c.squads.find(q=>q.id===empty.id).journey.status,'moving','An actual stopped route needs a response.');const before=clock(c);issue({type:'wait',hours:1});notices=clock(c)===before?notices+1:0;assert.ok(notices<3,'Courier travel stopped after repeated zero-time notices.');
    }
    assert.equal(c.squads.find(q=>q.id===empty.id).journey,undefined);assert.equal(operativeLocation(c,id),at);if(at===sector)resting();
   };
   travel(source.at);
   if(source.admission==='discovery-required'){
    const cacheId=finiteCachesFor(c)[source.at]?.chest;assert.ok(cacheId);retained.retain(3601);issue({type:'visitSector'});
    const raw=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates[source.at]));assert.equal(raw.error,null,raw.error);accepted(raw.campaign,{type:'enterSector',sector:source.at},'tactical');let p={campaign:c,battle:raw.battle};
    const began=clock(c),searchEnd=Math.min(began+3600,tripEnd,deadlineSeconds);trip.discovery={cacheId,start:began,actions:[]};
    const beforeOrder=({pair,action})=>{
     assert.equal(pair.battle.status,'active');assert.equal(pair.battle.mode,'exploration','Contact stops a finite-cache discovery.');const actor=pair.battle.units.find(u=>u.id===String(id));assert.ok(actor&&!actor.mounted&&!actor.stealthMode);
     let seconds;
     if(action.type==='move'){
      assert.equal(actor.movementMode,'walk');assert.equal(actor.stance,'standing');const goal=getReachable(pair.battle,actor,{stopAt:point=>point.x===action.x&&point.y===action.y&&(point.tacticalLevel??0)===(action.tacticalLevel??0)})[0];assert.ok(goal?.path.length,'The actual cache step needs its current public Native path.');
      // Standing walk is 3/5 seconds on straight/diagonal cells; an upward
      // access costs 6. Six per actual quoted cell bounds all three.
      seconds=goal.path.length*6;
     }else if(action.type==='look'){const preview=lookPreview(pair.battle,actor,action);assert.equal(preview.valid,true,preview.reason);seconds=Math.max(1,Math.ceil(preview.pa*.06));}
     else if(action.type==='door'||action.type==='useItem'){const ref=action.type==='door'?{kind:'door',id:action.doorId}:action.environment,preview=environmentPreview(pair.battle,actor,ref,'open');assert.equal(preview.valid,true,preview.reason);seconds=Math.max(1,Math.ceil(preview.pa*.06));}
     else if(action.type==='movement')seconds=Math.max(1,Math.ceil(stanceCost(actor,'standing')*.06));
     else assert.fail('The bounded discovery issues only current movement, looking and opening orders.');
     assert.ok(clock(pair.campaign)+seconds+6<=searchEnd,'The actual public cache action and possible contact round must fit the reserved discovery hour.');
    };
    const onOrder=({pair,action})=>{trip.discovery.actions.push(structuredClone(action));accepted(pair.campaign,action,'tactical');assert.equal(pair.battle.mode,'exploration','Actual contact stops collection before another order.');assert.equal(pair.battle.status,'active');assert.ok(clock(c)<=searchEnd);};
    const actor=p.battle.units.find(u=>u.id===String(id));if(actor.movementMode!=='walk'||actor.stance!=='standing'){
     // Same Native path as every cache action; no posture or time patch.
     const action={type:'movement',unitId:String(id),movement:'walk'};beforeOrder({pair:p,action});
     p=cacheTactical(p,action);onOrder({pair:p,action});
    }
    p=takeFiniteCache(p,id,[],{cacheId,beforeOrder,onOrder});
    const action={type:'leaveSector',battleId:c.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')},next=dispatchCampaign(c,action);assert.equal(next.lastError,null,next.lastError);accepted(next,action);assert.equal(c.pendingBattle,null);trip.discovery.end=clock(c);
   }
   for(let count=0;count<trip.requested;count++){
    const before=c,found=attemptCollectRouteItems(c,id,{item:'medkits'},1,{discover:false,onOrder:({campaign:next,action})=>{
     const prior=sectorInventoryModel(before,action.sector,rosterFor(before),id),row=prior.entries.find(row=>row.key===action.sourceKey);assert.ok(row);assertRouteEquipmentDebit(prior,sectorInventoryModel(next,action.sector,rosterFor(next),id),row);assert.equal(next.operativeState[id].medkits,before.operativeState[id].medkits+1);assert.equal(clock(next),clock(before));assert.equal(next.resources.treasury,before.resources.treasury);accepted(next,action);trip.collected++;
    }});c=found.campaign;if(!found.collected)break;
   }
   resting();travel(sector);assert.equal(c.operativeState[id].medkits,original.kits+trip.collected);
   if(trip.collected){const before=c,model=sectorInventoryModel(c,sector,rosterFor(c),id),keys=new Set(model.entries.map(row=>row.key)),parcel=extractItemQuantity(model.personal,'medkits',trip.collected).stack;assert.equal(model.operativeId,id);issue({type:'sectorInventory',sector,operativeId:id,direction:'drop',item:'medkits',count:trip.collected});assert.equal(c.operativeState[id].medkits,original.kits);
    const deposits=sectorInventoryModel(c,sector,rosterFor(c),id).entries.filter(row=>!keys.has(row.key)&&row.kind==='ground'&&row.expected===JSON.stringify(parcel));assert.equal(deposits.reduce((n,row)=>n+row.count,0),trip.collected);trip.deposits=structuredClone(deposits);assert.equal(clock(c),clock(before));assert.equal(c.resources.treasury,before.resources.treasury);
   }
   issue({type:'assignToSquad',operativeId:id,squadId:original.homeId});issue({type:'squad',ids:original.members});issue({type:'assignCare',operativeId:id,assignment:original.assignment});issue({type:'selectSquad',id:original.selected});
   assert.deepEqual(c.squads.filter(q=>q.id!==home.id&&q.id!==empty.id),others);assert.deepEqual(c.squads.find(q=>q.id===home.id).members,original.members);assert.equal(c.squads.find(q=>q.id===empty.id).members.length,0);
   for(const [key,post]of Object.entries(posts)){assert.equal(c.operativeState[key].residentSector,post.sector);assert.deepEqual(c.operativeState[key].residentPosition,post.position);}
   trip.end=clock(c);current=recordBudget(quote(0),'physical-supply-return');
  }
 };
 const collectReturns=(extra=[])=>{
  const targets=[...Object.entries(c.operativeState).filter(([,r])=>r.alive&&r.serviceEquipmentReturn?.sectorId===sector).map(([id,r])=>({ownerId:Number(id),siteId:r.serviceEquipmentReturn.siteId,returnId:r.serviceEquipmentReturn.id})),...extra],seen=new Set();
  for(const target of targets){
   if(seen.has(target.returnId))continue;seen.add(target.returnId);const {ownerId:id,siteId,returnId}=target,matches=row=>row.count>0&&(row.kind==='serviceReturn'?JSON.parse(row.key)[1]===returnId:row.kind==='ground'&&row.key.startsWith(`ground:${returnId}-`));let finished=false;
   for(let step=0;step<128;step++){
    retained.retain();const carriers=rosterFor(c).filter(op=>fit(c,op,sector,[])&&c.recruited.includes(op.id)&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&free(c,op));let paid=false,pending=Boolean(c.operativeState[id].serviceEquipmentReturn),admitted=false;
    for(const op of carriers){
     const model=sectorInventoryModel(c,siteId,rosterFor(c),op.id);if(model.operativeId!==op.id||model.reason)continue;admitted=true;
     const rows=model.entries.filter(matches),repairs=model.repairReserves.filter(row=>row.repairPoints>0&&JSON.parse(row.key)[1]===returnId);pending||=Boolean(rows.length||repairs.length);
     const row=rows.find(row=>row.reachable);
     if(row){
      const source=JSON.parse(row.expected),scene=c.sceneStates?.[siteId]??c.sectorStates[siteId];assert.ok(scene.groundItems.length<2000,'The actual scene must have space for the finite returned parcel.');let low=0,high=row.count;
      while(low<high){const middle=Math.ceil((low+high)/2);try{applyItemQuantity(model.personal,{...source,count:middle});low=middle;}catch{high=middle-1;}}
      if(!low)continue;const count=low,counts=new Map(model.carried.map(row=>[row.item,row.count])),at=clock(c),cash=c.resources.treasury;
      order({type:'sectorInventory',sector:siteId,operativeId:op.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
      const after=sectorInventoryModel(c,siteId,rosterFor(c),op.id),received=after.carried.find(item=>item.count-(counts.get(item.item)??0)===count&&isDeepStrictEqual(physical(extractItemQuantity(after.personal,item.item,count).stack),physical({...source,count})));
      assert.ok(received,'The accepted take must retain its exact actual parcel.');
      const groundBefore=(c.sceneStates?.[siteId]??c.sectorStates[siteId]).groundItems.length;
      order({type:'sectorInventory',sector:siteId,operativeId:op.id,direction:'drop',item:received.item,count});
      const deposited=(c.sceneStates?.[siteId]??c.sectorStates[siteId]).groundItems[groundBefore],{id:groundId,type,x,y,tacticalLevel,knownToPlayer,heldBy,...stored}=deposited;
      assert.deepEqual(physical(stored),physical({...source,count}));assert.equal(clock(c),at);assert.equal(c.resources.treasury,cash);
      receipt.collected.push({ownerId:id,operativeId:op.id,sourceKey:row.key,sourceCount:row.count,count,groundId,record:stored});paid=true;
     }else{
      const repair=repairs.find(row=>row.reachable);if(!repair)continue;
      const count=Math.min(repair.repairPoints,repair.capacity);if(!count)continue;
      order({type:'sectorInventory',sector:siteId,operativeId:op.id,direction:'takeRepairPoints',sourceKey:repair.key,expected:repair.expected,count});receipt.collected.push({ownerId:id,operativeId:op.id,sourceKey:repair.key,repairPoints:count});paid=true;
     }
     if(paid)break;
    }
    if(!paid&&admitted&&!pending){finished=true;break;}
    assert.ok(paid,'An actual local free carrier must have admitted access and capacity for the returned property.');
   }
   assert.equal(finished,true,'The bounded collection must drain every actual returned source.');
   assert.equal(c.operativeState[id].serviceEquipmentReturn,undefined,'Every actual former-owner stack must be collected before admission.');
  }
 };
 recordRouteStrategicEvidence({helper:'prepareReturnedMountainService',stage:'preparation-input',campaign:start,context:{sector,fieldCount,doctorCount,exclude,deadlineSeconds}});
 try{
  collectReturns();receipt.initialPlan=mountainReturnedAdmissionPlan(c,{sector,fieldCount,doctorCount,exclude,fieldPool});let notices=0;
  // A basic retainer remains on duty. An expensive paid field specialist can
  // finish a free, unposted assembly duty once actually ready, then remain an
  // available late offer. Existing care, training and permanent service stay.
  for(;;){
   let current=recordBudget(quote(0),'existing-duty');
   const unready=current.plan.servingIds.filter(id=>!ready(c.operativeState[id])),ceiling=routeHiringCeiling(c,100);
   const required=new Set(['foundryEngineer','marchCommander'].map(key=>campaignRole(c,key)?.id).filter(id=>id!==undefined));
   const threatened=c.enemyGroups.some(group=>group.target===sector&&['marching','waiting','engaged','stationed'].includes(group.status));
   const patients=rosterFor(c).some(op=>c.recruited.includes(op.id)&&c.operativeState[op.id]?.alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===sector&&(c.operativeState[op.id].hp<c.operativeState[op.id].maxHp||c.operativeState[op.id].bleeding));
   const releasable=rosterFor(c).filter(op=>current.plan.servingIds.includes(op.id)&&!required.has(op.id)&&!threatened&&!(op.medical>=20&&patients)&&ready(c.operativeState[op.id])&&!c.operativeState[op.id].residentPosition&&!c.operativeState[op.id].residentSector&&!c.militiaTraining.some(row=>row.trainerId===op.id)&&c.contracts[op.id]?.kind==='paid'&&!c.contracts[op.id].guaranteeId&&!c.contracts[op.id].departurePending&&contractRenewalQuote(c,op,'day').price>ceiling&&(unready.length||!current.budget.available));
   for(const op of releasable){
    retained.retain();
    const model=sectorInventoryModel(c,sector,rosterFor(c),op.id);assert.equal(model.operativeId,op.id);assert.equal(model.reason,null,model.reason);
    const property=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count,{keepOtherHand:false}).stack),keepBefore=retained.keepIds(),contract=structuredClone(c.contracts[op.id]),cash=c.resources.treasury,returnSequence=c.serviceEquipmentReturns.nextId;
    if(c.operativeState[op.id].assignment!=='active')order({type:'assignCare',operativeId:op.id,assignment:'active'});
    order({type:'dismiss',id:op.id,...(contract.guaranteeId?{expectedGuaranteeId:contract.guaranteeId}:{})});
    assert.deepEqual(keepBefore.filter(id=>!c.recruited.includes(id)),[op.id]);
    const completion={id:op.id,at:clock(c),contract,holdingCeiling:ceiling,morale:c.operativeState[op.id].morale,refund:c.resources.treasury-cash,property,returnSequence};receipt.completedDuties.push(completion);
    collectReturns([{ownerId:op.id,siteId:sector,returnId:`service-return-${returnSequence}`}]);
    assert.equal(contractQuote(c,rosterFor(c).find(row=>row.id===op.id),'day').available,true);
   }
   current=quote(0);receipt.lastBudget=current;
   // Start the finite journey after actual expensive duties are completed,
   // while the other cheap keepers continue their ordinary local rest.
   if(current.care?.shortfall){
    if(!current.readinessBudget.available){const payroll=retained.keepIds().reduce((sum,id)=>sum+contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day').daily,0);assert.ok(dailyIncome(c)>payroll,'Actual activated port income must exceed continuing service before banking.');}
    collectCareDressings();current=quote(0);receipt.lastBudget=current;
   }
   if(!current.plan.servingIds.some(id=>!ready(c.operativeState[id])))break;
   nextStep();const before=clock(c);order({type:'wait',hours:1});notices=clock(c)===before?notices+1:0;assert.ok(notices<3,'Existing readiness stopped after repeated zero-time notices.');
  }
  // Earn only real positive-net income before buying the missing rest duty.
  // The full future quote is reported each step; only next-step cash is
  // spendable until the actual Native midnight payment has been received.
  while(!(quote(0).paidCare?quote(0).readinessBudget:quote(0).budget).available){
   const current=recordBudget(quote(0),'banking');
   const payroll=retained.keepIds().reduce((sum,id)=>sum+contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day').daily,0),income=dailyIncome(c);
   assert.ok(income>payroll,'Actual activated port income must exceed continuing service before banking.');nextStep();
   const before={at:clock(c),treasury:c.resources.treasury};order({type:'wait',hours:1});receipt.banking.push({...before,to:clock(c),treasuryAfter:c.resources.treasury,income,payroll});notices=clock(c)===before.at?notices+1:0;assert.ok(notices<3,'Actual banking stopped after repeated zero-time notices.');
  }
  let plan=mountainReturnedAdmissionPlan(c,{sector,fieldCount,doctorCount,exclude,fieldPool});
  if(plan.earlyIds.length){
   const initial=funded(0),medical=initial.care;careReserves=medical?.reserves??null;careDoctorId=medical?.doctorId??null;
   const doctorAssignment=careDoctorId===null?null:c.operativeState[careDoctorId].assignment;
   const home=c.squads.find(q=>q.location===sector&&!q.journey&&!q.members.length);assert.ok(home,'An actual empty local squad must hold the newly paid reserve.');
   for(const id of plan.earlyIds){
    assert.ok(clock(c)<=deadlineSeconds,'The actual arrival must fit the original mountain readiness deadline.');funded(0);order({type:'selectSquad',id:home.id});const op=rosterFor(c).find(op=>op.id===id),hire=contractQuote(c,op,'day'),cash=c.resources.treasury;
    assert.equal(hire.available,true,hire.reason);order({type:'recruitCivic',id,term:'day',destination:sector});assert.equal(c.resources.treasury,cash-hire.total);receipt.hires.push({id,quote:hire,at:clock(c)});if(medical)preparingIds.push(id);
    for(let hour=0;!c.recruited.includes(id)&&hour<24;hour++){funded(3600);order({type:'wait',hours:1});}
    assert.ok(c.recruited.includes(id)&&operativeLocation(c,id)===sector,'The actual paid reserve must arrive before local rest.');order({type:'assignCare',operativeId:id,assignment:medical&&c.operativeState[id].hp<c.operativeState[id].maxHp?'patient':'rest'});
   }
   if(medical){
    assert.equal(c.location,sector,'Paid finite care uses the actual selected local workshop.');
    const protect=Object.fromEntries(c.recruited.map(id=>[id,c.operativeState[id].medkits]));for(const id of [...plan.servingIds,...preparingIds])protect[id]=careReserves[id]??0;
    for(const id of [...plan.doctorIds.filter(id=>id!==careDoctorId&&c.recruited.includes(id)),careDoctorId]){
     const target=(careReserves[id]??0)+(id===careDoctorId?medical.strokes:0),recipient=sectorInventoryModel(c,sector,rosterFor(c),id);assert.equal(recipient.operativeId,id);assert.equal(recipient.carriedReason,null,recipient.carriedReason);if(target>c.operativeState[id].medkits)applyItemQuantity(recipient.personal,{item:'medkits',count:target-c.operativeState[id].medkits});
     const result=attemptRouteDressings(c,id,target,{reserves:protect,discover:false,onOrder:({campaign:next,action})=>{
      const before=c;if(action.direction==='take'){const model=sectorInventoryModel(before,action.sector,rosterFor(before),id),source=model.entries.find(row=>row.key===action.sourceKey);assert.ok(source);assert.equal(next.operativeState[id].medkits,before.operativeState[id].medkits+action.count);}
      accepted(next,action);receipt.care.push({kind:'allocation',action:structuredClone(action),at:clock(c)});assert.equal(clock(c),clock(before));assert.equal(c.resources.treasury,before.resources.treasury);
     }});c=result.campaign;assert.equal(result.supplied,true,'Actual collected finite dressings must cover care and every protected physician floor.');protect[id]=target;
    }
    order({type:'assignCare',operativeId:careDoctorId,assignment:'doctor'});
   }
   const ids=[...plan.earlyIds],needsRest=()=>ids.some(id=>{const r=c.operativeState[id];return r.hp<r.maxHp||r.morale<50||r.energy<100||r.fatigue>0||r.asleep;})||medical&&!ready(c.operativeState[careDoctorId]);
   let notices=0;
   while(needsRest()){
    if(medical&&ids.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp)){
     for(const id of ids)if(c.operativeState[id].assignment!=='rest')order({type:'assignCare',operativeId:id,assignment:'rest'});
     if(c.operativeState[careDoctorId].assignment!=='rest')order({type:'assignCare',operativeId:careDoctorId,assignment:'rest'});
    }
    funded(3600);const before=clock(c),patients=medical?ids.map(id=>({id,hp:c.operativeState[id].hp,bandaged:c.operativeState[id].bandaged})):null,kits=medical?c.operativeState[careDoctorId].medkits:null;
    order({type:'wait',hours:1});const elapsed=clock(c)-before;notices=elapsed?0:notices+1;assert.ok(notices<3,'Actual returned-service rest stopped after repeated zero-time notices.');
    if(medical)receipt.care.push({kind:'wait',from:before,to:clock(c),doctorId:careDoctorId,used:kits-c.operativeState[careDoctorId].medkits,patients,after:ids.map(id=>({id,hp:c.operativeState[id].hp,bandaged:c.operativeState[id].bandaged})),morale:ids.map(id=>({id,morale:c.operativeState[id].morale,lastPayAt:c.operativeState[id].lastMoralePayAt,lastPaySecond:c.operativeState[id].lastMoralePaySecond??0}))});
   }
   if(medical&&c.operativeState[careDoctorId].assignment!==doctorAssignment)order({type:'assignCare',operativeId:careDoctorId,assignment:doctorAssignment});
   order({type:'selectSquad',id:originalSelection});
  }
  const finalBudget=recordBudget(quote(0),'full-departure');assert.equal(finalBudget.budget.available,true,'Actual complete departure service and every late hire must be affordable before final admission.');
  retained.check();receipt.finalPlan=mountainReturnedAdmissionPlan(c,{sector,fieldCount,doctorCount,exclude,fieldPool});assert.deepEqual(receipt.finalPlan.earlyIds,[]);assert.deepEqual(receipt.finalPlan.pendingIds,[]);
  receipt.endSeconds=clock(c);receipt.completed=true;report({event:'mountainReturnedServiceAdmitted',receipt,campaign:c});return {campaign:c,receipt};
 }catch(error){
  if(error.campaign===undefined)error.campaign=c;error.mountainReturnedService=receipt;recordRouteStrategicEvidence({helper:'prepareReturnedMountainService',stage:'preparation-failure',campaign:c,returnedCampaign:error.campaign,context:{receipt},error});report({event:'mountainReturnedServiceStopped',reason:error.message,receipt,campaign:c});throw error;
 }
}
