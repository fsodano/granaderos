import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {lowMoraleRenewalStatus} from '../game/morale-renewal.js';
import {queueSquadTravel,travelLegHours} from '../game/squad-travel.js';
import {artilleryTransportQuote,artilleryTransportPath,storedArtilleryRecord} from '../game/artillery-transport.js';
import {artilleryTransportRules} from '../game/artillery-transport-rules.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {stabilizeCreatedCuyoSurvivors,stabilizeCreatedCuyoBattleSurvivors,recoverCreatedCuyoLocalPatients} from './created-cuyo-route.mjs';
import {supplyFreshMountainAmmunition,NATIVE_MOUNTAIN_RESERVE_BOUNDS} from './fresh-mountain-route.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {enterSector} from '../game/world.js';
import {fightNorthernSector} from './northern-route.mjs';
import {visit,saved,leave,sync} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {arsenalRearServicePlan,withdrawArsenalRear,reuniteArsenalRear,restArsenalRear} from './arsenal-medical-reserve.mjs';
import {fight} from './opening-driver.mjs';
import {fightPairedRouteBattle} from './paired-route-battle.mjs';
import {recordRouteBattleFailure} from './route-failure-evidence.mjs';
import {actBattle,endTurn} from '../game/tactical.js';
import {sectorDeploymentAction} from '../game/sector-deployment.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const stable=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.unconscious&&!r.routed;};
const healthyLocalVeterans=c=>rosterFor(c).filter(op=>op.id!==2&&living(c).includes(op.id)&&c.operativeState[op.id].location==='mendoza'&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp)
 .sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id);

// Return an existing physician through the whole squad's actual public route.
// Arrival does not supply dressings, recover morale or claim combat readiness.
export function returnCreatedCuyoArsenalPhysician(start,{report=()=>{}}={}){
 const local=healthyLocalVeterans(start).find(op=>op.medical>=60);
 if(local)return {campaign:start,physician:local.id,returned:false};
 let c=saved({campaign:start}).campaign;
 const original={id:c.activeSquadId,members:[...c.squad],location:c.location},clock=s=>s.hour*3600+(s.secondOfHour??0),began=clock(c);
 assert.equal(c.location,'mendoza');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const plans=rosterFor(c).filter(op=>op.medical>=60&&living(c).includes(op.id)&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].location!=='mendoza')
  .sort((a,b)=>b.medical-a.medical||c.operativeState[b.id].morale-c.operativeState[a.id].morale||a.id-b.id).flatMap(op=>{
   const group=c.squads.find(q=>q.members.includes(op.id)&&!q.journey);if(!group)return [];
   const preview=structuredClone(c),squad=preview.squads.find(q=>q.id===group.id);
   try{const journey=queueSquadTravel(preview,squad,{sector:'mendoza',mode:'march'}),hours=journey.path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(journey.path[i],to,journey.mode,c),0);
    return hours<=24?[{id:op.id,squadId:group.id,members:[...group.members],journey:structuredClone(journey),hours}]:[];
   }catch{return [];}
  });
 const plan=plans[0];assert.ok(plan,'The arsenal needs a healthy serving physician with an available existing squad route to Mendoza.');
 const events=[],retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>events.push(event)}),order=action=>retained.order(action);
 try{
  retained.retain((plan.hours+1)*3600);
  order({type:'selectSquad',id:plan.squadId});order({type:'travel',sector:'mendoza',mode:'march',queue:true});
  assert.deepEqual(c.squads.find(q=>q.id===plan.squadId).journey,plan.journey);
  for(let attempt=0;attempt<48&&c.squads.find(q=>q.id===plan.squadId).journey&&clock(c)-began<24*3600;attempt++){
   if(c.squads.find(q=>q.id===plan.squadId).journey.status==='paused')order({type:'resumeTravel'});
   order({type:'wait',hours:1});
  }
  const arrived=c.squads.find(q=>q.id===plan.squadId);
  assert.equal(arrived.journey,undefined,'The physician must finish the actual public route before staffing the arsenal.');
  assert.equal(arrived.location,'mendoza');assert.deepEqual(arrived.members,plan.members);assert.equal(c.operativeState[plan.id].location,'mendoza');
  assert.ok(living(c).includes(plan.id)&&stable(c,plan.id)&&c.operativeState[plan.id].hp===c.operativeState[plan.id].maxHp);
  order({type:'selectSquad',id:original.id});assert.deepEqual(c.squad,original.members);assert.equal(c.location,original.location);
  const campaign=saved({campaign:c}).campaign;assert.deepEqual(campaign,c);
  for(const event of events)report(event);
  report({event:'createdCuyoArsenalPhysicianReturned',physician:plan.id,plan,seconds:clock(c)-began,hour:c.hour,second:c.secondOfHour??0,campaign});
  return {campaign,physician:plan.id,returned:true};
 }catch(error){recordRouteStrategicEvidence({helper:'returnCreatedCuyoArsenalPhysician',stage:'preparation-failure',campaign:c,context:{original,plan},error});throw error;}
}

