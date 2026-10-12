import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {restoreNorthernRoad,returnNorthernOfficers,prepareRestoredSalta} from './recovery-road-route.mjs';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fightNorthernSector,northernCombatOrder,northernClinicDefenseOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {careAssignmentIssue} from '../game/medical-care.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {createBattle,actBattle,endTurn,teamCanSee,hasLineOfSight,firearmShotOptions,actionCosts,getReachable,interruptAvailable,completedTacticalVictory} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
import {collectRouteItems} from './finite-route-equipment.mjs';
import {careRules} from '../game/campaign-care-rules.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {fight as fightOpeningBattle} from './opening-driver.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';
import {captureRouteStrategicInput,recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {campaignSectors} from '../game/campaign-definition.js';
import {cellTravelPlan} from '../game/world-cells.js';
import {baseMorale} from '../game/morale.js';
import {bookRouteHires,assertRouteHireArrived} from './paid-route-hiring.mjs';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {prepareNorthernHospitalRear} from './northern-hospital-rear-readiness.mjs';
import {retainNorthernHandoverService,resolveNorthernHandoverEncounter,continueNorthernHandoverTravel} from './northern-handover-route.mjs';

// A guarded roof can have a valid low-probability lane while the ordinary
// infantry policy wants to advance. Pay for the real previewed shot first.
export function northernHospitalCoverOrder(battle,unit){
 const action=northernClinicDefenseOrder(battle,unit);if(action||unit.knockedDown||unit.entangled||unit.routed||unit.unconscious||unit.hp<15||!unit.loaded||unit.jammed||!['primary','secondary'].includes(unit.activeSlot))return action;
 const shots=[];
 for(const target of battle.units.filter(target=>target.side==='enemy'&&target.hp>=15&&!target.departure&&!target.unconscious&&!target.routed&&!target.surrendered&&teamCanSee(battle,unit.side,target)&&hasLineOfSight(battle,unit,target))){
  const cost=actionCosts(battle,unit,target);if(unit.ap<cost.fire)continue;
  for(const option of firearmShotOptions(battle,unit,target,Math.min(4,Math.floor((unit.ap-cost.fire)/cost.aim))))if(option.chance>=5&&option.damageFactor>0)shots.push({score:option.chance*option.damageFactor,action:{type:'fire',unitId:unit.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation}});
 }
 return shots.sort((a,b)=>b.score-a.score)[0]?.action??null;
}

// A hospital is an actual controlled locality reached through the ordinary
// land planner. An occupied preferred hospital remains occupied; this helper
// neither attacks it nor changes the enemy group's state.
export function northernRecoveryHospital(c,patients,preferred='cordoba'){
 const locations=[...new Set(patients.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured).map(id=>operativeLocation(c,id)))];
 assert.ok(locations.length,'actual living patients need a controlled hospital');
 const choices=campaignSectors(c).filter(sector=>c.sectors[sector.id]?.owner==='patriot'&&!c.enemyGroups.some(group=>group.target===sector.id&&group.status==='stationed')).map(sector=>{
  const plans=locations.map(location=>cellTravelPlan({...c,location},sector.id));
  return {sector:sector.id,plans,hours:plans.reduce((sum,plan)=>sum+plan.hours,0)};
 }).filter(choice=>choice.plans.every(plan=>!plan.reason&&plan.path.length<=65));
 const selected=choices.find(choice=>choice.sector===preferred)??choices.sort((a,b)=>a.hours-b.hours||a.sector.localeCompare(b.sector))[0];
 assert.ok(selected,'the actual patients need a controlled reachable hospital; restore a cut route through real orders first');
 return selected.sector;
}

export function northernHospitalOrder(state,a,{inputCapture=null,report=()=>{}}={}){
 let c=state;
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'&&a.queue!==true?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured)){
   const until=(c.hour+elapsed)*3600+(c.secondOfHour??0);
   while(contractExpiresSeconds(c.contracts[id])!==null&&contractExpiresSeconds(c.contracts[id])<=until){
    const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
    assert.equal(quote.available,true,quote.reason);const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,next.lastError);c=next;
    assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),quote.expiresAt*3600+(quote.expiresSecond??0));
    report({event:'northernHospitalRenewal',action,quote:structuredClone(quote),cost:cash-c.resources.treasury,hour:c.hour,secondOfHour:c.secondOfHour??0,contract:structuredClone(c.contracts[id])});
   }
  }
  const before=c,diagnosticBefore=a.type==='travel'?captureRouteStrategicInput(c):null;
  c=dispatchCampaign(c,a);
  if(c.lastError&&a.type==='travel')recordRouteStrategicEvidence({helper:'recoverFreshNorthernDoctor',stage:'campaign-action-refusal',campaign:diagnosticBefore??before,action:a,returnedCampaign:c,inputCapture,error:c.lastError,preDispatchInputIndependentlyCloned:diagnosticBefore!==null});
  assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
  report({event:'northernHospitalOrder',action:a.type==='leaveSector'?{type:a.type,battleId:a.battleId}:structuredClone(a),hour:c.hour,secondOfHour:c.secondOfHour??0,location:c.location,cost:before.resources.treasury-c.resources.treasury,...(['travel','resumeTravel'].includes(a.type)?{path:c.squads.find(q=>q.id===c.activeSquadId)?.journey?.path??[],destination:a.sector??null}:{} )});
 return c;
}

