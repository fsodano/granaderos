import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {careAssignmentReason,careAssignmentIssue} from '../game/medical-care.js';
import {careRules} from '../game/campaign-care-rules.js';

import {previewStrategicRoute} from '../game/strategic-route.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {bookRouteHires,finishRouteHireArrivals} from './paid-route-hiring.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {cordobaClinicDefenseOrder,cordobaClinicGroundCrew} from './cordoba-clinic-combat-readiness.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

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
 const covered=[...newIds,...relief];
 if(covered.length){
  // A new group's visit can omit the other home's earned upper posts.
  // Reserve those actual owners before choosing any new guard position.
  const reservedPositions=c.recruited.filter(id=>{const r=c.operativeState[id];return !covered.includes(id)&&r.alive&&r.hp>0&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba'&&r.residentSector==='cordoba'&&(r.residentScene??null)===null&&(r.residentPosition?.tacticalLevel??0)>0;}).map(id=>({id,...c.operativeState[id].residentPosition}));
  c=stageRouteRoofDefenders(c,covered,{reservedPositions,report});
 }
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

export function resolveCordobaMedicalRearEncounter(start,{restoreSquad=false,deadlineSeconds,report=()=>{}}={}){
 let c=start;const previous=c.activeSquadId,encounter=c.pendingEncounter;assert.equal(encounter?.sector,'cordoba');
 const local=c.squads.find(q=>q.location==='cordoba'&&q.members.some(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured));assert.ok(local);
 c=dispatchCampaign(c,{type:'selectSquad',id:local.id});assert.equal(c.lastError,null);
 report({event:'recoveryCounterattack',sector:encounter.sector,hour:c.hour,campaign:structuredClone(c)});
 c=dispatchCampaign(c,{type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});assert.equal(c.lastError,null);
 const defense=fightNorthernSector(c,'cordoba',{report,controller:cordobaClinicDefenseOrder,beforeSettlement:aidCordobaMedicalRear});c=defense.campaign;
 report({event:'cordobaMedicalRearClinicInput',campaign:structuredClone(c)});
 const care=stabilizeCordobaMedicalRear(c,{report});c=care.campaign;
 if(deadlineSeconds!==undefined)c=restageCordobaMedicalRear(c,{deadlineSeconds,preserveGroundCrew:true,report}).campaign;
 if(restoreSquad&&c.activeSquadId!==previous){c=dispatchCampaign(c,{type:'selectSquad',id:previous});assert.equal(c.lastError,null);}
 report({event:'cordobaMedicalRearDefense',groupId:encounter.groupId,summary:defense.summary,care:care.receipt,campaign:structuredClone(c)});
 return c;
}

// A successful defence can finish its permitted late search on the ground.
// Care retains those earned posts; return only the actual stable survivors to
// public roof cells before the next ordinary wait or courier continuation.
export function restageCordobaMedicalRear(start,{deadlineSeconds,preserveGroundCrew=false,report=()=>{}}){
 let c=start;const clock=c=>c.hour*3600+(c.secondOfHour??0),orders=[],renewals=[],begin=clock(start),until=Math.min(deadlineSeconds,begin+3600);
 const local=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba';});
 const crew=new Set(preserveGroundCrew?cordobaClinicGroundCrew(c):[]),ground=local.filter(id=>!crew.has(id)&&(c.operativeState[id].residentPosition?.tacticalLevel??0)===0),reservedPositions=local.filter(id=>!ground.includes(id)&&!crew.has(id)).map(id=>({id,...c.operativeState[id].residentPosition}));
 const receipt={sector:'cordoba',ids:ground,deadlineSeconds,until,startSeconds:begin,orders,renewals,restored:false};
 const check=()=>{assert.equal(c.pendingEncounter,null,'Defend a real encounter before restaging.');assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);assert.ok(Number.isSafeInteger(deadlineSeconds)&&clock(c)<=deadlineSeconds,'Use only the original remaining care deadline.');};
 try{
  check();assert.ok(local.every(id=>{const r=c.operativeState[id];return r.hp>=15&&!r.bleeding;}),'Stop actual acute wounds before restaging survivors.');
  assert.ok(ground.every(id=>{const r=c.operativeState[id];return !r.asleep&&r.energy>10;}),'Stop actual exhaustion before moving ground survivors.');
  if(!ground.length){receipt.restored=true;receipt.endSeconds=clock(c);return {campaign:c,battle:null,receipt};}
  assert.ok(ground.every(id=>c.squads.some(q=>q.location==='cordoba'&&!q.journey&&q.members.includes(id))),'Restaging uses only existing local survivor groups.');
  // Cover the bounded real visit for every actual serving local/field duty.
  for(const id of c.recruited){const r=c.operativeState[id];if(!r.alive||r.captured)continue;let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'Every current duty must still be serving before the visit.');
   for(let n=0;expiry!==null&&expiry<=until;n++){
    assert.ok(n<2,'A one-hour roof visit has a finite service quote.');const op=rosterFor(c).find(op=>op.id===id),quote=contractRenewalQuote(c,op,'day'),contract=c.contracts[id],cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);assert.ok(cash>=quote.price,'Restaging requires real funded current service.');
    const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0},from=clock(c);c=dispatchCampaign(c,action);orders.push({kind:'campaign',action,from,to:clock(c),cost:cash-c.resources.treasury});assert.equal(c.lastError,null);check();
    const next=contractExpiresSeconds(c.contracts[id]);assert.equal(next,expiry+quote.hours*3600);renewals.push({id,quote,expiryBefore:expiry,expiryAfter:next});expiry=next;
   }
  }
  const staged=stageRouteRoofDefenders(c,ground,{reservedPositions,bounded:{deadlineSeconds},report});
  staged.receipt.orders.unshift(...orders);staged.receipt.renewals=renewals;staged.receipt.startSeconds=begin;report({event:'cordobaMedicalRearRestaged',receipt:staged.receipt});return staged;
 }catch(error){
  if(error&&typeof error==='object'){
   error.campaign??=c;error.battle??=null;error.pair??={campaign:error.campaign,battle:error.battle};
   error.cordobaMedicalRearRestaging=error.routeRoofDefenders?{...error.routeRoofDefenders,orders:[...orders,...error.routeRoofDefenders.orders],renewals}: {...receipt,endSeconds:clock(c)};
  }
  throw error;
 }
}

