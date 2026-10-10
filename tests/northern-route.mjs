import {northernFieldSurvivors} from './northern-field-survivors.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {assertCustodyCare} from './custody-care-evidence.mjs';
import {prepareOpeningPatrolMedicalReadiness} from './opening-patrol-medical-readiness.mjs';
import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fight,combatOrder} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {enterSector} from '../game/world.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {actBattle,getReachable,teamCanSee,stanceCost,actionCosts,hasLineOfSight,firearmShotOptions,weaponFor,interruptAvailable} from '../game/tactical.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {doctorRate} from '../game/medical-care.js';
import {assignNorthernCareRoles} from './northern-care-roles.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {contractQuote} from '../game/contracts.js';
import {hiringTravelHours,pendingHire,hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {collectRouteItems,collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {prepareRouteSupportBattery} from './route-support-battery.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {recordRouteBattleFailure} from './route-failure-evidence.mjs';

// Both paid squads approach together in short bounds. Use authored roof
// geometry and current shot previews, while retaining real casualties,
// ammunition and action costs. This policy does not replace the deliberately
// exposed advance used later to verify defeat and captivity.
export function northernReconOrder(battle,unit){return hiredAssaultOrder(battle,unit,{reconBudget:16});}

export function northernCombatOrder(battle,unit){
 const action=combatOrder(battle,unit);
 // A doctor without ammunition keeps a low profile at the reserve position.
 // Adjacent aid and weapon maintenance remain available through normal orders.
 if(unit.medical>=60&&!unit.loaded&&!availableAmmunition(unit)&&action?.type==='move')return unit.stance!=='prone'&&unit.ap>=stanceCost(unit,'prone')?{type:'stance',unitId:unit.id,stance:'prone'}:null;
 if(action?.type==='stance'&&action.stance==='prone'&&unit.stance==='standing')return {...action,stance:'crouched'};
 if(action?.type!=='fire'&&!(action?.type==='stance'&&action.stance==='prone'))return action;
 const targets=battle.units.filter(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.surrendered&&!target.unconscious&&!target.routed&&teamCanSee(battle,unit.side,target));
 const shots=[];
 // Select from the actual cursor previews, including body height and known
 // civilian bodies, instead of firing torso shots through a blocked lane.
 for(const target of targets){
  const cost=actionCosts(battle,unit,target);if(unit.ap<cost.fire)continue;
  const maxAim=Math.min(4,Math.floor((unit.ap-cost.fire)/cost.aim));
  const safe=knownRouteShotSafety(battle,unit,target);
  for(const option of firearmShotOptions(battle,unit,target,maxAim)){
   if(!safe(option))continue;
   if(option.chance<25)continue;
   const damage=weaponFor(unit).damage,effect=shotLocationEffects(option.hitLocation,damage*option.damageFactor,target);
   const value=Math.min(target.hp,effect.damage)+(target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0));
   const score=option.chance*value/Math.max(1,Math.min(target.hp,damage))-(cost.fire+option.aim*cost.aim)*.2;
   shots.push({score,action:{type:'fire',unitId:unit.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation}});
  }
 }
 const ranked=shots.sort((a,b)=>b.score-a.score)[0]?.action;
 if(ranked)return ranked;
 if(action?.type==='fire'){
  const target=battle.units.find(target=>target.id===action.targetId);
  const preview=target&&firearmShotOptions(battle,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
  if(!knownRouteShotSafety(battle,unit,target)(preview)){
   // A blocked shot can still admit an ordinary paid posture or cover move.
   // Let the native chooser use only the squad's currently known occupants.
   const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:(battle.npcs??[]).filter(other=>teamCanSee(battle,unit.side,other))};
   const alternative=chooseEnemyAction(view,unit);
   if(!alternative&&!unit.mounted&&interruptAvailable(view,unit)){
    // Match the northern useful-shot threshold after paying to lower the gun
    // and change posture. Keep an affordable native alternative first.
    const postures=['crouched','standing','prone'].filter(stance=>stance!==unit.stance).sort((a,b)=>stanceCost(unit,a)-stanceCost(unit,b));
    for(const stance of postures){
     const cost=stanceCost(unit,stance);if(cost<=0||cost>=unit.ap)continue;
     const position={...unit,stance,movementMode:stance==='prone'?'prone':stance==='crouched'?'crouch':'walk',momentum:0,weaponReady:false,ap:unit.ap-cost};
     const posed={...view,units:view.units.map(other=>other.id===unit.id?position:other)};
     const useful=targets.some(target=>{
      if(!teamCanSee(posed,unit.side,target)||!hasLineOfSight(posed,position,target))return false;
      const costs=actionCosts(posed,position,target);if(position.ap<costs.fire)return false;
      const aim=Math.min(4,Math.floor((position.ap-costs.fire)/costs.aim));
      const safe=knownRouteShotSafety(posed,position,target);
      return firearmShotOptions(posed,position,target,aim).some(option=>option.chance>=25&&option.damageFactor>0&&safe(option));
     });
     if(useful)return {type:'stance',unitId:unit.id,stance};
    }
   }
   if(alternative?.type!=='fire')return alternative;
   const other=view.units.find(target=>target.id===alternative.targetId);
   const forecast=other&&firearmShotOptions(view,unit,other,alternative.aim??0).find(option=>option.aim===(alternative.aim??0)&&option.hitLocation===(alternative.hitLocation??'torso'));
   return knownRouteShotSafety(view,unit,other)(forecast)?alternative:null;
  }
 }
 return action;
}

// The paid clinic guards already reached roof cover before the patrol left.
// Hold that position while firing, tending adjacent wounds and reloading;
// ground-level defenders keep the ordinary infantry policy.
export function northernClinicDefenseOrder(battle,unit){
 const action=northernCombatOrder(battle,unit);
 // A knocked-down guard must pay the native standing recovery before holding roof cover.
 if(unit.knockedDown&&action?.type==='stance'&&action.stance==='standing')return action;
 if((unit.tacticalLevel??0)>0&&(action?.type==='move'||action?.type==='charge'||action?.type==='stance'&&action.stance==='standing')){
  const contact=battle.units.some(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.unconscious&&!target.routed&&!target.surrendered&&teamCanSee(battle,unit.side,target));
  if(battle.turn<20||contact)return null;
  // With contact cleared, the ordinary public search can leave cover. Admit
  // only a route that the present actor can actually pay and reach.
  if(action.type==='move'&&!getReachable(battle,unit,{stopAt:point=>sameCell(point,action)})[0])return null;
 }
 return action;
}

// Deliberately poor tactics for the captivity scenario: march into the open
// east court of the authored citadel, kneel and hold fire. Soldiers still use
// finite dressings for nearby bleeding allies. Only ordinary enemy turns cause
// wounds; the route never assigns deaths or captures to chosen actors.
export function advanceOnCitadelOrder(battle,unit){
 if(battle.phase==='interrupt')return null;
 const patient=battle.units.filter(other=>other.side===unit.side&&other.hp>0&&!other.departure&&other.bleeding>0&&sameSurface(unit,other)&&Math.hypot(other.x-unit.x,other.y-unit.y)<=1.5&&hasLineOfSight(battle,unit,other)).sort((a,b)=>a.hp-b.hp)[0];
 const costs=actionCosts(battle,unit);
 if(patient&&unit.medkits>0&&unit.medical>0){
  if(unit.activeSlot==='medical'&&unit.ap>=costs.heal)return {type:'useItem',unitId:unit.id,targetId:patient.id};
  if(unit.activeSlot!=='medical'&&unit.ap>=costs.weapon+costs.heal)return {type:'weapon',unitId:unit.id,slot:'medical'};
 }
 const citadel=battle.buildings.find(building=>building.id==='tucuman:building');assert.ok(citadel);
 const target={x:citadel.x+citadel.width+1,y:citadel.y+citadel.height-1,tacticalLevel:0};
 const distance=point=>Math.hypot(point.x-target.x,point.y-target.y);
 const inCourt=point=>sameSurface(point,target)&&point.x>=target.x&&distance(point)<=3;
 if(inCourt(unit))return unit.stance!=='crouched'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
 const route=getReachable({...view,mode:'exploration'},unit).filter(inCourt).sort((a,b)=>a.cost-b.cost)[0];
 if(!route)return null;
 const reachable=getReachable(view,unit),step=[...route.path].reverse().map(point=>reachable.find(candidate=>sameCell(candidate,point))).find(point=>point?.path.length&&point.cost<=32);
 return step?{type:'move',unitId:unit.id,...spacePoint(step)}:null;
}

// A mission ally can win after the hired field squad dies. Rebuild that empty
// command through paid contracts and an ordinary march; the fallen stay dead.
export function stageNorthernCare(start){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const candidates=rosterFor(campaign).filter(op=>op.id>=100&&op.medical>=60).sort((a,b)=>Number(campaign.recruited.includes(b.id))-Number(campaign.recruited.includes(a.id))||b.medical-a.medical);
 const doctors=[...new Set([112,122,...candidates.map(op=>op.id)])].filter(id=>{
  const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.hp>=15&&(!campaign.recruited.includes(id)||r.location===campaign.location);
 }).slice(0,2);
 assert.equal(doctors.length,2,'two available doctors must provide paid relief');
 assert.equal(campaign.flags.sanLorenzo,true);assert.equal(campaign.phase,2);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const cash=campaign.resources.treasury;
 let expectedCost=0;
 for(const id of doctors){
  assert.ok(campaign.operativeState[id].alive&&!campaign.operativeState[id].captured,'relief doctors must remain available');
  if(campaign.recruited.includes(id))continue;
  expectedCost+=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'week').price;
  order({type:'recruitCivic',id,term:'week'});
 }
 const hiringCost=cash-campaign.resources.treasury;assert.equal(hiringCost,expectedCost);
 if(campaign.location!=='san_nicolas'){
  order({type:'squad',ids:doctors});
  campaign=completeTestTravel(campaign,{sector:'san_nicolas'});events.push({action:{type:'travel',sector:'san_nicolas'},hour:campaign.hour,second:campaign.secondOfHour??0});
  assert.equal(campaign.pendingEncounter,null,'the relief march must resolve real encounters before field recovery');
 }
 assert.equal(campaign.location,'san_nicolas');
 for(const id of doctors)assert.equal(campaign.operativeState[id].location,'san_nicolas');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 return {campaign,events,doctors,staging:{startHour:start.hour,arrivalHour:campaign.hour,startSector:start.location,hiringCost}};
}