// Local linen can be truly exhausted after the preceding native battles.
// Book supplied relief only after known stock and local donations are absent.
// Each arrival carries its existing finite kit; an expired profile is not refilled.
export function stabilizeNorthernHospitalPatients(start,patients,doctorIds,{inputCapture=null,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),doctors=[...doctorIds],orders=[],hires=[],donations=[],ticks=[];
 const observe=event=>{if(event.event==='northernHospitalOrder'||event.event==='northernHospitalRenewal')orders.push(structuredClone(event.action));report(event);};
 const order=action=>{c=northernHospitalOrder(c,action,{inputCapture,report:observe});};
 const urgent=id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0;
 const local=(id,at)=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===at;
 for(let h=0;h<24&&patients.some(urgent);h++){
  assert.equal(c.pendingEncounter,null,'defend a real hospital interruption before continuing critical care');
  assert.equal(c.pendingBattle,null);
  for(let index=0;index<doctors.length;index++){
   let id=doctors[index],at=operativeLocation(c,id);
   if(c.operativeState[id].asleep||!patients.some(patient=>local(patient,at)&&urgent(patient)))continue;
   if(c.operativeState[id].medkits){order({type:'assignCare',operativeId:id,assignment:'doctor'});continue;}
   let row=sectorInventoryModel(c,at,rosterFor(c),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(row){order({type:'sectorInventory',sector:at,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});order({type:'assignCare',operativeId:id,assignment:'doctor'});continue;}
   let donor=c.recruited.find(other=>other!==id&&local(other,at)&&c.operativeState[other].medkits>0&&!sectorInventoryModel(c,at,rosterFor(c),other).reason);
   if(donor===undefined&&c.sectorStates[at]?.props.some(prop=>prop.contents?.some(item=>item.item==='medkits'&&item.count>0))){c=collectRouteItems(c,id,{item:'medkits'},1).campaign;continue;}
   if(donor===undefined){
    const candidate=rosterFor(c).filter(op=>{
     const record=c.operativeState[op.id],quote=contractQuote(c,op,'day');
     return civicStatus(c,op.id).available&&!c.recruited.includes(op.id)&&!c.hiringArrivals.some(arrival=>arrival.operativeId===op.id)&&record.alive&&!record.captured&&record.medkits>0&&op.medical>=careRules(c).minimumSkill&&hiringTravelHours(c,op.id)===0&&quote.available&&quote.total<=c.resources.treasury;
    }).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'day').total-contractQuote(c,b,'day').total||a.id-b.id)[0];
    assert.ok(candidate,'critical hospital care needs known finite linen or an actual supplied immediate paid medic');
    const booked=bookRouteHires(c,[candidate.id],{term:'day',destination:at,report});c=booked.campaign;hires.push(...booked.hires);assertRouteHireArrived(c,booked.hires[0]);
    orders.push({type:'recruitCivic',id:candidate.id,term:'day',destination:at});
    const home=c.squads.find(squad=>squad.location===at&&!squad.journey&&squad.members.length>0&&squad.members.length<6&&squad.members.some(member=>patients.includes(member)||doctors.includes(member)));
    if(home)order({type:'assignToSquad',operativeId:candidate.id,squadId:home.id});else order({type:'createSquad',name:'Socorro del hospital',ids:[candidate.id],sector:at});
    const physician=rosterFor(c).filter(op=>local(op.id,at)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(physician);
    if(physician.id!==id){order({type:'assignCare',operativeId:id,assignment:'rest'});id=physician.id;doctors[index]=id;}
    donor=candidate.id;
   }
   if(!c.operativeState[id].medkits){
    const stock=c.operativeState[id].medkits+c.operativeState[donor].medkits,known=new Set(sectorInventoryModel(c,at,rosterFor(c),id).entries.map(row=>row.key));
    order({type:'sectorInventory',sector:at,operativeId:donor,direction:'drop',item:'medkits',count:1});
    row=sectorInventoryModel(c,at,rosterFor(c),id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'the clinic physician needs a real path to the finite local donation');
    order({type:'sectorInventory',sector:at,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    assert.equal(c.operativeState[id].medkits+c.operativeState[donor].medkits,stock);donations.push({sector:at,donor,recipient:id,count:1});
   }
   order({type:'assignCare',operativeId:id,assignment:'doctor'});
  }
  const began=c.hour*3600+(c.secondOfHour??0),stock=doctors.reduce((sum,id)=>sum+c.operativeState[id].medkits,0);
  for(let notice=0;c.hour*3600+(c.secondOfHour??0)===began&&notice<3;notice++)order({type:'wait',hours:1});
  assert.ok(c.hour*3600+(c.secondOfHour??0)>began||c.pendingEncounter,'critical care must advance or expose its real encounter');
  assert.ok(patients.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive),'retain every actual serving patient during critical care');
  c=decodeSave(encodeSave(c)).campaign;
  const tick={hour:c.hour,secondOfHour:c.secondOfHour??0,doctors:[...doctors],dressingsSpent:stock-doctors.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),patients:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))};ticks.push(tick);report({event:'northernHospitalStabilizationTick',tick,campaign:structuredClone(c)});
 }
 assert.ok(patients.every(id=>c.operativeState[id].alive&&!urgent(id)),'stop real critical wounds and bleeding before evacuation');
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,record.deathMinute);}
 assert.deepEqual(start,before);const receipt={orders,hires,donations,ticks,patients:[...patients],doctors:[...doctors],startSeconds:start.hour*3600+(start.secondOfHour??0),endSeconds:c.hour*3600+(c.secondOfHour??0)};
 report({event:'northernHospitalStabilized',receipt});return {campaign:c,doctors,receipt};
}