// A native victory spent the three original bronze guns. This side operation
// earns the remaining finite arsenal; it never refills those existing pieces.
export function prepareCreatedCuyoArsenalAssault(start,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareCreatedCuyoArsenalAssault',stage:'preparation-input',campaign:start});
 let c=saved({campaign:start}).campaign;
 try{
 assert.equal(c.flags.armyFunded,true);assert.equal(c.location,'mendoza');
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.equal(c.sectors.ensenada.owner,'royalist');assert.equal(c.artilleryArsenalRecoveries.ensenada,undefined);
 const originalSquad=c.activeSquadId,originalMembers=[...c.squad];
 const retain=()=>createFreshRouteOrders(()=>c,next=>{c=next;},{report,handledEncounters:['tucuman','salta']});
 let retained=retain();
 const resolve=()=>{
  if(!c.pendingEncounter)return;
  const selected=c.activeSquadId,encounter=c.pendingEncounter;
  assert.ok(['tucuman','salta'].includes(encounter.sector),'Resolve an unexpected real encounter before this side operation.');
  const alive=living(c);
  const destination=encounter.sector==='salta'?'tucuman':'cordoba';
  c=dispatchCampaign(c,{type:'respondToEncounter',groupId:encounter.groupId,choice:'retreat',destination});
  assert.equal(c.lastError,null,c.lastError);assert.equal(c.defeated,false);assert.equal(c.pendingBattle,null);
  report({event:'createdCuyoArsenalRearEncounter',sector:encounter.sector,choice:'retreat',destination,deaths:alive.filter(id=>!c.operativeState[id].alive),hour:c.hour,second:c.secondOfHour,campaign:c});
  retained=retain();
  retained.order({type:'selectSquad',id:selected});
 };
 const order=action=>{resolve();return retained.order(action);};
 if(!healthyLocalVeterans(c).some(op=>op.medical>=60)){
  const returned=returnCreatedCuyoArsenalPhysician(c,{report});retained.adopt(returned.campaign,'arsenal-physician-arrival');
 }
 const healthy=healthyLocalVeterans(c);
 const reserve=healthy.filter(op=>!originalMembers.includes(op.id)),veterans=reserve.length>=5?reserve:healthy;
 let local=veterans.slice(0,5).map(op=>op.id);
 if(!veterans.slice(0,5).some(op=>op.medical>=60)){
  const medic=veterans.filter(op=>op.medical>=60).sort((a,b)=>c.operativeState[b.id].morale-c.operativeState[a.id].morale||b.medical-a.medical||a.id-b.id)[0];
  assert.ok(medic,'The actual local column needs a healthy serving physician.');
  local=[...veterans.filter(op=>op.id!==medic.id).slice(0,4).map(op=>op.id),medic.id];
 }
 assert.ok(local.length>0&&local.length<=5,'Use the actual healthy local veterans and fill the remaining places through quoted paid recruitment.');
 assert.ok(local.some(id=>rosterFor(c).find(op=>op.id===id).medical>=60),'The actual local column needs its existing physician.');
 const freshPhysician=rosterFor(c).find(op=>op.id>=100&&op.id<1000&&op.medical>=60&&!c.recruited.includes(op.id)&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].morale>=50&&contractQuote(c,op,'day').available);
 const servingPhysician=freshPhysician?null:veterans.filter(op=>!local.includes(op.id)&&op.medical>=60).sort((a,b)=>c.operativeState[b.id].morale-c.operativeState[a.id].morale||b.medical-a.medical||a.id-b.id)[0];
 assert.ok(freshPhysician||servingPhysician,'The second column needs an available physician or an actual serving reserve.');
 const rested=[...local,...(servingPhysician?[servingPhysician.id]:[])];
 for(const operativeId of rested)order({type:'assignCare',operativeId,assignment:'rest'});
 // Safe strategic rest earns one morale point per six actual hours. The
 // fresh loose route can bring permanent veterans home with zero morale;
 // its paid wait must cover the real deficit before the readiness check.
 const restLimit=Math.max(240,...rested.map(id=>Math.ceil(Math.max(0,50-c.operativeState[id].morale))*6+24));
 for(let hour=0;hour<restLimit&&rested.some(id=>{const r=c.operativeState[id];return r.morale<50||r.fatigue||r.energy<100||r.asleep;});hour++)order({type:'wait',hours:1});
 assert.ok(rested.every(id=>{const r=c.operativeState[id];return r.morale>=50&&!r.fatigue&&r.energy===100&&!r.asleep;}),'Existing paid rest must finish before the actual coastal march.');
 const candidates=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].morale>=50&&contractQuote(c,op,'day').available)
  .sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price);
 const physician=servingPhysician??candidates.filter(op=>op.medical>=60).sort((a,b)=>b.medical-a.medical)[0];assert.ok(physician,'A second actual physician accompanies the second column.');
 const recruitCount=12-local.length;
 const recruits=[...candidates.filter(op=>op.id!==physician.id).slice(0,recruitCount-1),physician];assert.equal(recruits.length,recruitCount,'The actual local veterans and available paid recruits must supply the complete twelve-person arsenal force.');
 const hired=recruits.filter(op=>!c.recruited.includes(op.id));
 assert.ok(hired.reduce((sum,op)=>sum+contractQuote(c,op,'day').total,0)<=c.resources.treasury-30000,'The actual first paid terms must fit the treasury and return reserve.');
 for(const recruit of hired){
  retained.retain(3600);const quote=contractQuote(c,recruit,'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
  order({type:'recruitCivic',id:recruit.id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.total);
  report({event:'createdCuyoArsenalHired',id:recruit.id,quote,treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour,second:c.secondOfHour??0});
 }
 for(let hour=0;hour<24&&recruits.some(op=>!c.recruited.includes(op.id));hour++)order({type:'wait',hours:1});
 assert.ok(recruits.every(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'));
 const field=[...local,...recruits.map(op=>op.id)],columns=[];
 const localSlots=c.squads.filter(q=>q.id!==originalSquad&&q.location==='mendoza'&&!q.journey).map(q=>q.id);
 for(let offset=0;offset<field.length;offset+=6){
  const slot=localSlots.find(id=>!columns.includes(id)),ids=field.slice(offset,offset+6);
  if(slot){order({type:'selectSquad',id:slot});order({type:'squad',ids});}
  else order({type:'createSquad',name:'Arsenal de Barragán',ids,sector:'mendoza'});
  columns.push(c.activeSquadId);
 }
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of field)if(c.operativeState[id].weaponDropped||![1800,1801,1802,1803].includes(rosterFor(c).find(op=>op.id===id).weapon))c=recoverRoutePrimary(c,id,{preferredWeapon:1801,replace:true,report});
 assert.ok(field.every(id=>!c.operativeState[id].weaponDropped&&[1800,1801,1802,1803].includes(rosterFor(c).find(op=>op.id===id).weapon)),'Every actual arsenal soldier must hold a compatible firearm before ammunition is supplied.');
 c=supplyFreshMountainAmmunition(c,field,{target:12,report});
 const doctor=rosterFor(c).filter(op=>local.includes(op.id)&&op.medical>=60).sort((a,b)=>b.medical-a.medical)[0];
 const medicalReserves={};
 for(const op of [doctor,physician]){
  const localStock=()=>c.operativeState[op.id].medkits+sectorInventoryModel(c,'mendoza',rosterFor(c),op.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0)+
   c.recruited.filter(id=>id!==op.id&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza'&&!sectorInventoryModel(c,'mendoza',rosterFor(c),id).reason).reduce((sum,id)=>sum+Math.max(0,c.operativeState[id].medkits-(medicalReserves[id]??0)),0);
  for(let delivery=0;localStock()<8;delivery++){
   assert.ok(delivery<8,'Finite arsenal medical couriers must make actual progress.');
   const found=collectRouteMedicalSupplies(c,op.id,8-localStock(),{mode:c.routes.posta?'posta':'march',report});c=found.campaign;
   assert.ok(found.collected>0);
  }
  c=supplyRouteDressings(c,op.id,8,{reserves:medicalReserves,report});medicalReserves[op.id]=8;
 }
 order({type:'configureArtillery',types:[]});
 for(const id of columns){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c,{report});order({type:'travel',sector:'buenos_aires',mode:'posta',queue:true});}
 for(let hour=0;hour<168&&columns.some(id=>c.squads.find(q=>q.id===id).journey);hour++){
  resolve();for(const id of columns)if(c.squads.find(q=>q.id===id).journey?.status==='paused'){order({type:'selectSquad',id});order({type:'resumeTravel'});}
  order({type:'wait',hours:1});
 }
 resolve();assert.equal(c.location,'buenos_aires');assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='buenos_aires'&&!c.squads.find(q=>q.id===id).journey));
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<72&&(c.hour%24<6||c.hour%24>10||field.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;}));hour++)order({type:'wait',hours:1});
 for(const operativeId of field){assert.ok(!c.operativeState[operativeId].fatigue&&c.operativeState[operativeId].energy===100&&!c.operativeState[operativeId].asleep);order({type:'assignCare',operativeId,assignment:'active'});}
 for(const id of columns){order({type:'selectSquad',id});order({type:'attack',sector:'ensenada',queue:true,mode:'posta'});}
 for(let hour=0;hour<24&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');hour++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));retained.retain(8*3600);
 // Existing serving veterans stay after the temporary recruits return.
 // Pay their actual terms before combat can make a renewal unavailable.
 // The cart route is a public plan; only a real victory can ship the guns.
 const cartPath=artilleryTransportPath(c,'ensenada','mendoza','carts');assert.ok(c.routes.carts&&cartPath,'The finite arsenal needs its controlled public return route.');
 const cartHours=(cartPath.length-1)*artilleryTransportRules(c).cartsHours,deadline=c.hour*3600+(c.secondOfHour??0)+(8+cartHours)*3600;
 const temporary=new Set(hired.map(op=>op.id));
 for(const id of living(c).filter(id=>!temporary.has(id))){
  let contract=c.contracts[id],expiry=contractExpiresSeconds(contract);
  while(expiry!==null&&expiry<=deadline){
   const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);
   const cash=c.resources.treasury,prior=structuredClone(contract),action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
   order(action);assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),quote.expiresAt*3600+(quote.expiresSecond??0));
   report({event:'createdCuyoArsenalReturnRetained',id,action,quote,prior,contract:structuredClone(c.contracts[id]),paid:quote.price,deadline,cartHours,hour:c.hour,second:c.secondOfHour??0});
   contract=c.contracts[id];expiry=contractExpiresSeconds(contract);
  }
 }
 // A keeper with an authored low-morale refusal can become unavailable after
 // real losses. Quote the existing next reserve phase while renewal is legal.
 // Ordinary keepers still renew as needed; temporary recruits still end service.
 const roster=rosterFor(c),reserveKeepers=living(c).filter(id=>!temporary.has(id)&&contractExpiresSeconds(c.contracts[id])!==null&&lowMoraleRenewalStatus(c,roster.find(op=>op.id===id)).eligible);
 if(reserveKeepers.length){
  const rear=roster.filter(op=>op.id>=100&&op.id<1000&&living(c).includes(op.id)&&!temporary.has(op.id)&&!field.includes(op.id)&&op.medical<60&&stable(c,op.id)&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&c.operativeState[op.id].location!=='mendoza'&&c.sectors[c.operativeState[op.id].location]?.owner==='patriot'&&!c.squads.find(q=>q.members.includes(op.id))?.journey)
   .sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).slice(0,NATIVE_MOUNTAIN_RESERVE_BOUNDS.count);
  const routes=[...new Set(rear.map(op=>c.operativeState[op.id].location))].map(from=>{
   const path=artilleryTransportPath(c,from,'mendoza','carts');assert.ok(path,'The known rear reserve needs a controlled public road to Mendoza.');
   const ids=rear.filter(op=>c.operativeState[op.id].location===from).map(op=>op.id),hours=path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(path[i],to,'posta',c),0);
   return {from,path,ids,hours,columns:Math.ceil(ids.length/6)};
  });
  const infantryReturnHours=cartPath.slice(1).reduce((sum,to,i)=>sum+travelLegHours(cartPath[i],to,'posta',c),0),preMarchRestHours=routes.reduce((sum,route)=>sum+route.columns,0)*NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours,reserveTravelHours=Math.max(0,...routes.map(route=>route.hours));
  const hours=8+Math.max(cartHours,infantryReturnHours)+preMarchRestHours+reserveTravelHours+NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,clock=c.hour*3600+(c.secondOfHour??0),reserveDeadline=clock+hours*3600;
  const quotes=reserveKeepers.map(id=>{const quote=contractRenewalQuote(c,roster.find(op=>op.id===id),'day'),expiry=contractExpiresSeconds(c.contracts[id]);assert.equal(quote.available,true,quote.reason);const renewals=Math.max(0,Math.floor((reserveDeadline-expiry)/(quote.hours*3600))+1);return {id,quote,renewals,cost:renewals*quote.price};}),cost=quotes.reduce((sum,row)=>sum+row.cost,0),cash=c.resources.treasury;
  assert.ok(cost<=cash,'The actual next reserve service must fit the current treasury without projected income.');
  report({event:'createdCuyoArsenalReserveRetentionPlan',ids:reserveKeepers,routes,cartHours,infantryReturnHours,preMarchRestHours,reserveTravelHours,readinessRestHours:NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,hours,deadline:reserveDeadline,quotes,cost,treasury:cash,hour:c.hour,second:c.secondOfHour??0});
  for(const id of reserveKeepers)while(contractExpiresSeconds(c.contracts[id])<=reserveDeadline){
   const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);
   const prior=structuredClone(c.contracts[id]),body=structuredClone(c.operativeState[id]),beforeCash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:prior.expiresAt,expectedExpiresSecond:prior.expiresSecond??0};
   order(action);assert.equal(c.resources.treasury,beforeCash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),contractExpiresSeconds(prior)+quote.hours*3600);assert.equal(c.hour*3600+(c.secondOfHour??0),clock);
   const physical=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!['morale','lastMoralePayAt','lastMoralePaySecond'].includes(key)));
   assert.deepEqual(physical(c.operativeState[id]),physical(body),'Quoted renewal keeps actual health, wounds, property, position and service body state.');assert.ok(c.operativeState[id].morale>=body.morale&&c.operativeState[id].morale<=Math.min(100,body.morale+2));
   report({event:'createdCuyoArsenalReserveRetained',id,action,quote,prior,contract:structuredClone(c.contracts[id]),paid:quote.price,deadline:reserveDeadline,hour:c.hour,second:c.secondOfHour??0,treasuryBefore:beforeCash,treasury:c.resources.treasury});
  }
  assert.equal(c.resources.treasury,cash-cost);assert.ok(reserveKeepers.every(id=>contractExpiresSeconds(c.contracts[id])>reserveDeadline));
 }
 order({type:'beginAssault',sector:'ensenada'});assert.deepEqual(c.pendingBattle.squad.map(op=>op.id),field);assert.deepEqual(c.pendingBattle.artillery,[]);
 report({event:'createdCuyoArsenalAssaultReady',field,doctors:[doctor.id,physician.id],reinforcements:hired.map(op=>op.id),hour:c.hour,second:c.secondOfHour,campaign:c});
 return {campaign:c,originalSquad,originalMembers,field,recruits:hired.map(op=>op.id)};
 }catch(error){recordRouteStrategicEvidence({helper:'prepareCreatedCuyoArsenalAssault',stage:'preparation-failure',campaign:c,inputCapture,error});throw error;}
}