// Continue the real opening result through ordinary recovery, contracts,
// finite sector equipment, and a new authored battle. Never synthesize victory.
export function prepareNorthernSquad(start,{report=()=>{},ammunitionTarget=10}={}){
 const staged=stageNorthernCare(start);let campaign=staged.campaign;
 const {events,doctors,staging}=staged,dead=Object.entries(start.operativeState).filter(([,record])=>!record.alive).map(([id])=>Number(id));
 const patients=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas'&&r.hp<r.maxHp;});
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const model=(id,sector='san_nicolas')=>sectorInventoryModel(campaign,sector,rosterFor(campaign),id);
 const gathered=[];
 const gather=(id,limit=1000,sector='san_nicolas')=>{
  let count=0;
  for(const row of model(id,sector).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   let take=Math.min(row.count,limit-count);if(!take)break;
   const action={type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected};
   while(take>0){const preview=dispatchCampaign(campaign,{...action,count:take});if(!preview.lastError)break;assert.equal(preview.lastError,'No queda espacio en el inventario.');take--;}
   if(!take)break;
   order({...action,count:take});
   assert.equal(model(id,sector).entries.find(r=>r.key===row.key)?.count??0,row.count-take);gathered.push({sector,sourceKey:row.key,count:take,remaining:row.count-take});count+=take;
  }
  return count;
 };
 const recoveryStart=start.hour;
 const recoveredDressings=gather(doctors[0])+gather(doctors[1],1000,'san_lorenzo');assert.ok(recoveredDressings>0);
 let donatedDressings=0;const donors=[];
 for(const id of campaign.recruited){
  const record=campaign.operativeState[id];
  if(doctors.includes(id)||!record.alive||record.captured||!record.medkits)continue;
  const available=model(id);if(available.operativeId!==id||available.reason)continue;
  const count=record.medkits;
  order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'drop',item:'medkits',count});
  assert.equal(campaign.operativeState[id].medkits,0,'the donor parts with the actual carried dressings');
  donors.push({id,count});donatedDressings+=count;
 }
 const collectedDonations=gather(doctors[0]);assert.ok(collectedDonations<=donatedDressings);
 const medicalStart=doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 let boughtDressings=0,laterRecoveredDressings=0;const medicalTrips=[];
 const careRenewals=[];
 const retainCareContracts=hours=>{
  for(const id of new Set([...doctors,...patients])){
   let contract=campaign.contracts[id];
   while(contract?.expiresAt!=null&&contract.expiresAt-campaign.hour<=hours){
    const before=campaign.resources.treasury;
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
    careRenewals.push({id,hour:campaign.hour,cost:before-campaign.resources.treasury});
    contract=campaign.contracts[id];
   }
  }
 };
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<60;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');
  retainCareContracts(2);
  if(doctors.every(id=>campaign.operativeState[id].medkits===0)){
   laterRecoveredDressings+=gather(doctors[0])+gather(doctors[1],1000,'san_lorenzo');
  }
  if(doctors.every(id=>campaign.operativeState[id].medkits===0)){
   // A real relief doctor finds remaining controlled finite dressings. Earlier
   // opening recovery may have exhausted Retiro; patients stay in San Nicolás.
   const courier=doctors[0],rate=doctorRate(rosterFor(campaign).find(op=>op.id===courier));
   const remainingDressings=patients.reduce((sum,id)=>sum+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/rate)+Number(campaign.operativeState[id].bleeding>0),0);
   assert.ok(remainingDressings>0);
   retainCareContracts(72);
   const found=collectRouteMedicalSupplies(campaign,courier,Math.min(20,remainingDressings),{report:event=>{
    if(event.event==='medicalCourierRenewal')careRenewals.push({id:event.id,hour:event.hour,cost:event.cost});
    if(event.event==='finiteMedicalCourier')medicalTrips.push({courier,startHour:(campaign.hour*3600+(campaign.secondOfHour??0))/3600,endHour:(campaign.hour*3600+(campaign.secondOfHour??0)+event.elapsedSeconds)/3600,quantity:event.quantity,unitPrice:0,cost:0,source:'finite-cache',sourceSector:event.source});
    report(event);
   }});
   campaign=found.campaign;laterRecoveredDressings+=found.collected;
   assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
   assert.equal(campaign.operativeState[courier].location,'san_nicolas','the actual supply courier must return to the clinic');
   assert.equal(campaign.squads.find(q=>q.members.includes(courier))?.journey,undefined,'the supply route must finish before medical work resumes');
  }
  campaign=assignNorthernCareRoles(campaign,doctors,patients,action=>{order(action);return campaign;});
  order({type:'wait',hours:1});
 }
 report({event:'northernCareCheckpoint',hour:campaign.hour,treasury:campaign.resources.treasury,medicalTrips,careRenewals,doctors:doctors.map(id=>({id,medkits:campaign.operativeState[id].medkits,assignment:campaign.operativeState[id].assignment})),patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,maxHp:campaign.operativeState[id].maxHp,assignment:campaign.operativeState[id].assignment}))});
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp,`patient ${id} must finish paid care`);
 const usedDressings=medicalStart+boughtDressings+laterRecoveredDressings-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 assert.ok(patients.length?usedDressings>0:usedDressings===0,'only actual surviving patients consume recovery supplies');
 for(const operativeId of [...doctors,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 // Rest and stage for a daylight arrival without editing health or clocks.
 const departure=campaign.hour+6+(24-(campaign.hour+6)%24)%24;
 for(let i=0;campaign.hour<departure&&i<80;i++){retainCareContracts(24);order({type:'wait',hours:1});}assert.equal(campaign.hour,departure);
 // Patients and doctors already received ordinary rest orders above. An
 // excluded recovering patient keeps that native rest assignment.
 const survivors=northernFieldSurvivors(campaign,doctors,'san_nicolas');
 const replacements=[];
 for(const id of [120,134,136,117,119,127]){
  if(survivors.length+replacements.length>=6)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive)continue;
  const before=campaign.resources.treasury;order({type:'recruitCivic',id,term:'week'});
  assert.ok(campaign.resources.treasury<before,'a replacement has a real paid contract');replacements.push(id);
 }
 const ids=[...survivors,...replacements].slice(0,6);assert.equal(ids.length,6,'the living force has six paid or surviving soldiers');order({type:'squad',ids});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 // Reuse actual fallen soldiers' long guns and clothing, keeping all identities.
 for(const id of ids.filter(id=>replacements.includes(id)||campaign.operativeState[id].weaponDropped)){
  const source=['san_nicolas','san_lorenzo'].flatMap(sector=>model(id,sector).entries.map(row=>({...row,sector}))).find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
  if(source){const incoming=JSON.parse(source.expected);order({type:'sectorInventory',sector:source.sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
   const item=model(id,source.sector).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);
   assert.ok(item);order({type:'sectorInventory',sector:source.sector,operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  }
  if(!campaign.operativeState[id].outfit){const outfit=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='outfit');if(outfit){order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});const carried=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));order({type:'sectorInventory',sector:'san_nicolas',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});}}
 }
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of ids){assert.ok(campaign.operativeState[id].hp>=15);assert.equal(campaign.operativeState[id].bleeding,0);}
 // A spent rifle cannot use the surviving musket cartridges. Equip an
 // actually recovered compatible gun when its finite family stock is short.
 // Keep the rifle and its remaining loads in the soldier's own pockets.
 const ammunitionTransactions=[],armamentChanges=[];
 const carried=id=>carriedAmmunition(rosterFor(campaign).find(op=>op.id===id),campaign.operativeState[id]);
 const knownRows=id=>['san_nicolas','san_lorenzo'].flatMap(sector=>model(id,sector).entries.filter(row=>row.reachable).map(row=>({...row,sector,stack:JSON.parse(row.expected)})));
 const knownRounds=(id,family)=>knownRows(id).filter(row=>row.stack.kind==='ammunition'&&row.stack.ammoType===AMMUNITION_FAMILIES[family].type).reduce((sum,row)=>sum+row.count,0)+(campaign.ammunitionStores.san_nicolas?.[family]??0);
 for(const id of ids){
  let unit=carried(id),family=ammoTypeFor({...unit,activeSlot:'primary'});if(!family||unit.weaponDropped)continue;
  if(unit.loaded+ammoCount(unit,family)+knownRounds(id,family)<ammunitionTarget){
   const source=knownRows(id).find(row=>[1800,1801,1803].includes(row.stack.weapon)&&(row.stack.loaded??0)+ammoCount(unit,'ammoMusket')+knownRounds(id,'ammoMusket')>=ammunitionTarget);
   assert.ok(source,`no finite compatible armament is available for ${id}`);
   const oldWeapon=unit.weapon;
   order({type:'sectorInventory',sector:source.sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
   const item=model(id,source.sector).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===source.stack.weapon);assert.ok(item);
   order({type:'sectorInventory',sector:source.sector,operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
   unit=carried(id);family=ammoTypeFor({...unit,activeSlot:'primary'});armamentChanges.push({id,oldWeapon,weapon:unit.weapon,source:source.sector});
  }
  // Completed San Lorenzo is a physical scene in this locality. Transfer its
  // known cartridges before asking the town's finite stock for the remainder.
  let missing=Math.max(0,ammunitionTarget-unit.loaded-ammoCount(unit,family));
  while(missing){
   const row=knownRows(id).find(row=>row.sector==='san_lorenzo'&&row.stack.kind==='ammunition'&&row.stack.ammoType===AMMUNITION_FAMILIES[family].type);if(!row)break;
   const quantity=Math.min(missing,row.count),before=ammoCount(carried(id),family),cash=campaign.resources.treasury;
   const action={type:'sectorInventory',sector:row.sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity};order(action);
   assert.equal(ammoCount(carried(id),family),before+quantity);assert.equal(campaign.resources.treasury,cash);
   assert.equal(model(id,row.sector).entries.find(source=>source.key===row.key)?.count??0,row.count-quantity);
   const transaction={action,sector:campaign.location,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0,cost:0,quantity,family,sourceKind:row.kind};ammunitionTransactions.push(transaction);report(transaction);missing-=quantity;
  }
 }
 const supplied=supplyRouteAmmunition(campaign,ids,{target:ammunitionTarget,report:event=>events.push(event)});campaign=supplied.campaign;
 assert.ok(campaign.resources.treasury>=0);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour:recoveryStart,endHour:campaign.hour,staging,doctors,patients,usedDressings,boughtDressings,medicalTrips,careRenewals,recoveredDressings,laterRecoveredDressings,collectedDonations,donatedDressings,donors,replacements,fieldIds:ids,gathered,armamentChanges,ammunitionTransactions:[...ammunitionTransactions,...supplied.transactions]};report({event:'recovered',...recovery,cash:campaign.resources.treasury});
 return {campaign,events,dead,recovery};
}

export function fightNorthernSector(start,sector,{report=()=>{},expectedOutcome='victory',controller,deploy,executeBattle=fight}={}){
 const before=structuredClone(start),prepared=start.pendingBattle?structuredClone(start):finishReloadsBeforeMarch(start,{report});
 const preparationSeconds=(prepared.hour-start.hour)*3600+(prepared.secondOfHour??0)-(start.secondOfHour??0),campaign=start.pendingBattle?prepared:dispatchCampaign(prepared,{type:'attack',sector});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,before);assert.ok(campaign.pendingBattle,'the real march produces a tactical deployment');
 const request=campaign.pendingBattle;assert.equal(request.sector,sector);
 report({event:'battleStarted',sector,hour:campaign.hour,units:request.squad.map(u=>u.id)});
 const result=executeBattle(request,campaign.sectorStates[sector],{controller,deploy});
 const summary={sector,preparationSeconds,startSeconds:result.battle.startSeconds,elapsedSeconds:result.battle.elapsedSeconds,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});
 assert.ok(['victory','defeat','retreat'].includes(expectedOutcome));
 if(result.battle.status!==expectedOutcome)recordRouteBattleFailure({campaign,request,previous:campaign.sectorStates[sector],result,expectedOutcome,controller,deploy,executeBattle});
 assert.equal(result.battle.status,expectedOutcome,JSON.stringify(summary));
 const replay=executeBattle(request,campaign.sectorStates[sector],{controller,deploy});assert.deepEqual(replay.battle,result.battle);
 const pair=syncBattleTime(campaign,result.battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 const returned=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(returned.lastError,null,returned.lastError);
 // A cleared battlefield cannot certify a continuing campaign when its
 // commander has died and settlement has made the campaign terminal.
 if(expectedOutcome==='victory'){
  if(returned.defeated)recordRouteBattleFailure({campaign,request,previous:campaign.sectorStates[sector],result,expectedOutcome,controller,deploy,executeBattle,returnedCampaign:returned,failureStage:'campaign-after-victory'});
  assert.equal(returned.defeated,false,'a route victory must leave the campaign playable');
 }
 const navalLoss=expectedOutcome==='defeat'&&request.defenseGroupId&&campaign.enemyGroups.find(group=>group.id===request.defenseGroupId)?.theater==='coast';
 if(request.missionId==='san_lorenzo'){assert.equal(returned.flags.sanLorenzo,expectedOutcome==='victory');if(expectedOutcome==='victory')assert.equal(returned.defeated,false);}
 else assert.equal(returned.sectors[sector].owner,expectedOutcome==='victory'?'patriot':expectedOutcome==='retreat'||navalLoss?campaign.sectors[sector].owner:'royalist');
 assert.equal(returned.pendingBattle,null);
 if(navalLoss){assert.equal(returned.blockade,true);assert.equal(returned.enemyGroups.find(group=>group.id===request.defenseGroupId).status,'stationed');}

 for(const u of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0)){
  if(u.militia)assert.ok(!(returned.garrisons[sector]??[]).some(v=>String(v.id)===u.id&&v.hp>0),'fallen militia must not return to the garrison');
  else if(u.missionAlly)assert.equal(returned.missionAllies[request.missionId].hp,0);
  else assert.equal(returned.operativeState[Number(u.id)].alive,false);
 }
 assert.deepEqual(decodeSave(encodeSave(returned)).campaign,returned);
 return {campaign:returned,summary};
}