// Stabilize the actual survivors and use their controlled hospital. The
// continued return is separate so a saved hospital boundary can be checked.
export function recoverFreshNorthernHospital(start,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'recoverFreshNorthernDoctor',stage:'preparation-input',campaign:start});
 let c=start;
 try{
 c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=northernHospitalOrder(c,a,{inputCapture,report});};
 const patients=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp<r.maxHp;});
 assert.ok(patients.length&&patients.length<6,'a real wounded survivor needs relief');
 // Book the already-planned relief officer at the isolated rear clinic before
 // a field visit advances the bleeding patient's clock. Its issued dressings
 // are finite; a returning former doctor does not receive replacement stock.
 if(!c.officer&&patients.some(id=>c.operativeState[id].location==='cordoba')){
  const localPatients=patients.filter(id=>c.operativeState[id].location==='cordoba'),cash=c.resources.treasury;
  order({type:'createSquad',name:'Socorro de Córdoba',ids:localPatients,sector:'cordoba'});
  order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
  assert.equal(cash-c.resources.treasury,300);assert.equal(c.operativeState[1000].medkits,2);
  for(const operativeId of localPatients)order({type:'assignCare',operativeId,assignment:'patient'});
  order({type:'assignCare',operativeId:1000,assignment:'doctor'});
  report({event:'northernReliefOfficer',operativeId:1000,sector:'cordoba',cost:300,dressings:2,hour:c.hour});
 }
 // Set up paid care at every actual patient location before any field visit
 // advances time for a distant, critically wounded survivor.
 // Keep the healthy local guard while the doctor and actual patients evacuate.
 const escort=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)==='tucuman'&&!patients.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical<80).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(op=>op.id);
 if(escort.length){
  order({type:'createSquad',name:'Guardia de Tucumán',ids:escort,sector:'tucuman'});
  for(const operativeId of escort)order({type:'assignCare',operativeId,assignment:'active'});
 }
 const stabilizationDoctors=[];
 for(const at of new Set(patients.map(id=>c.operativeState[id].location))){
  let medic=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location===at&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  if(!medic){
   const candidate=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&op.medical>=20&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=Math.min(routeHiringCeiling(c,250),c.resources.treasury)).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'week').price-contractQuote(c,b,'week').price)[0];assert.ok(candidate);
   order({type:'recruitCivic',id:candidate.id,term:'week',destination:at});for(let h=0;h<24&&!c.recruited.includes(candidate.id);h++)order({type:'wait',hours:1});assert.ok(c.recruited.includes(candidate.id));medic=rosterFor(c).find(op=>op.id===candidate.id);
  }
  const localPatients=patients.filter(id=>c.operativeState[id].location===at);
  order({type:'createSquad',name:'Estabilización previa',ids:[...new Set([medic.id,...localPatients])],sector:at});
  for(const row of sectorInventoryModel(c,at,rosterFor(c),medic.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   const count=Math.min(row.count,10-c.operativeState[medic.id].medkits);if(count>0)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
  }
  for(const operativeId of localPatients)order({type:'assignCare',operativeId,assignment:'patient'});
  order({type:'assignCare',operativeId:medic.id,assignment:'doctor'});stabilizationDoctors.push(medic.id);
  // Stop the critical patient's bleeding with the already observed dressing
  // before the physician walks to the cache and spends real tactical time.
  if(at==='tucuman'&&localPatients.some(id=>c.operativeState[id].bleeding)){order({type:'wait',hours:1});for(const id of localPatients)assert.ok(c.operativeState[id].alive);}
  if(c.operativeState[medic.id].medkits<3&&at==='tucuman'){c=collectRouteItems(c,medic.id,{item:'medkits'},12).campaign;order({type:'assignCare',operativeId:medic.id,assignment:'doctor'});}
 }
 const stabilized=stabilizeNorthernHospitalPatients(c,patients,stabilizationDoctors,{inputCapture,report});c=stabilized.campaign;stabilizationDoctors.splice(0,stabilizationDoctors.length,...stabilized.doctors);
 for(const id of patients){assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
 for(const operativeId of [...patients,...stabilizationDoctors])order({type:'assignCare',operativeId,assignment:'active'});
 // Treat each actual location before the evacuation clock advances. The
 // defeated enemy may have routed a survivor back to a different province.
 for(const at of new Set(patients.map(id=>c.operativeState[id].location))){
  const local=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===at);
  let medic=rosterFor(c).filter(op=>local.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  if(!medic){
   const candidate=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&op.medical>=20&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=Math.min(routeHiringCeiling(c,250),c.resources.treasury)).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'week').price-contractQuote(c,b,'week').price)[0];assert.ok(candidate,'a real available paid medic must reach the isolated patient');
   order({type:'recruitCivic',id:candidate.id,term:'week',destination:at});
   medic=rosterFor(c).find(op=>op.id===candidate.id);assert.ok(c.recruited.includes(medic.id)&&c.operativeState[medic.id].location===at);
  }
  assert.ok(medic);
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
 let sector=northernRecoveryHospital(c,patients);
 report({event:'northernHospitalSelected',sector,preferred:'cordoba',preferredOwner:c.sectors.cordoba.owner,hour:c.hour,patientLocations:[...new Set(patients.map(id=>operativeLocation(c,id)))]});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'northernHospitalCheckpoint',stage:'stabilized',sector,campaign:structuredClone(c)});
 const rear=escort.filter(id=>operativeLocation(c,id)!==sector);
 if(rear.length){
  const reserves=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!patients.includes(op.id)&&op.id!==1000&&operativeLocation(c,op.id)===sector;}).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).map(op=>op.id);
  const prepared=prepareNorthernHospitalRear(c,rear,{applyOrder:(state,action)=>northernHospitalOrder(state,action,{inputCapture,report}),reserveIds:reserves,report});c=prepared.campaign;escort.push(...prepared.ids.filter(id=>!escort.includes(id)));
  for(let index=stabilizationDoctors.length-1;index>=0;index--)if(prepared.ids.includes(stabilizationDoctors[index]))stabilizationDoctors.splice(index,1);
 }
 for(const at of new Set(patients.map(id=>c.operativeState[id].location).filter(at=>at!==sector))){
  const evacuees=[...new Set([...patients.filter(id=>c.operativeState[id].location===at),...stabilizationDoctors.filter(id=>c.operativeState[id].location===at)])];
  order({type:'createSquad',name:'Evacuación de heridos',ids:evacuees,sector:at});
  for(let leg=0;leg<6&&c.location!==sector;leg++){
   for(const operativeId of evacuees)order({type:'assignCare',operativeId,assignment:'rest'});
   for(let h=0;h<48&&evacuees.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
   for(const operativeId of evacuees)order({type:'assignCare',operativeId,assignment:'active'});
   // Rest advances the strategic clock. Recheck ownership and the physical
   // land route before each departure rather than trusting the earlier plan.
   if(c.sectors[sector].owner!=='patriot'||cellTravelPlan(c,sector).reason)sector=northernRecoveryHospital(c,patients);
   if(c.location!==sector)order({type:'travel',sector});assert.equal(c.pendingEncounter,null);
  }
  assert.equal(c.location,sector);
 }
 order({type:'createSquad',name:`Hospital de ${sector}`,ids:patients,sector});
 if(!c.officer)order({type:'createOfficer',name:'Oficial de socorro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue'}});
 c=supplyRouteAmmunition(c,c.squad,{report}).campaign;

 for(const row of sectorInventoryModel(c,sector,rosterFor(c),1000).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(row.count,10-c.operativeState[1000].medkits);if(count<=0)break;
  order({type:'sectorInventory',sector,operativeId:1000,direction:'take',sourceKey:row.key,expected:row.expected,count});
 }
 for(let level=c.sectors[sector].fort;level<3;level++){const cash=c.resources.treasury;order({type:'fortify',sector});assert.equal(cash-c.resources.treasury,150);report({event:'hospitalFortification',sector,cost:150,level:c.sectors[sector].fort,hour:c.hour});}
 const bestLocalMedicine=Math.max(...rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===sector&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).map(op=>op.medical));
 const relief=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&op.medical>bestLocalMedicine&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&contractQuote(c,op,'week').available&&contractQuote(c,op,'week').price<=Math.min(routeHiringCeiling(c,250),c.resources.treasury)).sort((a,b)=>b.medical-a.medical||contractQuote(c,a,'week').price-contractQuote(c,b,'week').price)[0];
 if(relief){
  const cash=c.resources.treasury,quote=contractQuote(c,relief,'week');
  order({type:'recruitCivic',id:relief.id,term:'week',destination:sector});
  for(let h=0;h<24&&!c.recruited.includes(relief.id);h++)order({type:'wait',hours:1});
  assert.ok(c.recruited.includes(relief.id)&&operativeLocation(c,relief.id)===sector,'the actual paid relief doctor must arrive at the selected hospital');
  assert.equal(cash-c.resources.treasury,quote.price);
  escort.push(relief.id);
  report({event:'northernHospitalPaidRelief',sector,operativeId:relief.id,cost:quote.price,medical:relief.medical,hour:c.hour});
 }
 c=stageRouteRoofDefenders(c,c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp>=15&&!r.bleeding&&!r.asleep;}),{report});
 for(const operativeId of escort.filter(id=>operativeLocation(c,id)===sector))order({type:'assignCare',operativeId,assignment:'rest'});
 const localPatients=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===sector&&r.hp<r.maxHp;});
 const recoveryHours=96+Math.max(...patients.map(id=>c.operativeState[id].maxHp-c.operativeState[id].hp))*careRules(c).restHealingHours;
 for(let h=0;h<recoveryHours&&localPatients().length;h++){
  if(c.pendingEncounter){
   const encounter=c.pendingEncounter;
   report({event:'hospitalCounterattack',campaign:structuredClone(c)});
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.length);assert.ok(defenders,'a real local squad must defend the hospital');
   order({type:'selectSquad',id:defenders.id});
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   const initial=enterSector(c.pendingBattle,c.sectorStates[encounter.sector]),controller=initial.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0))?coastalBatteryController(initial,{sharedArtillerySight:true}):northernHospitalCoverOrder;
   c=fightNorthernSector(c,encounter.sector,{controller,report}).campaign;
   report({event:'hospitalDefended',campaign:structuredClone(c)});
  }
  const injured=localPatients();if(!injured.length)break;
  const medics=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location===sector&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&op.medical>=careRules(c).minimumSkill&&injured.some(id=>id!==op.id));
  medics.sort((a,b)=>Number(!injured.includes(b.id))-Number(!injured.includes(a.id))||b.medical-a.medical||Number(c.operativeState[b.id].medkits>0)-Number(c.operativeState[a.id].medkits>0));
  const medic=medics[0];assert.ok(medic,'a living local medic must treat the remaining patients');
  const assign=(operativeId,assignment)=>{if(c.operativeState[operativeId].assignment!==assignment)order({type:'assignCare',operativeId,assignment});};
  // An exhausted earlier doctor is a real blocked assignment. Rotate that
  // actor through ordinary rest/service before asking the clock to continue.
  for(const op of rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===sector&&op.id!==medic.id&&c.operativeState[op.id].assignment==='doctor')){
   const r=c.operativeState[op.id];assign(op.id,r.hp<r.maxHp||r.energy<100||r.fatigue>0||r.morale<baseMorale(op)?'rest':'active');
  }
  for(const operativeId of injured)assign(operativeId,c.operativeState[operativeId].hp<15||c.operativeState[operativeId].bleeding?'patient':'rest');
  if(!c.operativeState[medic.id].medkits){
   const donor=c.recruited.find(id=>id!==medic.id&&c.operativeState[id].alive&&!c.operativeState[id].captured&&operativeLocation(c,id)===sector&&c.operativeState[id].medkits>0&&!sectorInventoryModel(c,sector,rosterFor(c),id).reason);
   if(donor!==undefined){
    const before=c.operativeState[medic.id].medkits+c.operativeState[donor].medkits;
    const known=new Set(sectorInventoryModel(c,sector,rosterFor(c),medic.id).entries.map(row=>row.key));
    order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});
    const donated=sectorInventoryModel(c,sector,rosterFor(c),medic.id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');
    assert.ok(donated,'the selected physician needs a real path to the local dressing donation');
    order({type:'sectorInventory',sector,operativeId:medic.id,direction:'take',sourceKey:donated.key,expected:donated.expected,count:1});
    assert.equal(c.operativeState[medic.id].medkits+c.operativeState[donor].medkits,before,'doctor rotation conserves the actual dressing pool');
    report({event:'northernHospitalDonation',sector,donor,recipient:medic.id,quantity:1,hour:c.hour});
   }
   const row=!c.operativeState[medic.id].medkits&&sectorInventoryModel(c,sector,rosterFor(c),medic.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(row)order({type:'sectorInventory',sector,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   else if(!c.operativeState[medic.id].medkits&&c.sectorStates[sector]?.props.some(prop=>prop.contents?.some(item=>item.item==='medkits'&&item.count>0))){
    const found=collectRouteItems(c,medic.id,{item:'medkits'},12);c=found.campaign;
    report({event:'northernHospitalFiniteCare',sector,operativeId:medic.id,quantity:found.collected,hour:c.hour});
   }
  }
  if(c.operativeState[medic.id].medkits){const patient=injured.filter(id=>id!==medic.id).sort((a,b)=>c.operativeState[a].hp/c.operativeState[a].maxHp-c.operativeState[b].hp/c.operativeState[b].maxHp)[0];assign(patient,'patient');}
  assign(medic.id,c.operativeState[medic.id].medkits?'doctor':'rest');
  for(const op of rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===sector&&!injured.includes(op.id)&&op.id!==medic.id)){
   const r=c.operativeState[op.id];
   if(r.assignment==='patient'||r.assignment==='rest'&&r.energy>=100&&r.fatigue<=0&&r.morale>=baseMorale(op))assign(op.id,'active');
  }
  const beforeClock=c.hour*3600+(c.secondOfHour??0);
  const careBefore={stock:c.operativeState[medic.id].medkits,energy:c.operativeState[medic.id].energy,fatigue:c.operativeState[medic.id].fatigue,health:injured.reduce((sum,id)=>sum+c.operativeState[id].hp,0)};
  for(let notice=0;c.hour*3600+(c.secondOfHour??0)===beforeClock&&!c.pendingEncounter&&notice<3;notice++)order({type:'wait',hours:1});
  assert.ok(c.hour*3600+(c.secondOfHour??0)>beforeClock||c.pendingEncounter,'the actual care wait must advance or expose its real encounter');
  report({event:'northernHospitalCareTick',medic:medic.id,medical:medic.medical,before:careBefore,after:{stock:c.operativeState[medic.id].medkits,energy:c.operativeState[medic.id].energy,fatigue:c.operativeState[medic.id].fatigue,asleep:c.operativeState[medic.id].asleep,health:injured.reduce((sum,id)=>sum+c.operativeState[id].hp,0)},elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-beforeClock,hour:c.hour});
 }
 assert.deepEqual(localPatients(),[],'surviving local patients must finish recovery');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'northernHospitalCheckpoint',stage:'recovered',sector,campaign:structuredClone(c)});
 return {campaign:c,sector,patients,escort};
 }catch(error){
  recordRouteStrategicEvidence({helper:'recoverFreshNorthernDoctor',stage:'preparation-failure',campaign:c,inputCapture,error});throw error;
 }
}

