import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {careAssignmentReason} from '../game/medical-care.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {bookRouteHires,finishRouteHireArrivals} from './paid-route-hiring.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {fightNorthernSector,northernClinicDefenseOrder} from './northern-route.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);

// The courier leaves real patients and guards at Córdoba. Reinforce a depleted
// rear before departure; keep the original survivors in their earned positions.
export function prepareCordobaMedicalRear(start,courier,{report=()=>{}}={}){
 assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 assert.equal(operativeLocation(start,courier),'cordoba');
 let c=decodeSave(encodeSave(start)).campaign;const previous=c.activeSquadId,hires=[],orders=[],oldPositions={},relief=[],renewals=[];let activationCost=0,travelCost=0;
 const rear=()=>c.recruited.filter(id=>id!==courier&&c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba');
 const initialRear=rear();for(const id of initialRear)oldPositions[id]=structuredClone(c.operativeState[id].residentPosition??null);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);orders.push(action);};
 const home=c.squads.find(q=>q.location==='cordoba'&&!q.journey&&q.members.includes(courier));assert.ok(home);
 if(c.activeSquadId!==home.id)order({type:'selectSquad',id:home.id});
 // These actual local profiles provide ordinary guards and finite dressings.
 // The courier retains their real contracts before its subsequent journey.
 for(const id of [139,130,100,102,133]){
  if(rear().length>=12)break;
  const record=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id);
  if(c.recruited.includes(id)||!record?.alive||record.captured)continue;
  const quote=contractQuote(c,op,'day');if(!quote.available||quote.total>c.resources.treasury)continue;
  const booked=bookRouteHires(c,[id],{term:'day',destination:'cordoba',report});c=booked.campaign;
  // Stock profiles arrive immediately. Do not hide a delayed arrival inside
  // this rear preparation: that wait needs its own medical/encounter policy.
  assert.equal(booked.hires[0].arrival.travelHours,0,'the rear guard must actually arrive before this courier departure');
  c=finishRouteHireArrivals(c,booked.hires,{minimumWaitHours:0,report});hires.push(...booked.hires);
 }
 const newIds=hires.map(h=>h.id);
 for(let offset=0;offset<newIds.length;offset+=6){
  const ids=newIds.slice(offset,offset+6),vacant=c.squads.find(q=>q.location==='cordoba'&&!q.journey&&!q.members.length);
  if(vacant){order({type:'selectSquad',id:vacant.id});order({type:'squad',ids});}
  else order({type:'createSquad',name:'Guardia médica de Córdoba',sector:'cordoba',ids});
 }
 // Preserve the funded army: bring actual serving coastal reserves instead of
 // booking two expensive specialists whose repeated fees exhaust the budget.
 if(rear().length<12){
  const candidates=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&!operativeInTransit(c,op.id)&&operativeLocation(c,op.id)==='san_nicolas'&&!c.squads.some(q=>q.members.includes(op.id))&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).slice(0,12-rear().length).map(op=>op.id);
  assert.equal(candidates.length,12-rear().length,'the actual rear relief needs serving healthy reserves');
  const vacant=c.squads.find(q=>q.location==='san_nicolas'&&!q.journey&&!q.members.length);assert.ok(vacant,'use the real empty coastal squad slot');
  order({type:'selectSquad',id:vacant.id});order({type:'squad',ids:candidates});
  for(const id of candidates)order({type:'assignCare',operativeId:id,assignment:'active'});
  if(!c.routes.posta){const cash=c.resources.treasury;order({type:'transport',mode:'posta'});activationCost=cash-c.resources.treasury;}
  const quote=previewStrategicRoute(c,c.activeSquadId,'cordoba','posta');assert.equal(quote.valid,true,quote.reason);
  for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
   let expiry=contractExpiresSeconds(c.contracts[id]);
   while(expiry!==null&&expiry<=clock(c)+(quote.hours+1)*3600){
    const contract=c.contracts[id],renewal=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(renewal.available,true,renewal.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
    assert.equal(c.resources.treasury,cash-renewal.price);const extended=contractExpiresSeconds(c.contracts[id]);assert.ok(extended>expiry);renewals.push({id,price:renewal.price,expiryBefore:expiry,expiryAfter:extended});expiry=extended;
   }
  }
  const departed=clock(c),cash=c.resources.treasury;c=completeTestTravel(c,{sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null,'rear relief must arrive before the actual courier raid');assert.equal(c.pendingBattle,null);assert.equal(c.location,'cordoba');
  travelCost=cash-c.resources.treasury;assert.equal(travelCost,(quote.path.length-1)*10,'pay the existing ten-peso posta fee for each actual leg');assert.equal(clock(c)-departed,quote.hours*3600);relief.push(...candidates);
  report({event:'cordobaMedicalRearRelief',ids:candidates,quote,activationCost,travelCost,renewals,departed,arrived:clock(c)});
 }
 assert.ok(rear().length>=12,'the actual medical trip needs twelve living rear guards');
 for(const id of newIds){
  const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
  const row=model().entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
  assert.ok(row,'each new guard needs a real recovered long gun');
  const keys=new Set(Object.keys(model().personal.inventory??{}));
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const gun=model().carried.find(row=>!keys.has(row.inventoryKey)&&row.equip?.some(option=>option.slot==='primary'&&option.valid));assert.ok(gun);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
 }
 c=supplyRouteAmmunition(c,rear(),{target:12,report}).campaign;
 const covered=[...newIds,...relief];if(covered.length)c=stageRouteRoofDefenders(c,covered,{report});
 for(const id of covered)order({type:'assignCare',operativeId:id,assignment:'rest'});
 if(c.activeSquadId!==previous)order({type:'selectSquad',id:previous});
 for(const id of initialRear)assert.deepEqual(c.operativeState[id].residentPosition??null,oldPositions[id],'new guards must preserve each original survivor position');
 for(const [id,r]of Object.entries(start.operativeState)){assert.equal(c.operativeState[id].alive,r.alive);assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive)assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 const receipt={event:'cordobaMedicalRearReady',courier,initialRear,rear:rear(),newIds,relief,hires,orders,renewals,activationCost,travelCost,startSeconds:clock(start),endSeconds:clock(c),treasuryBefore:start.resources.treasury,treasuryAfter:c.resources.treasury,
  rearDressings:rear().reduce((n,id)=>n+c.operativeState[id].medkits,0),positions:rear().map(id=>({id,position:c.operativeState[id].residentPosition??null}))};
 assert.ok(c.resources.treasury>=0,'rear preparation uses the actual finite treasury');
 assert.ok(receipt.rearDressings>0,'the real rear guard retains finite dressings during the courier trip');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report(receipt);return {campaign:c,receipt};
}