export function prepareTucumanSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.location,'cordoba');assert.equal(campaign.sectors.cordoba.owner,'patriot');
 const events=[],reliefDoctor=139,dead=Object.entries(campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),originalSquad=[...campaign.squad];let doctor=reliefDoctor;
 const patients=originalSquad.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 const order=action=>{const cash=campaign.resources.treasury,next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0,cost:cash-campaign.resources.treasury});};
 const startHour=campaign.hour,cash=campaign.resources.treasury,doctorQuote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===doctor),'week');
 order({type:'recruitCivic',id:doctor,term:'week'});assert.equal(cash-campaign.resources.treasury,doctorQuote.price);
 const secondDoctor=146,secondQuote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===secondDoctor),'week'),secondCash=campaign.resources.treasury;
 order({type:'recruitCivic',id:secondDoctor,term:'week'});assert.equal(secondCash-campaign.resources.treasury,secondQuote.price);
 const initialFort=campaign.sectors.cordoba.fort;
 for(let level=initialFort;level<3;level++){const before=campaign.resources.treasury;order({type:'fortify',sector:'cordoba'});assert.equal(before-campaign.resources.treasury,150);}
 // Hiring fills an empty field slot. Leave the paid doctor in local reserve.
 order({type:'squad',ids:originalSquad});assert.deepEqual(campaign.squad,originalSquad);
 const replacements=[];
 // The same paid relief patrol guards the clinic while the veterans recover.
 // Its contracts, arrival equipment and dressings are ordinary finite service.
 for(const id of [131,121,124,126,125,129,130]){
  if(replacements.length>=4)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive)continue;
  const offered=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'week'});if(offered.lastError)continue;
  const before=campaign.resources.treasury;order({type:'recruitCivic',id,term:'week'});assert.ok(campaign.resources.treasury<before);replacements.push(id);
 }
 doctor=rosterFor(campaign).filter(op=>campaign.recruited.includes(op.id)&&!patients.includes(op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured&&campaign.operativeState[op.id].location==='cordoba'&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding&&!campaign.operativeState[op.id].asleep&&campaign.operativeState[op.id].energy>10&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0]?.id;assert.ok(doctor,'the clinic needs its strongest qualified paid local doctor');
 // Give local carried dressings to the qualified physician before collecting
 // another finite source. Every donor keeps its actual health and assignment.
 const assistants=[reliefDoctor,secondDoctor].filter(id=>id!==doctor&&campaign.operativeState[id].medkits>0);
 let donatedDressings=0;
 for(const id of campaign.recruited.filter(id=>id!==doctor&&!assistants.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='cordoba'&&campaign.operativeState[id].medkits>0)){
  const donor=sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);if(donor.reason)continue;
  const count=campaign.operativeState[id].medkits;order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'drop',item:'medkits',count});
  let remaining=count;
  while(remaining){const row=sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),doctor).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);const quantity=Math.min(remaining,row.count);order({type:'sectorInventory',sector:'cordoba',operativeId:doctor,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity});remaining-=quantity;}
  assert.equal(campaign.operativeState[id].medkits,0);donatedDressings+=count;
 }
 const carried=campaign.operativeState[doctor].medkits,found=collectRouteItems(campaign,doctor,{item:'medkits'},12);campaign=found.campaign;
 assert.equal(campaign.operativeState[doctor].medkits,carried+found.collected);
 // Two paid physicians share the same finite stock. The veterans' dressings
 // support qualified local care instead of waiting for one doctor's sleep.
 for(const id of assistants){const count=Math.floor((campaign.operativeState[doctor].medkits-campaign.operativeState[id].medkits)/2);if(count<=0)continue;
  order({type:'sectorInventory',sector:'cordoba',operativeId:doctor,direction:'drop',item:'medkits',count});
  let remaining=count;while(remaining){const row=sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);const quantity=Math.min(remaining,row.count);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity});remaining-=quantity;}
 }
 for(const operativeId of originalSquad)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':'rest'});
 order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
 const medicalStart=campaign.operativeState[doctor].medkits,boughtDressings=0;let laterFoundDressings=0;
 const doctors=[doctor,...assistants],assistantStock=assistants.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 for(const operativeId of assistants)order({type:'assignCare',operativeId,assignment:'doctor'});
 // Stable survivors assist with their carried dressings. The paid doctor
 // recovers only real local supplies and heals more per finite dressing.
 // Several critical survivors share the team's real work and sleep periods.
 // Allow up to four days of paid care; do not treat forty hours as a cure.
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<96;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before continuing care');
  if(!campaign.operativeState[doctor].medkits){
   // An exhausted physician cannot access the cache while asleep. An awake
   // paid assistant can collect its remaining dressings and continue care.
   const collector=rosterFor(campaign).filter(op=>doctors.includes(op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].asleep&&campaign.operativeState[op.id].energy>10).sort((a,b)=>b.medical-a.medical)[0]?.id;
   if(collector&&!campaign.operativeState[collector].medkits){const remaining=patients.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),extra=collectRouteMedicalSupplies(campaign,collector,remaining.length,{report});campaign=extra.campaign;laterFoundDressings+=extra.collected;}
  }
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart+assistantStock+laterFoundDressings-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);assert.ok(patients.length?usedDressings>0:usedDressings===0,'only actual surviving patients consume recovery supplies');
 for(const operativeId of [...doctors,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 for(const operativeId of originalSquad){order({type:'assignCare',operativeId,assignment:'active'});assert.equal(campaign.operativeState[operativeId].hp,campaign.operativeState[operativeId].maxHp);assert.equal(campaign.operativeState[operativeId].bleeding,0);}
 const originalColumn=campaign.activeSquadId;
 order({type:'createSquad',name:'Personal del hospital',ids:doctors,sector:'cordoba'});
 order({type:'selectSquad',id:originalColumn});
 const clinicGuards=[...replacements];assert.equal(clinicGuards.length,4);
 order({type:'createSquad',name:'Guardia del hospital',ids:clinicGuards,sector:'cordoba'});
 order({type:'selectSquad',id:originalColumn});
 const clinicArmament=[];
 // The clinic must cover the approach beyond pistol and shotgun range.
 // Use only visible, reachable long guns from the actual Córdoba battle.
 for(const id of [...originalSquad,...doctors,...clinicGuards].filter(id=>[1804,1805,1806,1807,1808].includes(rosterFor(campaign).find(op=>op.id===id).weapon))){
  order({type:'assignCare',operativeId:id,assignment:'active'});
  const inventory=sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id),source=inventory.entries.find(row=>row.reachable&&[1800,1801,1803].includes(JSON.parse(row.expected).weapon));assert.ok(source,'a clinic guard needs a real recovered long gun');
  const incoming=JSON.parse(source.expected),oldWeapon=rosterFor(campaign).find(op=>op.id===id).weapon;
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
  const item=sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(item);
  order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  clinicArmament.push({id,oldWeapon,weapon:incoming.weapon,sourceKey:source.key});
 }
 const clinicAmmo=supplyRouteAmmunition(campaign,[...originalSquad,...doctors,...clinicGuards],{target:14,report});campaign=clinicAmmo.campaign;
 // Prepare the clinic through ordinary local movement before the patrol leaves.
 campaign=stageRouteRoofDefenders(campaign,[...originalSquad,...doctors,...clinicGuards],{report});
 for(const id of originalSquad){const contract=campaign.contracts[id];if(contract.expiresAt!==null&&contract.expiresAt-campaign.hour<=13)order({type:'renewContract',id,term:'week',expectedExpiresAt:contract.expiresAt});}
 // Keep this actual guard cohort at the clinic through the veterans' rest.
 // Resolve the raid before releasing a new patrol for its exposed advance.
 for(const operativeId of [...originalSquad,...doctors,...clinicGuards])order({type:'assignCare',operativeId,assignment:'rest'});
 let earliestDeparture=campaign.hour+6,nightDeparture=earliestDeparture+(22-(earliestDeparture+12)%24+24)%24;
 const clinicDefenses=[];
 for(let attempt=0;campaign.hour<nightDeparture&&attempt<48;attempt++){
  order({type:'wait',hours:nightDeparture-campaign.hour});
  if(campaign.pendingEncounter){
   const encounter=structuredClone(campaign.pendingEncounter);assert.equal(encounter.sector,'cordoba');
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   const defense=fightNorthernSector(campaign,'cordoba',{controller:northernClinicDefenseOrder,report});campaign=defense.campaign;clinicDefenses.push({groupId:encounter.groupId,...defense.summary});
   for(const id of patients){assert.ok(campaign.operativeState[id].alive,'the actual clinic patients survive its native defense');assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);}
  }
 }
 assert.equal(campaign.hour,nightDeparture,'the clinic finishes its actual guarded staging wait');
 // Fallen guards and physicians remain dead. Their paid contracts and issue
 // stay in the ledger; only living paid recruits can join the later patrol.
 order({type:'selectSquad',id:originalColumn});
 const fieldIds=clinicGuards.filter(id=>campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='cordoba');
 const laterHires=[];
 for(const id of [127,119,104,108,100,101,102,133,140,144,117]){
  if(fieldIds.length>=4)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)continue;
  const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'week');if(!quote.available||quote.price>campaign.resources.treasury)continue;
  const before=campaign.resources.treasury;order({type:'recruitCivic',id,term:'week'});assert.equal(before-campaign.resources.treasury,quote.price);fieldIds.push(id);laterHires.push(id);
 }
 assert.equal(fieldIds.length,4,'four actual living paid soldiers form the exposed patrol');
 for(let hour=0;laterHires.some(id=>!campaign.recruited.includes(id))&&hour<24;hour++)order({type:'wait',hours:1});
 for(const id of fieldIds)assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='cordoba','every paid patrol member completes its actual local arrival');
 order({type:'createSquad',name:'Patrulla de avance',ids:fieldIds,sector:'cordoba'});for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
 earliestDeparture=campaign.hour;nightDeparture=earliestDeparture+(22-(earliestDeparture+12)%24+24)%24;
 for(let attempt=0;campaign.hour<nightDeparture&&attempt<48;attempt++)order({type:'wait',hours:nightDeparture-campaign.hour});
 assert.equal(campaign.hour,nightDeparture,'the exposed patrol completes its real staging wait');
 const patrolMedical=prepareOpeningPatrolMedicalReadiness(campaign,{report});campaign=patrolMedical.campaign;
 for(const action of patrolMedical.receipt.orders)events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0,cost:0});
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(campaign.squad,fieldIds);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const hiringLedger=events.filter(event=>event.action.type==='recruitCivic').map(event=>({id:event.action.id,term:event.action.term,hour:event.hour,cost:event.cost,alive:campaign.operativeState[event.action.id].alive})),fortificationCost=events.filter(event=>event.action.type==='fortify').reduce((sum,event)=>sum+event.cost,0);
 const recovery={startHour,endHour:campaign.hour,doctor,patients,replacements:fieldIds,fieldIds,usedDressings,boughtDressings,donatedDressings,foundDressings:found.collected+laterFoundDressings,clinicGuards,clinicDefenses,hiringLedger,fortificationCost,initialFort,clinicArmament,clinicAmmunition:clinicAmmo.transactions,patrolMedicalReadiness:patrolMedical.receipt};report({event:'cordobaRecovery',...recovery,cash:campaign.resources.treasury});return {campaign,events,recovery};
}