// Continue the recovered party to Buenos Aires through ordinary travel. The
// rural land planner may avoid an occupied town; its occupation remains for
// the later explicit northern-road recapture.
export function recoverFreshNorthernDoctor(start,{report=()=>{}}={}){
 return returnFreshNorthernHospital(recoverFreshNorthernHospital(start,{report}),{report});
}

// Keep an actual paid rifleman at the clinic before the return advances time.
// Its issued dressing is transferred through the public sector inventory. The
// physician takes a reachable vacant roof cell beside the earned guard posts;
// no other defender is restaged and no body, stock or clock is assigned.
export function prepareNorthernHospitalReturnGuard(hospital,{report=()=>{}}={}){
 const before=structuredClone(hospital),sector=hospital.sector,escort=[...hospital.escort];let c=decodeSave(encodeSave(hospital.campaign)).campaign;
 if(!c.enemyGroups.some(group=>group.target===sector&&group.status==='marching'))return {...hospital,campaign:c,escort,returnDoctor:null};
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 const candidates=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&!c.hiringArrivals.some(row=>row.operativeId===op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured).map(op=>({op,quote:contractQuote(c,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=c.resources.treasury).sort((a,b)=>b.op.marksmanship-a.op.marksmanship||a.quote.total-b.quote.total||a.op.id-b.op.id);
 const selected=candidates[0];assert.ok(selected,'The threatened clinic needs an actual available paid guard.');
 const booked=bookRouteHires(c,[selected.op.id],{term:'day',destination:sector,report});c=booked.campaign;const hire=booked.hires[0];
 const order=action=>{c=northernHospitalOrder(c,action,{report});};
 for(let hour=0;hour<24&&c.hiringArrivals.some(row=>row.operativeId===hire.id);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assertRouteHireArrived(c,hire);
 const home=c.squads.filter(q=>q.location===sector&&!q.journey&&q.members.length>0&&q.members.length<6&&q.members.some(id=>escort.includes(id))).sort((a,b)=>b.members.length-a.members.length||a.id.localeCompare(b.id))[0];
 if(home)order({type:'assignToSquad',operativeId:hire.id,squadId:home.id});else order({type:'createSquad',ids:[hire.id],sector,name:'Guardia de la evacuación'});
 escort.push(hire.id);
 const doctor=rosterFor(c).filter(op=>escort.includes(op.id)&&op.id!==hire.id&&operativeLocation(c,op.id)===sector&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&op.medical>0).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(doctor,'A serving local physician must cover the actual clinic guard.');
 if(!c.operativeState[doctor.id].medkits){
  assert.ok(c.operativeState[hire.id].medkits>0,'The paid guard must carry a real dressing for the clinic.');
  const stock=c.operativeState[hire.id].medkits+c.operativeState[doctor.id].medkits,known=new Set(sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.map(row=>row.key));
  order({type:'sectorInventory',sector,operativeId:hire.id,direction:'drop',item:'medkits',count:1});
  const row=sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'The clinic physician needs the actual reachable donated dressing.');
  order({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  assert.equal(c.operativeState[hire.id].medkits+c.operativeState[doctor.id].medkits,stock);report({event:'northernReturnDressingDonation',donor:hire.id,doctor:doctor.id,count:1,sourceKey:row.key,stockBefore:stock,stockAfter:stock});
 }
 const active=c.activeSquadId,startSeconds=c.hour*3600+(c.secondOfHour??0),positions=escort.filter(id=>id!==doctor.id&&c.operativeState[id].residentPosition&&(c.operativeState[id].residentPosition.tacticalLevel??0)>0).map(id=>c.operativeState[id].residentPosition);
 const occupied=c.recruited.filter(id=>id!==doctor.id&&c.operativeState[id].alive&&!c.operativeState[id].captured&&operativeLocation(c,id)===sector).map(id=>c.operativeState[id].residentPosition).filter(Boolean);
 order({type:'createSquad',ids:[doctor.id],sector,name:'Sanitario de la guardia'});order({type:'assignCare',operativeId:doctor.id,assignment:'active'});order({type:'visitSector'});
 let battle=enterSector(c.pendingBattle,c.sectorStates[sector]);const unitId=String(doctor.id),actions=[];
 const roofs=getReachable(battle,battle.units.find(unit=>unit.id===unitId)).filter(point=>(point.tacticalLevel??0)>0&&!occupied.some(other=>sameCell(other,point))).map(point=>({...point,neighbors:positions.filter(other=>sameSurface(other,point)&&Math.hypot(other.x-point.x,other.y-point.y)<=1.5).length,distance:positions.reduce((sum,other)=>sum+Math.hypot(other.x-point.x,other.y-point.y),0)})).sort((a,b)=>b.neighbors-a.neighbors||a.distance-b.distance||a.cost-b.cost||a.y-b.y||a.x-b.x);
 const destination=roofs[0];assert.ok(destination&&destination.neighbors>0,'The physician needs reachable cover beside the actual roof guards.');
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+battle.lastError);actions.push(action);};
 act({type:'movement',unitId,movement:'walk'});for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++)act({type:'move',unitId,...spacePoint(destination)});
 assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});
 const synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(unit=>unit.side==='player')});order({type:'selectSquad',id:active});
 report({event:'northernReturnGuardReady',guardId:hire.id,doctorId:doctor.id,hire:structuredClone(hire),position:structuredClone(c.operativeState[doctor.id].residentPosition),actions,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-startSeconds,campaign:structuredClone(c)});
 assert.deepEqual(hospital,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {...hospital,campaign:c,escort,returnDoctor:doctor.id};
}