// Apply only native field orders. fightNorthernSector records these orders,
// paid seconds and finite dressings in its official midpoint save/replay.
export function aidCordobaMedicalRear(start,{execute,report=()=>{}}={}){
 const aid=autoBandageBattle(start.battle);let pair=start;
 for(const action of aid.steps)pair=execute(pair,action);
 assert.deepEqual(pair.battle.units,aid.battle.units);assert.equal(pair.battle.seed,aid.battle.seed);assert.equal(pair.battle.elapsedSeconds,aid.battle.elapsedSeconds);
 const kits=b=>b.units.filter(u=>u.side==='player').reduce((n,u)=>n+(u.medkits??0),0);
 report({event:'cordobaMedicalRearFieldAid',steps:aid.steps,elapsedSeconds:aid.elapsedSeconds,dressingsSpent:kits(start.battle)-kits(pair.battle),treated:aid.treatedIds,untreated:aid.untreated,stoppedReason:aid.stoppedReason});
 return pair;
}

export function resolveCordobaMedicalRearEncounter(start,{restoreSquad=false,report=()=>{}}={}){
 let c=start;const previous=c.activeSquadId,encounter=c.pendingEncounter;assert.equal(encounter?.sector,'cordoba');
 const local=c.squads.find(q=>q.location==='cordoba'&&q.members.some(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured));assert.ok(local);
 c=dispatchCampaign(c,{type:'selectSquad',id:local.id});assert.equal(c.lastError,null);
 report({event:'recoveryCounterattack',sector:encounter.sector,hour:c.hour,campaign:structuredClone(c)});
 c=dispatchCampaign(c,{type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});assert.equal(c.lastError,null);
 const defense=fightNorthernSector(c,'cordoba',{report,controller:northernClinicDefenseOrder,beforeSettlement:aidCordobaMedicalRear});c=defense.campaign;
 report({event:'cordobaMedicalRearClinicInput',campaign:structuredClone(c)});
 const care=stabilizeCordobaMedicalRear(c,{report});c=care.campaign;
 if(restoreSquad&&c.activeSquadId!==previous){c=dispatchCampaign(c,{type:'selectSquad',id:previous});assert.equal(c.lastError,null);}
 report({event:'cordobaMedicalRearDefense',groupId:encounter.groupId,summary:defense.summary,care:care.receipt,campaign:structuredClone(c)});
 return c;
}