export function prepareRescueSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 assert.equal(campaign.sectors.tucuman.owner,'royalist');assert.deepEqual(campaign.squad,[]);
 const custodyStart=structuredClone(campaign);
 const captives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='tucuman').map(([id,record])=>({id:Number(id),record:structuredClone(record)}));assert.ok(captives.length);
 const reserveIds=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location==='san_nicolas';});assert.ok(reserveIds.includes(112)&&reserveIds.includes(122));
 order({type:'createSquad',sector:'san_nicolas',name:'Apoyo sanitario',ids:reserveIds});const support=campaign.activeSquadId;
 for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});
 const corridor={loss:null,recapture:null,released:[]},earlyDefenses=[],earlyRenewals=[];
 if(campaign.pendingEncounter?.sector==='buenos_aires'){
  const encounter=structuredClone(campaign.pendingEncounter);
  order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  // The actual southern reserve is critically wounded. Resolve that defense
  // and retain its casualty/captive result before assembling a relief force.
  assert.ok(campaign.pendingBattle.squad.every(unit=>unit.hp<15));
  const loss=fightNorthernSector(campaign,encounter.sector,{expectedOutcome:'defeat',controller:northernCombatOrder,report});campaign=loss.campaign;corridor.loss={groupId:encounter.groupId,...loss.summary};
 }
 const defendDepot=()=>{
  if(!campaign.pendingEncounter)return;
  const encounter=structuredClone(campaign.pendingEncounter);assert.equal(encounter.sector,'cordoba');
  order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  const defense=fightNorthernSector(campaign,encounter.sector,{controller:northernClinicDefenseOrder,report});campaign=defense.campaign;earlyDefenses.push({groupId:encounter.groupId,...defense.summary});
 };
 // The current strategic clock can bring the Córdoba raid forward. Resolve
 // that real defense before collecting finite equipment or assembling the rescue.
 defendDepot();
 // A remote raid can stop this march before arrival. Resolve it with the
 // actual local garrison, then continue the medical squad's existing journey.
 order({type:'selectSquad',id:support});
 campaign=completeTestTravel(campaign,{sector:'cordoba'});assert.equal(campaign.location,'cordoba');
 const cash=campaign.resources.treasury,hired=[],hiringLedger=[];
 const hire=(id,term='week')=>{
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)return;
  order({type:'recruitCivic',id,term});hired.push(id);hiringLedger.push({id,term,paid:campaign.contracts[id].paid,hour:campaign.hour});
 };
 for(const id of [141,127,119,103,104,111])hire(id);
 // Fill support seats with living, affordable recruits. Earlier battles can
 // permanently remove candidates; those deaths never become fresh hires.
 const present=id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&campaign.operativeState[id].location==='cordoba';
 const supportCandidates=[111,...reserveIds],supportHires=[];
 for(const id of [120,136,134,140,133,129,130,100,101,102,108,121,126,144,146]){
  if([...new Set(supportCandidates)].filter(present).length>=6)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)continue;
  hire(id,'day');supportCandidates.push(id);supportHires.push(id);
 }
 const supportIds=[...new Set(supportCandidates)].filter(present).slice(0,6);
 const fieldCandidates=()=>[...new Set([141,127,119,103,104,139,...campaign.recruited])].filter(id=>present(id)&&!supportIds.includes(id));
 for(const id of [140,133,129,130,101,102,117,144,105,106,118]){
  if(fieldCandidates().length>=6)break;
  const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'week');
  if(!quote.available||quote.price>campaign.resources.treasury)continue;
  hire(id);
 }
 const fieldIds=fieldCandidates().slice(0,6);let hiringCost=cash-campaign.resources.treasury;
 assert.equal(fieldIds.length,6,'six actual living soldiers make the rescue field squad');
 assert.ok(supportIds.includes(112)&&supportIds.includes(122)&&supportIds.length<=6);
 assert.ok(hiringCost>0);assert.equal(hiringCost,hired.reduce((sum,id)=>sum+campaign.contracts[id].paid,0));
 const medicalPurchases=[],medicalCollections=[],medicalHandovers=[],medicalReturns=[];
 const rescueDoctors=[112,122],medicalIds=[...new Set([...fieldIds,...supportIds])];
 const medicalModel=id=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);
 const need=()=>rescueDoctors.reduce((sum,id)=>sum+Math.max(0,12-campaign.operativeState[id].medkits),0);
 // The surviving reserve can retain more than the rescue's twelve dressings.
 // Leave its actual surplus in the local depot before taking finite stock.
 for(const operativeId of rescueDoctors){
  const carried=campaign.operativeState[operativeId].medkits,quantity=carried-12;if(quantity<=0)continue;
  const stock=()=>medicalModel(operativeId).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0),before=stock(),cash=campaign.resources.treasury;
  const action={type:'sectorInventory',sector:'cordoba',operativeId,direction:'drop',item:'medkits',count:quantity};order(action);
  assert.equal(campaign.operativeState[operativeId].medkits,carried-quantity);assert.equal(stock(),before+quantity,'the depot retains every returned rescue dressing');assert.equal(campaign.resources.treasury,cash);
  medicalReturns.push({action,operativeId,quantity,carriedBefore:carried,carriedAfter:campaign.operativeState[operativeId].medkits,stockBefore:before,stockAfter:stock(),treasuryBefore:cash,treasuryAfter:campaign.resources.treasury});
 }
 const gather=operativeId=>{
  while(campaign.operativeState[operativeId].medkits<12){
   const source=medicalModel(operativeId).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');if(!source)break;
   const quantity=Math.min(source.count,12-campaign.operativeState[operativeId].medkits),before=campaign.operativeState[operativeId].medkits,stock=medicalModel(operativeId).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
   order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:quantity});
   assert.equal(campaign.operativeState[operativeId].medkits,before+quantity);assert.equal(medicalModel(operativeId).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0),stock-quantity,'taking dressings debits the actual local stock even when loose-row keys shift');
   medicalCollections.push({operativeId,quantity,sourceKey:source.key,remaining:source.count-quantity});
  }
 };
 // The new escorts hand over their finite issue before collecting local stock.
 for(const donor of medicalIds.filter(id=>!rescueDoctors.includes(id))){
  if(!need())break;const carried=campaign.operativeState[donor].medkits,quantity=Math.min(carried,need());if(!quantity)continue;
  order({type:'sectorInventory',sector:'cordoba',operativeId:donor,direction:'drop',item:'medkits',count:quantity});assert.equal(campaign.operativeState[donor].medkits,carried-quantity);medicalHandovers.push({donor,quantity});
  for(const id of rescueDoctors)gather(id);
 }
 for(const id of rescueDoctors)gather(id);
 if(need()){
  // Select a real fit carrier, then inspect only bodies reached by the public
  // map patrol. Hidden corpse contents do not choose the carrier's route.
  const carrier=medicalIds.filter(id=>!rescueDoctors.includes(id)&&campaign.operativeState[id].hp>=15&&!campaign.operativeState[id].bleeding&&!campaign.operativeState[id].asleep&&campaign.operativeState[id].energy>10).sort((a,b)=>campaign.operativeState[b].energy-campaign.operativeState[a].energy||campaign.operativeState[b].hp-campaign.operativeState[a].hp)[0];assert.ok(carrier,'an actual fit escort searches the battlefield');
  const recovered=recoverVisibleRouteDressings(campaign,carrier,Math.min(4,need()),{report});campaign=recovered.campaign;
  if(recovered.collected){
   const carried=campaign.operativeState[carrier].medkits;order({type:'sectorInventory',sector:'cordoba',operativeId:carrier,direction:'drop',item:'medkits',count:recovered.collected});assert.equal(campaign.operativeState[carrier].medkits,carried-recovered.collected);medicalHandovers.push({donor:carrier,quantity:recovered.collected,source:'observed-remains'});for(const id of rescueDoctors)gather(id);
  }
 }
 for(const id of rescueDoctors)assert.equal(campaign.operativeState[id].medkits,12,'each rescue physician carries the unchanged finite target');
 report({event:'rescueMedicalPrepared',hour:campaign.hour,secondOfHour:campaign.secondOfHour??0,medicalPurchases,medicalCollections,medicalHandovers,medicalReturns,dressings:rescueDoctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0),cash:campaign.resources.treasury});
 const model=id=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),id);
 for(const id of [...fieldIds,...supportIds]){
  if(![1800,1801,1802].includes(rosterFor(campaign).find(op=>op.id===id).weapon)){
   const source=model(id).entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
   if(source){const incoming=JSON.parse(source.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});const item=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
  }
  if(!campaign.operativeState[id].outfit){const outfit=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='outfit');if(outfit){order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});const carried=model(id).carried.find(row=>row.equip?.some(e=>e.slot==='outfit'));order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});}}
 }
 let reliefSquad=null;
 if(corridor.loss){
  order({type:'createSquad',name:'Asegurar el camino del sur',ids:fieldIds});reliefSquad=campaign.activeSquadId;
  for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
  campaign=finishReloadsBeforeMarch(campaign,{report});
  order({type:'attack',sector:'buenos_aires'});assert.ok(campaign.pendingBattle);
  const coastalCaptives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='buenos_aires').map(([id,r])=>({id:Number(id),hp:r.hp,bleeding:r.bleeding}));
  const recapture=fightNorthernSector(campaign,'buenos_aires',{controller:northernCombatOrder,report});campaign=recapture.campaign;corridor.recapture=recapture.summary;
  for(const id of [...fieldIds,...supportIds]){const contract=campaign.contracts[id];if(contract?.expiresAt!==null&&contract.expiresAt-campaign.hour<=28){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});earlyRenewals.push({id,cost:cash-campaign.resources.treasury,hour:campaign.hour});}}
  // The released southern reserve stays wounded. Spend real local medical
  // time and dressings before the relief doctors leave him behind.
  if(coastalCaptives.length){
   const doctor=fieldIds.filter(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].hp>=15&&campaign.operativeState[id].medkits>0).sort((a,b)=>rosterFor(campaign).find(op=>op.id===b).medical-rosterFor(campaign).find(op=>op.id===a).medical)[0];
   const needsStabilization=coastalCaptives.some(({id})=>campaign.operativeState[id].hp<15||campaign.operativeState[id].bleeding);
   const linen=campaign.operativeState[doctor].medkits,careStart=campaign.hour;order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
   for(const patient of coastalCaptives){assert.equal(campaign.operativeState[patient.id].hp,patient.hp);assert.equal(campaign.operativeState[patient.id].captured,false);order({type:'assignCare',operativeId:patient.id,assignment:'patient'});}
   for(let care=0;care<8&&coastalCaptives.some(({id})=>campaign.operativeState[id].hp<15||campaign.operativeState[id].bleeding);care++)order({type:'wait',hours:1});
   if(needsStabilization)assert.ok(campaign.operativeState[doctor].medkits<linen);else assert.equal(campaign.operativeState[doctor].medkits,linen);
   for(const patient of coastalCaptives){assert.ok(campaign.operativeState[patient.id].hp>=15);assert.equal(campaign.operativeState[patient.id].bleeding,0);order({type:'assignCare',operativeId:patient.id,assignment:'rest'});}
   order({type:'assignCare',operativeId:doctor,assignment:'active'});corridor.released=coastalCaptives;corridor.care={doctor,hours:campaign.hour-careStart,usedDressings:linen-campaign.operativeState[doctor].medkits};
  }
  order({type:'travel',sector:'cordoba'});defendDepot();
 }
 order({type:'selectSquad',id:support});order({type:'squad',ids:supportIds});
 for(const operativeId of supportIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 if(reliefSquad)order({type:'selectSquad',id:reliefSquad});else order({type:'createSquad',name:'Rescate del norte',ids:fieldIds});const field=campaign.activeSquadId;
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
 campaign=finishReloadsBeforeMarch(campaign,{report});
 // The relief doctors have already marched from the south. Rest the force
 // overnight, and defend the depot if a visible raiding column approaches.
 // Once the squads are in transit, they cannot defend the local reserve.
 const staging={startHour:campaign.hour,departureHour:null,defenses:earlyDefenses,renewals:earlyRenewals,corridor,losses:[],replacements:[],recovery:{patients:[],hours:0,usedDressings:0}};
 const deploying=[...fieldIds,...supportIds];let earliestDeparture=campaign.hour+(24-campaign.hour%24)%24;
 for(const operativeId of deploying)order({type:'assignCare',operativeId,assignment:'rest'});
 const renew=()=>{for(const id of deploying){const contract=campaign.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt-campaign.hour<=14){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});staging.renewals.push({id,cost:cash-campaign.resources.treasury,hour:campaign.hour});}}};
 for(let i=0;i<48;i++){
  if(campaign.pendingEncounter){
   const encounter=structuredClone(campaign.pendingEncounter),group=structuredClone(campaign.enemyGroups.find(group=>group.id===encounter.groupId));
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   assert.deepEqual(campaign.pendingBattle.enemies,group.units,'the defense uses the actual arriving group');
   const defense=fightNorthernSector(campaign,encounter.sector,{controller:northernReconOrder,report});campaign=defense.campaign;
   staging.defenses.push({groupId:group.id,...defense.summary});
   const losses=deploying.filter(id=>!campaign.operativeState[id].alive);
   staging.losses??=[];staging.losses.push(...losses);staging.replacements??=[];let deferredFieldReplacement=null;
   for(const members of [fieldIds,supportIds]){
    const fallen=members.filter(id=>!campaign.operativeState[id].alive);members.splice(0,members.length,...members.filter(id=>campaign.operativeState[id].alive));
    const term=members===supportIds?'day':'week',cheapDaily=routeHiringCeiling(campaign,30);
    const candidates=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id],q=contractQuote(campaign,op,term);return op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&q.available;}).sort((a,b)=>{
     const qa=contractQuote(campaign,a,term),qb=contractQuote(campaign,b,term),aCheap=qa.daily<=cheapDaily,bCheap=qb.daily<=cheapDaily;
     return Number(bCheap)-Number(aCheap)||(aCheap&&bCheap?b.marksmanship-a.marksmanship:qa.price-qb.price||b.marksmanship-a.marksmanship);
    });
    for(const op of candidates){
     if(members.length>=6)break;const quote=contractQuote(campaign,op,term),cash=campaign.resources.treasury;if(!quote.available||quote.price>cash)continue;
     hire(op.id,term);const cost=cash-campaign.resources.treasury;assert.equal(cost,quote.price);hiringCost+=cost;members.push(op.id);if(members===supportIds)supportHires.push(op.id);staging.replacements.push({id:op.id,term,cost,fallen});
    }
    if(members===fieldIds&&members.length===5)deferredFieldReplacement={fallen};
    else assert.equal(members.length,6,'the actual paid replacement volunteers must fill the relief squad');
   }
   supportHires.splice(0,supportHires.length,...supportHires.filter(id=>campaign.operativeState[id].alive));
   deploying.splice(0,deploying.length,...fieldIds,...supportIds);
   for(const id of losses)assert.equal(campaign.operativeState[id].alive,false,'the defense losses stay permanent after paid relief');
   // Routed defenders leave through real exits. March them back from their
   // actual cell before assigning medical care or re-forming the rescue.
   for(const at of new Set(deploying.map(id=>campaign.operativeState[id].location).filter(at=>at!=='cordoba'))){
    const returning=deploying.filter(id=>campaign.operativeState[id].location===at);
    renew();order({type:'createSquad',name:'Regreso de defensa',ids:returning,sector:at});
    for(const operativeId of returning)order({type:'assignCare',operativeId,assignment:'active'});
    order({type:'travel',sector:'cordoba',mode:'march'});
    assert.ok(returning.every(id=>campaign.operativeState[id].location==='cordoba'),'routed defenders must complete the return march');
   }
   order({type:'selectSquad',id:support});order({type:'squad',ids:supportIds});
   order({type:'selectSquad',id:field});order({type:'squad',ids:fieldIds});
   for(const operativeId of deploying.filter(id=>campaign.operativeState[id].weaponDropped)){
    campaign=recoverRoutePrimary(campaign,operativeId);
   }
   const patients=deploying.filter(id=>campaign.operativeState[id].bleeding||campaign.operativeState[id].hp<15);
   for(let h=0;h<12&&patients.some(id=>campaign.operativeState[id].bleeding||campaign.operativeState[id].hp<15);h++){
    const doctors=rosterFor(campaign).filter(op=>deploying.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding&&campaign.operativeState[op.id].medkits>0);
    assert.ok(doctors.length,'actual paid doctors must stabilize the returned defenders');
    for(const doctor of doctors)order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
    for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
    renew();order({type:'wait',hours:1});
   }
   const convalescents=deploying.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
   const beforeRecovery=structuredClone(campaign),careHour=campaign.hour,careFound=[];
   // Learning and supply notices can stop a wait before its requested hour.
   // Bound actual elapsed care time, then resume through ordinary orders.
   for(let attempt=0;attempt<512&&campaign.hour<careHour+96&&convalescents.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);attempt++){
    assert.equal(campaign.pendingEncounter,null);
    const remaining=convalescents.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
    const healers=rosterFor(campaign).filter(op=>deploying.includes(op.id)&&!remaining.includes(op.id)&&op.medical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding&&!campaign.operativeState[op.id].asleep&&campaign.operativeState[op.id].energy>10).sort((a,b)=>b.medical-a.medical).slice(0,Math.min(3,remaining.length));
    for(const doctor of healers)if(!campaign.operativeState[doctor.id].medkits){
     const inventory=()=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),doctor.id);
     let dressing=inventory().entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
     if(!dressing){
      const donor=deploying.find(id=>id!==doctor.id&&!healers.some(op=>op.id===id)&&campaign.operativeState[id].medkits>0);
      if(donor!==undefined){
       const carried=campaign.operativeState[donor].medkits;
       order({type:'sectorInventory',sector:'cordoba',operativeId:donor,direction:'drop',item:'medkits',count:1});
       assert.equal(campaign.operativeState[donor].medkits,carried-1);
       dressing=inventory().entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
      }
     }
     if(dressing){
      order({type:'sectorInventory',sector:'cordoba',operativeId:doctor.id,direction:'take',sourceKey:dressing.key,expected:dressing.expected,count:1});
      assert.equal(inventory().entries.find(row=>row.key===dressing.key)?.count??0,dressing.count-1);
     }else {
      const found=collectRouteItems(campaign,doctor.id,{item:'medkits'},1);campaign=found.campaign;const collection={operativeId:doctor.id,quantity:found.collected};medicalCollections.push(collection);careFound.push(collection);
     }
    }
    for(const operativeId of deploying)order({type:'assignCare',operativeId,assignment:remaining.includes(operativeId)?'patient':healers.some(op=>op.id===operativeId)&&campaign.operativeState[operativeId].medkits>0?'doctor':'rest'});
    renew();order({type:'wait',hours:1});
   }
   staging.recovery={patients:convalescents,hours:campaign.hour-careHour,usedDressings:deploying.reduce((sum,id)=>sum+beforeRecovery.operativeState[id].medkits-campaign.operativeState[id].medkits,0)+careFound.reduce((sum,collection)=>sum+collection.quantity,0)};
   for(const id of deploying){assert.equal(campaign.operativeState[id].bleeding,0);assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp,`returned defender ${id} must finish actual medical care`);order({type:'assignCare',operativeId:id,assignment:'rest'});}
   if(deferredFieldReplacement){
    // Finish the real survivors' care before starting an expensive day term.
    // A weekly quote above the treasury does not justify a free replacement.
    const candidate=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id],q=contractQuote(campaign,op,'day');return op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&q.available&&q.price<=campaign.resources.treasury;}).sort((a,b)=>contractQuote(campaign,a,'day').price-contractQuote(campaign,b,'day').price||b.marksmanship-a.marksmanship)[0];assert.ok(candidate,'finite care must leave an affordable real sixth field soldier');
    // Keep the survivors resting and book the short term close to a night
    // approach. The native arrival delay and four hours of local preparation
    // fit before departure; every additional hour still advances the campaign.
    const travelHours=hiringTravelHours(campaign,candidate.id),leadHours=travelHours+4;
    earliestDeparture=campaign.hour+(8-campaign.hour%24+24)%24;
    if(earliestDeparture<campaign.hour+leadHours)earliestDeparture+=24;
    const bookingHour=earliestDeparture-leadHours;
    for(let attempt=0;campaign.hour<bookingHour&&attempt<72;attempt++){assert.equal(campaign.pendingEncounter,null);renew();order({type:'wait',hours:1});}
    assert.equal(campaign.hour,bookingHour,'the paid booking follows the real clinic staging wait');
    const quote=contractQuote(campaign,candidate,'day'),cash=campaign.resources.treasury,bookedHour=campaign.hour,bookedSecond=campaign.secondOfHour??0;
    assert.ok(quote.available&&quote.price<=cash,'the actual day quote remains affordable at booking');
    order({type:'recruitCivic',id:candidate.id,term:'day',destination:'cordoba'});assert.equal(cash-campaign.resources.treasury,quote.price);
    const arrival=pendingHire(campaign,candidate.id);if(arrival){assert.equal(arrival.travelHours,travelHours);assert.equal(hireArrivalDueSeconds(arrival),(bookedHour+travelHours)*3600+bookedSecond);}
    for(let attempt=0;!campaign.recruited.includes(candidate.id)&&attempt<48;attempt++){assert.equal(campaign.pendingEncounter,null);renew();order({type:'wait',hours:1});}
    assert.ok(campaign.recruited.includes(candidate.id)&&campaign.operativeState[candidate.id].alive&&campaign.operativeState[candidate.id].location==='cordoba','the paid sixth soldier must complete the actual arrival');
    assert.ok(campaign.hour*3600+(campaign.secondOfHour??0)>=(bookedHour+travelHours)*3600+bookedSecond);assert.equal(campaign.contracts[candidate.id].paid,quote.price);assert.equal(campaign.contracts[candidate.id].term,'day');assert.ok(campaign.contracts[candidate.id].expiresAt>campaign.hour);
    const dueSeconds=(bookedHour+travelHours)*3600+bookedSecond,arrivalSeconds=campaign.hour*3600+(campaign.secondOfHour??0);
    hired.push(candidate.id);hiringLedger.push({id:candidate.id,term:'day',paid:quote.price,hour:bookedHour,bookedSecond,travelHours,dueSeconds,arrivalHour:campaign.hour,arrivalSeconds});hiringCost+=quote.price;fieldIds.push(candidate.id);deploying.push(candidate.id);
    staging.replacements.push({id:candidate.id,term:'day',cost:quote.price,fallen:deferredFieldReplacement.fallen,bookedHour,bookedSecond,travelHours,dueSeconds,arrivalHour:campaign.hour,arrivalSeconds,expiresAt:campaign.contracts[candidate.id].expiresAt,expiresSecond:campaign.contracts[candidate.id].expiresSecond??0});
    staging.nightApproach={bookingHour,earliestDeparture,arrivalHour:earliestDeparture+12};
    order({type:'selectSquad',id:field});order({type:'squad',ids:fieldIds});order({type:'assignCare',operativeId:candidate.id,assignment:'rest'});
   }
   assert.equal(fieldIds.length,6,'six actual living paid soldiers must finish the field preparation');assert.equal(supportIds.length,6,'six actual living paid soldiers must finish the support preparation');
   continue;
  }
  const approach=campaign.enemyGroups.some(group=>group.target==='cordoba'&&['marching','waiting'].includes(group.status));
  if(campaign.hour>=earliestDeparture&&!approach&&deploying.every(id=>campaign.operativeState[id].energy===100))break;
  renew();order({type:'wait',hours:1});
 }
 assert.equal(campaign.pendingEncounter,null);assert.ok(deploying.every(id=>campaign.operativeState[id].energy===100),'the rescue departs after actual rest');
 for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});
 report({event:'rescueStaged',hour:campaign.hour,secondOfHour:campaign.secondOfHour??0,fieldIds,supportIds,hiringLedger,hiringCost,medicalPurchases,medicalCollections,medicalHandovers,medicalReturns,staging});
 // Use the already recovered local bronze gun before sending paid soldiers
 // on another supply journey. Its physical custody, load and shots stay exact.
 const localBattery=campaign.sectors.cordoba.owner==='patriot'?[...(campaign.artilleryDepots.cordoba??[]).map(record=>({source:'depot',record})),...(campaign.sectorStates.cordoba?.artillery??[]).map(record=>({source:'field',record}))].filter(({record})=>record.side==='player'&&record.type==='bronze4').sort((a,b)=>Number(b.source==='depot')-Number(a.source==='depot')||b.record.ammo+Number(b.record.loaded)-a.record.ammo-Number(a.record.loaded)||a.record.id.localeCompare(b.record.id))[0]:null;
 const artilleryCash=campaign.resources.treasury,battery=localBattery?prepareRouteBattery(campaign,['bronze4'],{report}):prepareRouteSupportBattery(campaign,{report});campaign=battery.campaign;
 const batteryRecord=campaign.artilleryDepots.cordoba.find(gun=>`depot:${gun.id}`===battery.selections[0]);
 if(localBattery){assert.equal(batteryRecord.id,localBattery.record.id);assert.deepEqual(batteryRecord,storedArtilleryRecord(localBattery.record));report({event:'rescueLocalBattery',sector:'cordoba',source:localBattery.source,record:structuredClone(batteryRecord),cost:artilleryCash-campaign.resources.treasury});}
 order({type:'configureArtillery',types:battery.selections});staging.artillery={record:structuredClone(batteryRecord),type:batteryRecord.type,cost:artilleryCash-campaign.resources.treasury,selections:battery.selections,source:localBattery?`local-${localBattery.source}`:'finite-arsenal'};renew();
 for(const operativeId of deploying)order({type:'assignCare',operativeId,assignment:'active'});
 // Recheck the actual carried weapons after clinic care and replacements.
 // A physician may still hold a pistol with an owned musket in a pocket.
 // Equip that physical long gun before asking for its matching cartridges.
 for(const operativeId of deploying){
  const carried=()=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),operativeId),primary=carried().personal;
  if(!primary.weaponDropped&&weaponFor({...primary,activeSlot:'primary'}).range>=12)continue;
  const gun=carried().carried.find(row=>row.equip?.some(option=>option.slot==='primary'&&option.valid)&&weaponFor({...JSON.parse(row.expected),activeSlot:'primary'}).capacity>0&&weaponFor({...JSON.parse(row.expected),activeSlot:'primary'}).range>=12&&JSON.parse(row.expected).condition>=10);
  if(!gun)continue;
  const cash=campaign.resources.treasury,time=campaign.hour*3600+(campaign.secondOfHour??0),oldWeapon=primary.weapon;
  order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  assert.equal(campaign.resources.treasury,cash);assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),time);
  report({event:'rescueOwnedLongGun',operativeId,oldWeapon,weapon:carried().personal.weapon,inventoryKey:gun.inventoryKey,range:weaponFor({...carried().personal,activeSlot:'primary'}).range});
 }
 const ammunitionBefore=structuredClone(campaign),ammunitionCash=campaign.resources.treasury,supplied=supplyRouteAmmunition(campaign,deploying,{target:10,report});campaign=supplied.campaign;
 assert.equal(campaign.resources.treasury,ammunitionCash,'the rescue uses finite existing cartridges');
 const physicalDebits=new Map();
 for(const transaction of supplied.transactions){
  assert.equal(transaction.action.direction,'take');assert.equal(transaction.cost,0);
  events.push({action:transaction.action,hour:transaction.hour,second:transaction.secondOfHour,cost:0});
  if(transaction.action.type==='sectorInventory'){
   const key=transaction.action.sourceKey,debit=physicalDebits.get(key)??{operativeId:transaction.action.operativeId,quantity:0};debit.quantity+=transaction.quantity;physicalDebits.set(key,debit);
  }
 }
 for(const [key,{operativeId,quantity}]of physicalDebits){
  const sourceCount=state=>sectorInventoryModel(state,'cordoba',rosterFor(state),operativeId).entries.find(row=>row.key===key)?.count??0;
  assert.equal(sourceCount(campaign),sourceCount(ammunitionBefore)-quantity,'each physical cartridge source loses only the actual handovers');
 }
 staging.ammunitionTransactions=supplied.transactions;
 order({type:'selectSquad',id:support});campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'selectSquad',id:field});campaign=finishReloadsBeforeMarch(campaign,{report});
 order({type:'selectSquad',id:support});staging.departureHour=campaign.hour;staging.departureSecond=campaign.secondOfHour??0;
 order({type:'attack',sector:'tucuman',queue:true});order({type:'selectSquad',id:field});order({type:'attack',sector:'tucuman',queue:true});
 for(let i=0;i<24&&![field,support].every(id=>campaign.squads.find(q=>q.id===id).journey?.status==='ready');i++){assert.equal(campaign.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'tucuman'});
 for(const captive of captives){captive.custodyCare=assertCustodyCare(custodyStart,campaign,captive.id);captive.beforeCare=captive.record;captive.record=structuredClone(campaign.operativeState[captive.id]);}
 const battle=enterSector(campaign.pendingBattle,campaign.sectorStates.tucuman);assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 report({event:'rescuePrepared',hour:campaign.hour,units:campaign.pendingBattle.squad.map(u=>u.id),cash:campaign.resources.treasury,hired,hiringCost,medicalPurchases,medicalCollections,medicalHandovers,medicalReturns,ammunitionTransactions:supplied.transactions,fieldIds,supportIds,staging});return {campaign,events,captives,hired:hired.filter(id=>campaign.operativeState[id].alive),hiringLedger,hiringCost,medicalPurchases,medicalCollections,medicalHandovers,medicalReturns,ammunitionTransactions:supplied.transactions,fieldIds,supportIds,supportHires,staging};
}