// Stop at the same native victory gate as the game. A cleared exploration
// sector is complete even while its status remains active. Replay only real
// issued orders, with the official campaign/battle save at the midpoint.
export function settleNorthernHospitalReturnDefense(start,sector,{doctorId,report=()=>{}}={}){
 const before=structuredClone(start),request=start.pendingBattle,previous=start.sectorStates[sector];assert.equal(request.sector,sector);
 let battle=enterSector(request,previous);const orders=[];
 report({event:'northernReturnDefenseInput',campaign:structuredClone(start),battle:structuredClone(battle)});
 for(let window=0;window<600&&battle.turn<=80&&battle.status==='active'&&!completedTacticalVictory(battle);window++){
  const ids=battle.units.filter(unit=>unit.side==='player'&&!unit.militia).sort((a,b)=>b.marksmanship-a.marksmanship).map(unit=>unit.id);
  for(let attempt=0;attempt<16&&battle.status==='active'&&!completedTacticalVictory(battle);attempt++){
   let acted=false;
   for(const id of ids){
    if(battle.status!=='active'||completedTacticalVictory(battle))break;
    const unit=battle.units.find(unit=>unit.id===id);if(!interruptAvailable(battle,unit)||unit.ap<3)continue;
    const action=id===String(doctorId)?northernHospitalCoverOrder(battle,unit):tucumanCombatOrder(battle,unit);if(!action)continue;
    const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);battle=next;orders.push(action);acted=true;
   }
   if(!acted)break;
  }
  if(battle.status==='active'&&!completedTacticalVictory(battle)){battle=endTurn(battle);assert.equal(battle.lastError,null,battle.lastError);orders.push({type:'endTurn'});}
 }
 const summary={sector,preparationSeconds:0,startSeconds:battle.startSeconds,elapsedSeconds:battle.elapsedSeconds,status:battle.status,mode:battle.mode,sectorCleared:battle.sectorCleared,turns:battle.turn,actions:orders.filter(action=>action.type!=='endTurn').length,units:battle.units.map(unit=>({id:unit.id,side:unit.side,hp:unit.hp,ammo:unit.ammo,loaded:unit.loaded,routed:unit.routed}))};
 report({event:'battleFinished',...summary});assert.ok(completedTacticalVictory(battle),JSON.stringify(summary));
 const replay=withSave=>{
  let pair={campaign:structuredClone(start),battle:enterSector(request,previous)};
  for(let index=0;index<orders.length;index++){
   const action=orders[index],next=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);
   const synced=syncBattleTime(pair.campaign,next);assert.equal(synced.error,null,synced.error);pair={campaign:synced.campaign,battle:synced.battle};
   if(withSave&&index===Math.floor(orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
  }
  return pair;
 };
 const played=replay(false),restored=replay(true);assert.deepEqual(restored,played);assert.deepEqual(played.battle.units,battle.units);assert.equal(played.battle.seed,battle.seed);assert.equal(played.battle.elapsedSeconds,battle.elapsedSeconds);assert.ok(completedTacticalVictory(restored.battle));
 const c=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:restored.battle,survivors:restored.battle.units.filter(unit=>unit.side==='player')});assert.equal(c.lastError,null,c.lastError);assert.equal(c.defeated,false);assert.equal(c.sectors[sector].owner,'patriot');assert.equal(c.pendingBattle,null);
 for(const unit of battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0&&!unit.militia&&!unit.missionAlly))assert.equal(c.operativeState[Number(unit.id)].alive,false);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'northernReturnDefenseReplay',...summary,orders,exactSavedReplay:true,losses:start.recruited.filter(id=>start.operativeState[id].alive&&!c.operativeState[id].alive),campaign:structuredClone(c)});
 return {campaign:c,summary};
}