export function stabilizeCordobaMedicalRear(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),orders=[],renewals=[],ticks=[];let hire=null;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);orders.push(action);};
 // Conscious routed patients cannot receive tactical aid. After their real
 // return, use an actual supplied local physician before continuing the trip.
 const urgent=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba'&&(r.bleeding>0||r.hp<15);});
 if(urgent().length&&!rosterFor(c).some(op=>c.recruited.includes(op.id)&&operativeLocation(c,op.id)==='cordoba'&&!careAssignmentReason(c,op,'doctor'))){
  const replacement=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],quote=contractQuote(c,op,'day');return civicStatus(c,op.id).available&&!c.recruited.includes(op.id)&&r.alive&&!r.captured&&op.medical>=60&&r.medkits>0&&hiringTravelHours(c,op.id)===0&&quote.available&&quote.total<=c.resources.treasury;}).sort((a,b)=>contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||a.id-b.id)[0];
  assert.ok(replacement,'native rear casualties require a supplied paid physician before the courier continues');
  const booked=bookRouteHires(c,[replacement.id],{term:'day',destination:'cordoba',report});c=booked.campaign;
  c=finishRouteHireArrivals(c,booked.hires,{minimumWaitHours:0,report});
  hire=booked.hires[0];report({event:'cordobaMedicalRearReliefDoctor',hire,issuedDressings:c.operativeState[replacement.id].medkits,patients:urgent()});
 }
 if(urgent().length)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
  let expiry=contractExpiresSeconds(c.contracts[id]);
  while(expiry!==null&&expiry<=clock(c)+13*3600){
   const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
   order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);const extended=contractExpiresSeconds(c.contracts[id]);assert.ok(extended>expiry);expiry=extended;
   renewals.push({id,quote});report({event:'cordobaMedicalRearCareRenewal',id,quote});
  }
 }
 const local=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba'),patients=urgent();
 for(let hour=0;urgent().length&&hour<12;hour++){
  assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
  const doctors=rosterFor(c).filter(op=>local.includes(op.id)&&!urgent().includes(op.id)&&!careAssignmentReason(c,op,'doctor')).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2).map(op=>op.id);assert.ok(doctors.length,'real urgent rear care needs a supplied serving physician');
  for(const id of urgent())order({type:'assignCare',operativeId:id,assignment:'patient'});
  for(const id of doctors)order({type:'assignCare',operativeId:id,assignment:'doctor'});
  c=decodeSave(encodeSave(c)).campaign;const began=clock(c),kits=doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0);order({type:'wait',hours:1});
  const used=kits-doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0);assert.ok(used>0,'hourly care consumes actual carried linen');assert.equal(clock(c)-began,3600);
  assert.ok(local.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive),'urgent rear care must retain every actual serving survivor');
  ticks.push({hour:c.hour,second:c.secondOfHour??0,doctors,dressingsSpent:used,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))});
  for(const id of doctors)if(!c.operativeState[id].medkits)order({type:'assignCare',operativeId:id,assignment:'rest'});
 }
 assert.deepEqual(urgent(),[],'the courier may continue only after its actual rear patients are stable');
 for(const id of local)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}}
 const otherDeaths=Object.keys(before.operativeState).filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive).map(Number);
 // Off-screen wounded non-serving residents keep their native deterioration.
 // Record those losses; clinical care cannot resurrect or edit their records.
 assert.ok(otherDeaths.every(id=>!before.recruited.includes(id)),'care cannot lose an actual serving cohort member');
 const receipt={event:'cordobaMedicalRearUrgentCare',patients,hire,orders,renewals,ticks,local,otherDeaths,startSeconds:clock(start),endSeconds:clock(c),dressingsSpent:ticks.reduce((n,t)=>n+t.dressingsSpent,0)};
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report(receipt);return {campaign:c,receipt};
}