export function stabilizeRescued(start,{patients,report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign,battle=null;const events=[],orders=[],medicalCollections=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});orders.push({scope:'campaign',action});};
 assert.ok(patients?.length,'stabilize the actual released prisoners');
 assert.equal(campaign.sectors.tucuman.owner,'patriot');assert.equal(campaign.pendingEncounter,null);
 for(const id of patients){assert.equal(campaign.operativeState[id].captured,false);assert.ok(campaign.recruited.includes(id));}
 const local=()=>rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman';});
 const physician=local().filter(op=>{const r=campaign.operativeState[op.id];return !patients.includes(op.id)&&op.medical>=20&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 assert.ok(physician,'an actual stable local physician must provide aid');
 const urgent=local().filter(op=>!patients.includes(op.id)&&op.id!==physician.id&&(campaign.operativeState[op.id].bleeding||campaign.operativeState[op.id].hp<15)).map(op=>op.id);
 // Reserve one actual clinic stroke for each released prisoner. Other local
 // rescuers receive finite first aid before the clinic advances an hour.
 const dressingTarget=patients.length+urgent.reduce((sum,id)=>sum+Math.max(Number(campaign.operativeState[id].bleeding>0),15-campaign.operativeState[id].hp),0);
 while(campaign.operativeState[physician.id].medkits<dressingTarget){
  const model=sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),physician.id),row=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  assert.ok(row,'known finite local dressings must cover the released patients and urgent rescuers');
  const count=Math.min(row.count,dressingTarget-campaign.operativeState[physician.id].medkits),carriedBefore=campaign.operativeState[physician.id].medkits,cash=campaign.resources.treasury,seconds=campaign.hour*3600+(campaign.secondOfHour??0);
  const medicalPoolBefore=model.entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
  order({type:'sectorInventory',sector:'tucuman',operativeId:physician.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  const after=sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),physician.id),medicalPoolAfter=after.entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
  assert.equal(medicalPoolAfter,medicalPoolBefore-count);assert.equal(campaign.operativeState[physician.id].medkits,carriedBefore+count);
  assert.equal(campaign.resources.treasury,cash);assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),seconds);
  medicalCollections.push({action:orders.at(-1).action,sourceBefore:row.count,sourceAfter:row.count-count,medicalPoolBefore,medicalPoolAfter,carriedBefore,carriedAfter:campaign.operativeState[physician.id].medkits});
 }
 const emergencyAid={patients:urgent,steps:[],elapsedSeconds:0,usedDressings:0,officialMidpoint:false};
 if(urgent.length){
  const ids=[physician.id,...urgent];assert.ok(ids.length<=6,'the actual urgent aid party fits one ordinary squad');
  const selected=campaign.activeSquadId,groups=campaign.squads.map(q=>({id:q.id,members:[...q.members]})),roles=ids.map(id=>({id,assignment:campaign.operativeState[id].assignment})),beforeAid=structuredClone(campaign);
  order({type:'squad',ids});for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'visitSector'});battle=enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0},campaign.sectorStates.tucuman);
  const aid=autoBandageBattle(battle);assert.ok(aid.steps.length);assert.deepEqual(aid.untreated,[],'native aid must stabilize the actual urgent party');
  const sync=()=>{const paid=syncBattleTime(campaign,battle);assert.equal(paid.error,null);campaign=paid.campaign;battle=paid.battle;};
  for(let i=0;i<aid.steps.length;i++){
   battle=actBattle(battle,aid.steps[i]);assert.equal(battle.lastError,null);sync();orders.push({scope:'tactical',action:aid.steps[i]});
   if(i===Math.floor(aid.steps.length/2)){({campaign,battle}=decodeSave(encodeSave(campaign,battle)));emergencyAid.officialMidpoint=true;}
  }
  emergencyAid.steps=aid.steps;emergencyAid.elapsedSeconds=aid.elapsedSeconds;
  sync();order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});battle=null;
  for(const group of groups.filter(q=>q.members.some(id=>ids.includes(id)))){order({type:'selectSquad',id:group.id});order({type:'squad',ids:group.members});}
  for(const role of roles)order({type:'assignCare',operativeId:role.id,assignment:role.assignment});order({type:'selectSquad',id:selected});
  for(const group of groups)assert.deepEqual(campaign.squads.find(q=>q.id===group.id).members,group.members);
  for(const id of urgent){assert.equal(campaign.operativeState[id].alive,true);assert.ok(campaign.operativeState[id].hp>=15);assert.equal(campaign.operativeState[id].bleeding,0);}
  emergencyAid.usedDressings=beforeAid.operativeState[physician.id].medkits-campaign.operativeState[physician.id].medkits;
 }
 const doctors=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&!patients.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&op.medical>=20&&r.medkits>0;}).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 assert.ok(doctors.length,'actual surviving doctors provide aid');
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 const before=structuredClone(campaign),hour=campaign.hour,clinicStartSeconds=campaign.hour*3600+(campaign.secondOfHour??0);
 // Each surviving doctor treats a limited number of patients per hour.
 // Keep actual care running until every released captive receives it.
 const treated=id=>{const r=campaign.operativeState[id],prior=before.operativeState[id];return !r.bleeding&&(prior.bleeding?r.hp>=prior.hp:r.hp>prior.hp);};
 for(let elapsed=0;elapsed<=patients.length&&!patients.every(treated);elapsed++){
  const intendedSeconds=campaign.hour*3600+(campaign.secondOfHour??0)+3600;
  for(let requests=0;requests<8&&campaign.hour*3600+(campaign.secondOfHour??0)<intendedSeconds;requests++){
   for(const operativeId of patients.filter(treated))if(campaign.operativeState[operativeId].assignment==='patient')order({type:'assignCare',operativeId,assignment:'rest'});
   order({type:'wait',hours:1});assert.equal(campaign.pendingEncounter,null,'the clinic cannot bypass an actual arrival');
  }
  assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),intendedSeconds,'bounded ordinary wait requests must complete the intended care hour');
 }
 assert.ok(campaign.hour>hour&&campaign.hour<=hour+patients.length+1);
 const clinicElapsedSeconds=campaign.hour*3600+(campaign.secondOfHour??0)-clinicStartSeconds;assert.ok(clinicElapsedSeconds>=3600&&clinicElapsedSeconds<=(patients.length+1)*3600);
 const usedDressings=doctors.reduce((sum,id)=>sum+before.operativeState[id].medkits-campaign.operativeState[id].medkits,0);assert.ok(usedDressings>0);
 for(const id of patients){assert.equal(campaign.operativeState[id].alive,true);assert.equal(campaign.operativeState[id].bleeding,0);if(before.operativeState[id].bleeding)assert.equal(campaign.operativeState[id].hp,before.operativeState[id].hp);else assert.ok(campaign.operativeState[id].hp>before.operativeState[id].hp);}
 for(const [id,r] of Object.entries(before.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'rescuedStable',hour:campaign.hour,usedDressings,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))});
 return {campaign,events,orders,patients,doctors,usedDressings,medicalCollections,emergencyAid,dressingTarget,clinicElapsedSeconds};
}