// Resume a strict saved hospital boundary without repeating treatment or fees.
export function returnFreshNorthernHospital(hospital,{report=()=>{}}={}){
 const start=hospital.campaign,inputCapture=recordRouteStrategicEvidence({helper:'recoverFreshNorthernDoctor',stage:'recovered-hospital-input',campaign:start});
 let c=decodeSave(encodeSave(start)).campaign;assert.deepEqual(c,start);
 const prepared=prepareNorthernHospitalReturnGuard(hospital,{report});c=prepared.campaign;
 const {sector,escort,returnDoctor}=prepared;
 const order=a=>{c=northernHospitalOrder(c,a,{inputCapture,report});};
 try{
 const party=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&operativeLocation(c,id)===sector&&!escort.includes(id);});
 assert.ok(party.length>0&&party.length<=6);
 if(c.location!==sector){
  const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.includes(party[0]));assert.ok(home,'Select an actual local hospital squad before assembling its returning patients.');
  order({type:'selectSquad',id:home.id});
 }
 order({type:'squad',ids:party});
 const resolveReturnContact=()=>{
  while(c.pendingEncounter){
   const returning=c.activeSquadId,encounter=c.pendingEncounter;
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));
   assert.ok(defenders,'the threatened sector needs its actual local guard');
   order({type:'selectSquad',id:defenders.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   const defense=settleNorthernHospitalReturnDefense(c,encounter.sector,{doctorId:returnDoctor,report});c=defense.campaign;
   const injured=defense.summary.units.filter(unit=>unit.side==='player'&&unit.hp>0&&c.operativeState[Number(unit.id)]).map(unit=>Number(unit.id)).filter(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
   if(injured.length){
    for(const operativeId of injured)order({type:'assignCare',operativeId,assignment:'patient'});
    const physician=rosterFor(c).filter(op=>operativeLocation(c,op.id)===encounter.sector&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
    assert.ok(physician,'Actual bleeding return guards need a serving local physician before the clock advances.');
    const care=stabilizeNorthernHospitalPatients(c,injured,[physician.id],{inputCapture,report});c=care.campaign;
    report({event:'northernReturnFiniteCare',sector:encounter.sector,receipt:care.receipt,campaign:structuredClone(c)});
   }
   for(const unit of defense.summary.units.filter(unit=>unit.side==='player'&&unit.hp>0)){
    const record=c.operativeState[Number(unit.id)];if(record)assert.ok(record.alive&&record.hp>=15&&!record.bleeding,'Actual surviving guards need timely finite aid before the return clock advances.');
   }
   report({event:'northernReturnDefended',groupId:encounter.groupId,...defense.summary});
   order({type:'selectSquad',id:returning});
  }
 };
 const journey=()=>c.squads.find(q=>q.id===c.activeSquadId)?.journey;
 for(let leg=0;leg<6&&c.location!=='buenos_aires';leg++){
  resolveReturnContact();
  // A remote defense stops the clock without cancelling this physical route.
  for(let h=0;h<240&&journey()?.status==='moving';h++){order({type:'wait',hours:1});resolveReturnContact();}
  assert.notEqual(journey()?.status,'moving','the real return leg must finish or stop for rest');
  if(c.location==='buenos_aires')break;
  if(journey())assert.equal(journey().status,'paused','the medical return must remain a normal travel route');
  // Rural cells admit ordinary sleep, but they are not owned hospitals. End
  // the paused leg at its real boundary, sleep, then plan the remaining route.
  if(journey())order({type:'cancelTravel',choice:'stop'});
  assert.equal(journey(),undefined,'actual rural recovery needs a finished travel boundary');
  for(const operativeId of c.squad){const r=c.operativeState[operativeId];if(!r.asleep&&(r.fatigue>0||r.energy<100))order({type:'setSleep',operativeId,asleep:true});}
  for(let h=0;h<48&&c.squad.some(id=>c.operativeState[id].asleep);h++){order({type:'wait',hours:1});resolveReturnContact();}
  assert.ok(c.squad.every(id=>!c.operativeState[id].asleep),'the actual party must finish its sleep before continuing');
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  // Queue the actual route, then retain every serving paid actor before each
  // real hourly wait. Departure itself advances no clock and needs no 48-hour
  // prepayment before the ordinary midnight income can be earned.
  order(journey()?{type:'resumeTravel'}:{type:'travel',sector:'buenos_aires',queue:true});resolveReturnContact();
 }
 assert.equal(c.location,'buenos_aires');
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 c=meetRecruits(c,['paroissien','dorrego'],c.squad.find(id=>c.operativeState[id].alive));
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
 }catch(error){
  recordRouteStrategicEvidence({helper:'recoverFreshNorthernDoctor',stage:'preparation-failure',campaign:c,inputCapture,error});throw error;
 }
}