export function stabilizeCordobaMedicalRear(start,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'stabilizeCordobaMedicalRear',stage:'preparation-input',campaign:start});
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),orders=[],renewals=[],ticks=[],hires=[],linen=[],admissions=[],attentionNotices=[],horizon=clock(start)+13*3600;let lastAction=null;
 const check=()=>{assert.equal(c.pendingEncounter,null,'Resolve the actual interruption before urgent rear care continues.');assert.equal(c.pendingBattle,null);};
 const order=action=>{lastAction=structuredClone(action);c=dispatchCampaign(c,action);orders.push(action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);check();};
 // Conscious routed patients cannot receive tactical aid. After their real
 // return, use an actual supplied local physician before continuing the trip.
 const urgent=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba'&&(r.bleeding>0||r.hp<15);});
 const local=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='cordoba');
 const supplied=()=>rosterFor(c).filter(op=>local().includes(op.id)&&!urgent().includes(op.id)&&!careAssignmentReason(c,op,'doctor')).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2).map(op=>op.id);
 const retain=()=>{for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
  let expiry=contractExpiresSeconds(c.contracts[id]);
  while(expiry!==null&&expiry<=horizon){
   const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
   order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);const extended=contractExpiresSeconds(c.contracts[id]);assert.ok(extended>expiry);expiry=extended;
   renewals.push({id,quote});report({event:'cordobaMedicalRearCareRenewal',id,quote});
  }
 }};
 const supplyPhysician=()=>{
  if(supplied().length)return;
  // Refill only an otherwise eligible actual local doctor from a currently
  // known, reachable finite row. Hidden bodies cannot enter this decision.
  for(const doctor of rosterFor(c).filter(op=>local().includes(op.id)&&careAssignmentIssue(c,op,'doctor')?.code==='no_medkits').sort((a,b)=>b.medical-a.medical||a.id-b.id)){
   const row=sectorInventoryModel(c,'cordoba',rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>0);if(!row)continue;
   const carried=c.operativeState[doctor.id].medkits,action={type:'sectorInventory',sector:'cordoba',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1};order(action);
   assert.equal(c.operativeState[doctor.id].medkits,carried+1);linen.push({operativeId:doctor.id,sourceKey:row.key,expected:row.expected,count:1,kind:row.kind});return;
  }
  // At most one distinct paid profile is booked for this needed care hour.
  // Its real issue is finite; later exhaustion must be checked again.
  const replacement=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],quote=contractQuote(c,op,'day');return civicStatus(c,op.id).available&&!c.recruited.includes(op.id)&&r.alive&&!r.captured&&op.medical>=careRules(c).minimumSkill&&r.medkits>0&&quote.available&&quote.total<=c.resources.treasury;}).sort((a,b)=>contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||a.id-b.id)[0];
  if(!replacement)return;
  const notices=[],booked=bookRouteHires(c,[replacement.id],{term:'day',destination:'cordoba',report:event=>notices.push(event)});c=booked.campaign;
  orders.push({type:'recruitCivic',id:replacement.id,term:'day',destination:'cordoba'});check();
  c=finishRouteHireArrivals(c,booked.hires,{minimumWaitHours:0,report:event=>notices.push(event)});check();hires.push(booked.hires[0]);
  // A full active squad leaves a real arriving physician unassigned. Use
  // an existing local seat before later paid roof staging needs that home.
  if(!c.squads.some(q=>q.members.includes(replacement.id))){
   const selected=c.activeSquadId,home=c.squads.find(q=>q.location==='cordoba'&&!q.journey&&q.members.length<6);
   assert.ok(home,'A paid relief physician needs an existing local squad seat.');
   order({type:'assignToSquad',squadId:home.id,operativeId:replacement.id});
   if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  }
  for(const event of notices)report(event);
  report({event:'cordobaMedicalRearReliefDoctor',hire:booked.hires[0],issuedDressings:c.operativeState[replacement.id].medkits,patients:urgent()});
 };
 const patients=urgent(),kept=new Set(local());
 try{
 check();if(patients.length)retain();
 for(let hour=0;urgent().length&&hour<12;hour++){
  check();supplyPhysician();for(const id of local())kept.add(id);retain();
  const doctors=supplied();admissions.push({hour:c.hour,second:c.secondOfHour??0,doctors,local:local().map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding,medkits:c.operativeState[id].medkits,asleep:c.operativeState[id].asleep,energy:c.operativeState[id].energy,issue:careAssignmentIssue(c,rosterFor(c).find(op=>op.id===id),'doctor')}))});assert.ok(doctors.length,'real urgent rear care needs a supplied serving physician');
  for(const id of urgent())order({type:'assignCare',operativeId:id,assignment:'patient'});
  for(const id of doctors)order({type:'assignCare',operativeId:id,assignment:'doctor'});
  c=decodeSave(encodeSave(c)).campaign;const began=clock(c),kits=doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0);let pauses=0;
  for(;;){
   order({type:'wait',hours:1});if(clock(c)!==began)break;
   assert.equal(doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0),kits,'A zero-time notice cannot consume a care dressing.');
   const attention=[['assignment',c.assignmentAttention?.notice],['contract',c.contractAttention?.notice],['logistics',c.logisticsNotice]].filter(([,notice])=>notice?.advancedHours===0&&notice.events?.length).map(([kind,notice])=>({kind,notice:structuredClone(notice)}));
   assert.ok(attention.length,'Only an actual zero-time Native attention notice may acknowledge another wait.');
   attentionNotices.push({from:began,to:clock(c),doctors:[...doctors],dressingsSpent:0,attention});assert.ok(++pauses<=2,'Urgent care stopped after repeated zero-time notices.');
  }
  const used=kits-doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0);assert.ok(used>0,'hourly care consumes actual carried linen');assert.equal(clock(c)-began,3600);
  assert.ok([...kept].every(id=>c.recruited.includes(id)&&c.operativeState[id].alive),'urgent rear care must retain every actual serving survivor');
  ticks.push({hour:c.hour,second:c.secondOfHour??0,doctors,dressingsSpent:used,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))});
  for(const id of doctors)if(!c.operativeState[id].medkits)order({type:'assignCare',operativeId:id,assignment:'rest'});
 }
 assert.deepEqual(urgent(),[],'the courier may continue only after its actual rear patients are stable');
 for(const id of local())order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}}
 const otherDeaths=Object.keys(before.operativeState).filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive).map(Number);
 // Off-screen wounded non-serving residents keep their native deterioration.
 // Record those losses; clinical care cannot resurrect or edit their records.
 assert.ok(otherDeaths.every(id=>!before.recruited.includes(id)),'care cannot lose an actual serving cohort member');
 const receipt={event:'cordobaMedicalRearUrgentCare',patients,hire:hires[0]??null,hires,linen,admissions,orders,renewals,ticks,attentionNotices,local:local(),otherDeaths,startSeconds:clock(start),endSeconds:clock(c),dressingsSpent:ticks.reduce((n,t)=>n+t.dressingsSpent,0)};
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report(receipt);return {campaign:c,receipt};
 }catch(error){
  const receipt={patients,hires,linen,admissions,orders,renewals,ticks,attentionNotices,horizon,startSeconds:clock(start),endSeconds:clock(c),completed:false};
  if(error&&typeof error==='object'){error.campaign??=c;error.cordobaMedicalRearUrgentCare=receipt;}
  recordRouteStrategicEvidence({helper:'stabilizeCordobaMedicalRear',stage:'preparation-failure',campaign:c,action:lastAction,inputCapture,context:{receipt,nestedCampaign:error?.campaign??null},error});throw error;
 }
}