export function recoverCreatedCuyoMountainArtillery(start,{report=()=>{},onCheckpoint=()=>{},preserveMedicalReserve=false,coordinateSupportStaging=false,coordinateRearFormation=false}={}){
 const before=structuredClone(start),oldDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const spent=Object.entries(start.artilleryDepots??{}).flatMap(([sector,guns])=>guns.filter(g=>!g.loaded&&!g.ammo).map(g=>({sector,gun:storedArtilleryRecord(g)})));
 const prepared=prepareCreatedCuyoArsenalAssault(start,{report});let c=prepared.campaign;
 onCheckpoint('arsenal-assault',c);
 const initial=enterSector(c.pendingBattle,c.sectorStates.ensenada),foundryField=initial.units.filter(unit=>unit.side==='player'&&unit.hp>0&&prepared.originalMembers.includes(Number(unit.id))).map(unit=>unit.id);
 recordRouteStrategicEvidence({helper:'recoverCreatedCuyoMountainArtillery',stage:'route-checkpoint',campaign:c,context:{scope:'True native pre-execution input after the one existing enterSector construction; no extra queries, entry, orders or synchronization.',request:c.pendingBattle,previous:c.sectorStates.ensenada??null,initial,originalMembers:prepared.originalMembers,field:prepared.field}});
 // Every present required founder follows behind the paid infantry. Fire,
 // reload and adjacent finite aid retain their ordinary native priorities.
 const reserveIds=foundryField;
 const controller=recoveryPortSearchController(initial,{reserveIds,coordinateInfantry:initial.artillery.every(gun=>gun.side!=='player'),coordinateRifleCover:preserveMedicalReserve,coordinateSupportStaging,coordinateRearFormation});
 const rear=preserveMedicalReserve?arsenalRearServicePlan(c,prepared.field,prepared.originalMembers,{fieldPhysicians:1}):null;
 // Historical earned callers retain the old default. The fresh route opts
 // into real departure and reunion of its scarce qualified/paid reserves.
 const executeBattle=rear?(request,previous,options)=>{
  const deploymentOrders=[];
  const result=fightPairedRouteBattle(c,request,previous,{...options,
   deploy:(battle,executeOrder)=>withdrawArsenalRear(initial,rear.withdrawalIds,{executeOrder,onOrder:action=>deploymentOrders.push(action)})(battle),
   onNativeResult:({result})=>{
    recordRouteStrategicEvidence({helper:'arsenalPairedNativeResult',stage:'route-checkpoint',campaign:c,context:{scope:'Complete actual native result, full paid deployment/combat order tape and returned pair before identity or replay comparisons. No additional queries, orders, synchronization or settlement.',request,previous,result}});
   },
   onExecution:({result,replay})=>{
    recordRouteStrategicEvidence({helper:'arsenalPairedExecution',stage:'route-checkpoint',campaign:c,context:{scope:'Actual native synchronized execution and complete replay before their exact comparison; no extra orders, synchronization or queries.',request,previous,result,replay}});
    if(result.battle.status!=='victory')recordRouteBattleFailure({campaign:c,request,previous,result,expectedOutcome:'victory',controller,deploy:null,executeBattle:null});
   },
  });
  for(const id of rear.withdrawalIds){const actor=result.battle.units.find(unit=>unit.id===String(id));assert.ok(actor?.hp>0);assert.equal(actor.departure?.destination,'buenos_aires');}
  return {...result,actions:result.actions+rear.withdrawalIds.length,deploymentOrders,medicalRear:rear};
 }:fight;
 const victory=fightNorthernSector(c,'ensenada',{controller,sharedFallback:controller.sharedFallback,executeBattle,report,
  ...(rear?{beforeSettlement:(pair,{execute})=>stabilizeCreatedCuyoBattleSurvivors(pair,{execute,report})}:{})});c=victory.campaign;
 onCheckpoint('arsenal-victory',c);
 if(rear){
  c=stabilizeCreatedCuyoSurvivors(c,{report});
  c=reuniteArsenalRear(c,rear.withdrawalIds,{report});
  const localSurvivors=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='ensenada');
  c=recoverCreatedCuyoLocalPatients(c,localSurvivors,{report});
  assert.ok(rear.reserveIds.every(id=>living(c).includes(id)&&c.operativeState[id].location==='ensenada'&&stable(c,id)&&c.operativeState[id].hp===c.operativeState[id].maxHp));
  report({event:'createdCuyoArsenalRearServicePreserved',...rear,hour:c.hour,second:c.secondOfHour??0,campaign:c});
 }
 const survivors=prepared.field.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.ok(survivors.length>=3,'The actual field gun needs three surviving available crew.');
 assert.ok(prepared.originalMembers.every(id=>c.operativeState[id].alive),'The original foundry squad must survive this side operation.');
 let retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});const order=action=>retained.order(action);
 const endService=id=>{
  const cash=c.resources.treasury;c=dispatchCampaign(c,{type:'dismiss',id});assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash);
  // Ending a paid term must not first purchase another day for that person.
  // Rebuild retention from the actual remaining serving cohort afterward.
  retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
  report({event:'createdCuyoArsenalServiceEnded',id,sector:'mendoza',hour:c.hour,second:c.secondOfHour});
 };
 const doctors=rosterFor(c).filter(op=>survivors.includes(op.id)&&op.medical>0&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 const remaining=[...survivors],groups=[],localSlots=c.squads.filter(q=>q.location==='ensenada'&&!q.journey).map(q=>q.id);
 while(remaining.length){
  const doctor=doctors.find(id=>remaining.includes(id));assert.notEqual(doctor,undefined,'Each actual surviving six-person care party needs a conscious member with medical skill.');
  const reserved=doctors.filter(id=>id!==doctor&&remaining.includes(id)).slice(0,Math.ceil(remaining.length/6)-1),ids=[doctor,...remaining.filter(id=>id!==doctor&&!reserved.includes(id))].slice(0,6);
  for(const id of ids)remaining.splice(remaining.indexOf(id),1);
  const slot=localSlots.find(id=>!groups.some(group=>group.id===id));
  if(slot){order({type:'selectSquad',id:slot});order({type:'squad',ids});}
  else order({type:'createSquad',name:'Arsenal y socorro de Barragán',ids,sector:'ensenada'});
  groups.push({id:c.activeSquadId,members:ids});
 }
 for(const operativeId of survivors)order({type:'assignCare',operativeId,assignment:'active'});retained.retain(8*3600);
 for(const group of [...groups].sort((a,b)=>Number(b.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding))-Number(a.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding)))){
  order({type:'selectSquad',id:group.id});let care=visit(c);const dressings=care.battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),aid=autoBandageBattle(care.battle);
  assert.equal(aid.battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0),dressings-aid.steps.filter(action=>action.type==='useItem').length,'First aid consumes one actual finite dressing per treatment.');
  care=sync({campaign:care.campaign,battle:aid.battle});assert.deepEqual(aid.untreated,[],'Finite actual first aid must stabilize the surviving coastal crew.');c=leave(care);
  report({event:'createdCuyoArsenalCare',ids:group.members,treated:aid.treatedIds,seconds:aid.elapsedSeconds,dressingsSpent:aid.steps.filter(action=>action.type==='useItem').length});
 }
 assert.ok(survivors.every(id=>stable(c,id)));order({type:'selectSquad',id:groups.find(q=>q.members.length>=3).id});let pair=visit(c);
 const carrier=pair.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.bleeding&&!u.unconscious&&!u.routed).sort((a,b)=>b.energy-a.energy)[0];assert.ok(carrier);
 pair=takeFiniteCache(pair,carrier.id,[]);c=leave(pair);
 const source=FINITE_ARTILLERY_ARSENALS.ensenada;
 assert.deepEqual(c.sectorStates.ensenada.artillery.map(storedArtilleryRecord),source.pieces,'The one-time chest exposes only its two canonical finite guns.');
 onCheckpoint('arsenal-open',c);
 for(const gun of source.pieces){
  const quote=artilleryTransportQuote(c,'ensenada',gun.id,'mendoza','carts','field');assert.equal(quote.available,true,quote.reason);
  const cash=c.resources.treasury;order({type:'transportArtillery',sector:'ensenada',artilleryId:gun.id,to:'mendoza',mode:'carts',source:'field'});assert.equal(c.resources.treasury,cash-quote.cost);
  assert.deepEqual(c.artilleryTransfers.find(t=>t.id===gun.id).gun,gun);
  report({event:'createdCuyoArsenalShipment',id:gun.id,cost:quote.cost,hours:quote.hours,hour:c.hour});
 }
 for(const group of groups){order({type:'selectSquad',id:group.id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
 for(let hour=0;hour<168&&(groups.some(group=>c.squads.find(q=>q.id===group.id).journey)||source.pieces.some(gun=>!c.artilleryDepots.mendoza?.some(g=>g.id===gun.id)));hour++){
  // End temporary service after the real return, while the slower carts
  // finish their paid delivery. Their exact returned kit stays in Mendoza.
  for(const id of prepared.recruits)if(!rear?.reserveIds.includes(id)&&c.recruited.includes(id)&&c.operativeState[id].alive&&c.operativeState[id].location==='mendoza'&&!c.squads.some(q=>q.members.includes(id)&&q.journey)){
   endService(id);
  }
  // The actual rear may arrive before its slow finite guns. Use that
  // existing delivery wait for native rest; never rest a travelling keeper
  // or replace a current patient/doctor duty. The default caller is unchanged.
  if(rear)for(const id of rear.reserveIds){
   const home=c.squads.find(q=>q.members.includes(id)),r=c.operativeState[id];
   if(home?.location!=='mendoza'||home.journey||r.location!=='mendoza'||r.assignment==='rest')continue;
   assert.ok(living(c).includes(id)&&stable(c,id)&&r.hp===r.maxHp,'An arrived rear keeper must remain actual full-health local serving personnel.');
   assert.equal(r.assignment,'active','Existing clinical or working duties must not be silently replaced by arrival rest.');
   assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
   // Any real due fee belongs before the zero-time assignment baseline.
   // Keep the existing all-serving retained guard and its actual day quotes.
   retained.retain();
   const body=structuredClone(c.operativeState[id]),terms=structuredClone(c.contracts),cash=c.resources.treasury,clock=[c.hour,c.secondOfHour??0],action={type:'assignCare',operativeId:id,assignment:'rest'};
   order(action);
   assert.equal(c.resources.treasury,cash);assert.deepEqual([c.hour,c.secondOfHour??0],clock);assert.deepEqual(c.contracts,terms);
   assert.deepEqual(c.operativeState[id],{...body,assignment:'rest',recoveryHours:0},'Native arrival rest changes only the admitted assignment and its normal work counter.');
   report({event:'createdCuyoArsenalArrivalRest',id,action,hour:c.hour,second:c.secondOfHour??0,treasury:cash,bodyBefore:body,bodyAfter:structuredClone(c.operativeState[id]),contract:structuredClone(c.contracts[id])});
  }
  const waitBefore=rear?c.hour*3600+(c.secondOfHour??0):null;
  order({type:'wait',hours:1});
  if(rear){
   const advanced=c.hour*3600+(c.secondOfHour??0)-waitBefore,notices=[c.assignmentAttention?.notice,c.contractAttention?.notice,c.logisticsNotice,c.travelNotice].filter(Boolean);
   assert.ok(advanced===0||advanced===3600,'The unchanged hourly delivery wait uses only its actual Native returned clock.');
   if(!advanced)assert.ok(notices.length,'A zero-time delivery pause needs an actual Native attention notice.');
   report({event:'createdCuyoArsenalDeliveryWait',seconds:advanced,hour:c.hour,second:c.secondOfHour??0,notices:structuredClone(notices)});
  }
 }
 assert.equal(c.location,'mendoza');assert.ok(groups.every(group=>!c.squads.find(q=>q.id===group.id).journey));
 if(rear)c=restArsenalRear(c,rear.reserveIds,{maxHours:NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,report});
 // The opt-in rear remains actual paid local service for the next mountain
 // preparation. A default temporary hire still ends service normally.
 for(const id of prepared.recruits)if(!rear?.reserveIds.includes(id)&&c.recruited.includes(id)&&c.operativeState[id].alive)endService(id);
 for(const id of prepared.originalMembers)if(!c.squads.find(q=>q.id===prepared.originalSquad).members.includes(id))order({type:'assignToSquad',operativeId:id,squadId:prepared.originalSquad});
 order({type:'selectSquad',id:prepared.originalSquad});assert.deepEqual(c.squad,prepared.originalMembers);
 for(const {sector,gun}of spent)assert.deepEqual(c.artilleryDepots[sector].find(g=>g.id===gun.id),gun,'Existing spent pieces retain their original depot and exact ammunition.');
 for(const gun of source.pieces)assert.deepEqual(c.artilleryDepots.mendoza.find(g=>g.id===gun.id),gun,'The exact two finite arsenal guns arrive without changing ammunition.');
 for(const id of oldDeaths)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(start,before);
 const selections=source.pieces.map(gun=>'depot:'+gun.id);onCheckpoint('arsenal-delivered',c);
 report({event:'createdCuyoMountainArsenalReady',selections,hour:c.hour,second:c.secondOfHour,campaign:c});
 return {campaign:saved({campaign:c}).campaign,selections,summary:victory.summary};
}