// Use one native controller run, then replay only its issued orders. The official
// midpoint save must preserve the full campaign/battle pair before settlement.
function settleNorthernReturnRecapture(start,report){
 const request=start.pendingBattle,previous=start.sectorStates.cordoba;
 assert.equal(request.sector,'cordoba');
 // The returning infantry has two edge approaches. Use the existing native
 // infantry policy rather than advancing every soldier with the mobile gun.
 const result=fightOpeningBattle(request,previous,{controller:northernCombatOrder});
 const summary={sector:'cordoba',preparationSeconds:0,startSeconds:result.battle.startSeconds,elapsedSeconds:result.battle.elapsedSeconds,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});assert.equal(result.battle.status,'victory',JSON.stringify(summary));
 const replay=withSave=>{
  let pair={campaign:structuredClone(start),battle:enterSector(request,previous)};
  for(let index=0;index<result.orders.length;index++){
   const action=result.orders[index],battle=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+battle.lastError);
   const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);pair={campaign:synced.campaign,battle:synced.battle};
   if(withSave&&index===Math.floor(result.orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
  }
  return pair;
 };
 const played=replay(false),restored=replay(true);assert.deepEqual(restored,played);
 assert.deepEqual(played.battle.units,result.battle.units);assert.equal(played.battle.seed,result.battle.seed);assert.equal(played.battle.elapsedSeconds,result.battle.elapsedSeconds);assert.equal(played.battle.status,result.battle.status);
 const c=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 assert.equal(c.lastError,null,c.lastError);assert.equal(c.defeated,false);assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.pendingBattle,null);
 for(const unit of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0&&!u.militia&&!u.missionAlly))assert.equal(c.operativeState[Number(unit.id)].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'northernReturnRecaptured',...summary,orders:result.orders.length,exactSavedReplay:true,campaign:structuredClone(c)});
 return c;
}

// The relief can return with seven living soldiers after the two real Buenos
// Aires conversations. Form ordinary columns; no survivor is left behind to
// satisfy the public six-member squad limit.
export function prepareNorthernReunionColumns(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...new Set([10,4,...c.squad])].filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id]?.captured);
 assert.ok(field.length,'The reunion needs its actual living field soldiers.');
 const actions=[],groups=[],at=c.location;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);actions.push(structuredClone(action));};
 order({type:'squad',ids:field.slice(0,6)});groups.push(c.activeSquadId);
 for(let offset=6;offset<field.length;offset+=6){
  order({type:'createSquad',ids:field.slice(offset,offset+6),sector:at,name:'Apoyo del regreso'});groups.push(c.activeSquadId);
 }
 order({type:'selectSquad',id:groups[0]});
 const columns=groups.map(id=>({id,members:[...c.squads.find(q=>q.id===id).members]}));
 assert.deepEqual(columns.flatMap(q=>q.members),field);
 report({event:'northernReunionColumns',field:[...field],columns,actions,campaign:structuredClone(c)});
 return {campaign:c,field,groups};
}

export function reuniteFreshNorthernSquad(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const lostCordoba=c.sectors.cordoba.owner==='royalist';
 const retainFor=hours=>{
  const until=(c.hour+hours)*3600+(c.secondOfHour??0);
  for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))while(contractExpiresSeconds(c.contracts[id])!==null&&contractExpiresSeconds(c.contracts[id])<=until){
   const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
   assert.equal(quote.available,true,quote.reason);c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash-quote.price);
   assert.equal(contractExpiresSeconds(c.contracts[id]),quote.expiresAt*3600+(quote.expiresSecond??0));
   report({event:'northernReunionRenewal',id,action,quote:structuredClone(quote),cost:cash-c.resources.treasury,beforeExpiry:contractExpiresSeconds(contract),afterExpiry:contractExpiresSeconds(c.contracts[id]),hour:c.hour,second:c.secondOfHour??0});
  }
 };
 const order=a=>{
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)retainFor(elapsed);
  const before=c;c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
  report({event:'northernReunionOrder',action:structuredClone(a),cost:before.resources.treasury-c.resources.treasury,elapsedSeconds:(c.hour-before.hour)*3600+(c.secondOfHour??0)-(before.secondOfHour??0),hour:c.hour,second:c.secondOfHour??0});
  if(lostCordoba)assert.equal(c.pendingEncounter,null,'the real recapture preparation must stop for an unrelated encounter');
  while(elapsed&&c.pendingEncounter){
   const returning=c.activeSquadId,encounter=c.pendingEncounter;
   const defenders=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive));assert.ok(defenders,'the threatened sector needs its actual garrison');
   order({type:'selectSquad',id:defenders.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   c=fightNorthernSector(c,encounter.sector,{controller:tucumanCombatOrder,report}).campaign;
   order({type:'selectSquad',id:returning});
  }
 };
const formation=prepareNorthernReunionColumns(c,{report});c=formation.campaign;
const {field,groups:southernColumns}=formation,primaryField=[...c.squad];
const reloadColumns=()=>{
 const selected=c.activeSquadId;
 for(const id of southernColumns){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c,{report});}
 order({type:'selectSquad',id:selected});
};
if(lostCordoba){
 const occupations=c.enemyGroups.filter(group=>group.target==='cordoba'&&group.status==='stationed').map(group=>group.id);
 assert.ok(occupations.length,'the return must identify the actual occupying force');
 const guard=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)==='tucuman';});assert.ok(guard.length,'the joined recapture needs its actual northern guard');
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<30&&field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 retainFor(48);report({event:'northernReturnRested',campaign:structuredClone(c)});
 for(const id of field)if(c.operativeState[id].weaponDropped)c=recoverRoutePrimary(c,id,{report});
 c=supplyRouteAmmunition(c,field,{target:10,report}).campaign;reloadColumns();
 const pool=[...Object.entries(c.artilleryDepots??{}).flatMap(([at,guns])=>guns.map(gun=>({at,source:'depot',gun}))),...Object.entries(c.sectorStates).flatMap(([at,scene])=>(scene.artillery??[]).map(gun=>({at,source:'field',gun})))].filter(row=>c.sectors[row.at]?.owner==='patriot'&&row.gun.side==='player');
 const piece=pool.filter(row=>(row.gun.loaded||row.gun.ammo>0)&&artilleryProfile(c,row.gun).crew<=primaryField.length).sort((a,b)=>Number(b.at===c.location)-Number(a.at===c.location)||Number(b.source==='depot')-Number(a.source==='depot')||b.gun.ammo+Number(b.gun.loaded)-a.gun.ammo-Number(a.gun.loaded)||a.gun.id.localeCompare(b.gun.id))[0];
 assert.ok(piece,'the recapture needs an actual controlled cannon and enough living crew');
 const keepServing=[...new Set([...guard,...field])];
 const battery=prepareRouteBattery(c,[piece.gun.type],{destination:'san_nicolas',excludeIds:pool.filter(row=>row.gun.id!==piece.gun.id).map(row=>row.gun.id),keepServing,report});c=battery.campaign;
 assert.equal(c.location,'san_nicolas');assert.deepEqual(c.squad,primaryField);
 const southern=c.activeSquadId;
 // The support column has its own ordinary journey, sleep and paid terms.
 // An empty battery request moves people without acquiring another gun.
 for(const id of southernColumns.slice(1)){
  order({type:'selectSquad',id});c=prepareRouteBattery(c,[],{destination:'san_nicolas',keepServing,report}).campaign;
  assert.equal(c.location,'san_nicolas');
  report({event:'northernReunionColumnArrived',id,members:[...c.squad],campaign:structuredClone(c)});
 }
 order({type:'selectSquad',id:southern});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 reloadColumns();const northern=[];
 for(let offset=0;offset<guard.length;offset+=6){
  // A living local guard may be unassigned after the earlier native defense.
  // Creating its real local squad does not require an existing squad first.
  order({type:'createSquad',ids:guard.slice(offset,offset+6),sector:'tucuman',name:'Guardia del camino'});northern.push(c.activeSquadId);
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});
 }
 // A depot choice belongs to its physical origin, even when another squad is
 // currently selected. Both real approaches join the same assault afterward.
 order({type:'selectSquad',id:southern});order({type:'configureArtillery',types:battery.selections});retainFor(36);
 const groups=[...southernColumns,...northern];for(const id of groups){order({type:'selectSquad',id});order({type:'attack',sector:'cordoba',queue:true});}
 for(let h=0;h<36&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 assert.ok(groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'),'both actual recapture approaches must finish');order({type:'beginAssault',sector:'cordoba'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),[...field,...guard].sort((a,b)=>a-b));
 report({event:'northernReturnRecaptureReady',campaign:structuredClone(c),occupations});c=settleNorthernReturnRecapture(c,report);
 for(const id of occupations)assert.equal(c.enemyGroups.find(group=>group.id===id).status,'defeated','the actual road occupation must be defeated, not skipped');
 const actor=c.squad.includes(4)?4:rosterFor(c).filter(op=>c.squad.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].asleep).sort((a,b)=>b.leadership-a.leadership)[0]?.id;assert.ok(actor!==undefined);
 c=meetRecruits(c,['quiroga','paz'],actor);
 const recovered=recoverRecapturedRoad(c);c=recovered.campaign;report({event:'northernRoadRecovered',hour:c.hour,treasury:c.resources.treasury,careEvents:recovered.events,campaign:structuredClone(c)});
 if(!c.routes.posta)order({type:'transport',mode:'posta'});
 c=returnNorthernOfficers(c);
 // Future marching incursions remain real campaign state. This branch only
 // replaces the occupation that already blocked the original return route.
 assert.equal(c.pendingEncounter,null);for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'northernReturnReunited',campaign:structuredClone(c)});return c;
}
for(const id of southernColumns){
order({type:'selectSquad',id});
for(let leg=0;leg<6&&c.location!=='cordoba';leg++){
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba'});
 assert.equal(c.pendingEncounter,null);
}
assert.equal(c.location,'cordoba');
}
order({type:'selectSquad',id:southernColumns[0]});c=meetRecruits(c,['quiroga','paz']);
return restoreNorthernRoad(c,{report});
}

export const prepareFreshSaltaAssault=prepareRestoredSalta;

export function prepareFreshNorthernHandover(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{const next=dispatchCampaign(c,a);if(next.lastError)report({event:'northernHandoverStopped',campaign:structuredClone(c),action:a,error:next.lastError});c=next;assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const waitHour=()=>{
  if(c.pendingEncounter){
   report({event:'saltaCounterattack',campaign:structuredClone(c)});
   c=resolveNorthernHandoverEncounter(c,{report});
   report({event:'saltaDefended',campaign:structuredClone(c)});
  }
  c=retainNorthernHandoverService(c,{report});
  order({type:'wait',hours:1});
 };
 // Stabilize the actual local casualties before meetings advance tactical time.
 const urgent=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='salta'&&(r.bleeding||r.hp<15);});
 const careDoctors=new Set();
 for(let h=0;h<24&&urgent().length;h++){
  const patients=urgent(),doctor=rosterFor(c).filter(op=>{
   const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='salta'&&!patients.includes(op.id)&&r.hp>=15&&!r.bleeding&&r.energy>10&&r.medkits>0&&op.medical>=20;
  }).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'local urgent care needs an actual supplied doctor');
  careDoctors.add(doctor.id);order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
  waitHour();
 }
 assert.deepEqual(urgent(),[],'the handover must not abandon critical casualties');
 for(const operativeId of careDoctors)order({type:'assignCare',operativeId,assignment:'active'});
 const before=structuredClone(c.resources);order({type:'diplomacy',kind:'northPact'});
 assert.equal(c.resources.treasury,before.treasury-300);assert.deepEqual(Object.keys(c.resources),['treasury']);
 // Select the living envoy explicitly after a multi-squad victory. Other
 // survivors retain their records and equipment in Salta.
 const envoy=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp>=15&&r.location==='salta';}).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0];
 assert.ok(envoy,'a living local envoy must continue the northern mission');
 const envoySquad=c.squads.find(q=>q.members.includes(envoy.id));assert.ok(envoySquad);
 order({type:'selectSquad',id:envoySquad.id});order({type:'squad',ids:[envoy.id]});
 c=meetRecruits(c,['guemes','macacha'],envoy.id);
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});for(let i=0;i<30&&c.squad.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);i++)waitHour();for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'tucuman'});report({event:'northernHandoverTravel',campaign:structuredClone(c),envoy:envoy.id,envoySquad:envoySquad.id});
c=continueNorthernHandoverTravel(c,{squadId:envoySquad.id,report});return {campaign:c,envoy:envoy.id};
}

export function finishFreshNorthernCampaign(start,{report=()=>{}}={}){
 const handover=prepareFreshNorthernHandover(start,{report});let c=handover.campaign;
 const envoy={id:handover.envoy},order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'visitMission',mission:'yatasto'});let b=enterSector(c.pendingBattle,c.sceneStates.yatasto);
for(const npcId of ['yatasto-belgrano','yatasto-san-martin','yatasto-san-martin']){b=approachNPC(b,String(envoy.id),npcId);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;order({type:'talkNPC',npcId,unitId:envoy.id,approach:'mission',sectorState:b});const saved=decodeSave(encodeSave(c,b));c=saved.campaign;b=saved.battle;}
order({type:'finishMission',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
