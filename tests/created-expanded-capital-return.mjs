import assert from 'node:assert/strict';
import {rosterFor,civicStatus,dispatchCampaign} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {isContractOperative} from '../game/content-character-ids.js';
import {serviceRelationshipRefusal} from '../game/service-relationships.js';
import {serviceObjectionReason} from '../game/service-objections.js';
import {baseMorale} from '../game/morale.js';
import {publicAssignmentNotice} from '../game/assignment-attention.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {applyItemQuantity,inventoryUsage} from '../game/tactical-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount,totalAmmo} from '../game/ammo-types.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {BLADES,actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {collectReturnedServiceKit} from './returned-service-kit.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {saltaBatteryWaypoints} from './salta-route.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {recoverRouteBodywear} from './route-owned-bodywear.mjs';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const healthy=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding;};

// A second explicit public wait acknowledges a reported assignment. Keep the
// zero-time exception tied to that real notice, rather than clearing its state.
export function expandedCapitalWaitNotice(c,{startedSeconds,requestedHours}){
 assert.ok(Number.isSafeInteger(requestedHours)&&requestedHours>=1&&requestedHours<=24,'Keep ordinary waits between one and twenty-four hours.');
 assert.equal(clock(c),startedSeconds,'Only a zero-time attention stop may be acknowledged.');
 assert.ok(!c.pendingEncounter&&!c.pendingBattle&&!c.defeated&&!c.completed,'Stop for every actual contact, battle or campaign outcome.');
 const notice=publicAssignmentNotice(c);
 assert.ok(notice&&notice.hour===c.hour&&notice.requestedHours===requestedHours&&notice.advancedHours===0&&notice.events.length,'A zero-time wait needs its actual matching public assignment notice.');
 return notice;
}

function activateFieldPrimaries(start,report){
 const rounds=s=>start.squad.reduce((sum,id)=>{const r=s.operativeState[id],u=carriedAmmunition(rosterFor(s).find(op=>op.id===id),r);return sum+totalAmmo(u)+u.loaded;},0),beforeRounds=rounds(start);
 let c=dispatchCampaign(start,{type:'visitSector'});assert.equal(c.lastError,null);
 let battle=enterSector(c.pendingBattle,c.sectorStates[c.location]);const began=battle.elapsedSeconds;
 let switches=0;
 for(const id of start.squad){const unit=battle.units.find(u=>u.id===String(id)&&u.side==='player');assert.ok(unit&&unit.hp===unit.maxHp&&!unit.weaponDropped);
  if(unit.activeSlot==='primary')continue;
  const action={type:'weapon',unitId:unit.id,slot:'primary'};battle=actBattle(battle,action);assert.equal(battle.lastError,null);switches++;report({event:'expandedCapitalPrimaryActivated',id,action});
 }
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(c.lastError,null);
 assert.equal(rounds(c),beforeRounds);assert.ok(switches?pair.battle.elapsedSeconds>began:pair.battle.elapsedSeconds>=began);
 for(const id of start.squad)assert.equal(c.operativeState[id].activeSlot,'primary');return c;
}

// This quotation does not release a returned-property marker or assume a hire.
// Blocked veterans remain blocked until ordinary local collection completes.
export function expandedCapitalReliefPlan(c,{fieldSize=12,commanderId=57,source='santa_fe',maxRestHours=600,logisticsHours=240,reserve=10000}={}){
 assert.ok(Number.isSafeInteger(fieldSize)&&fieldSize>=7&&fieldSize<=42,'The expanded field must fit seven six-person columns and retain a reserve squad.');
 assert.ok(Number.isSafeInteger(maxRestHours)&&maxRestHours>0&&maxRestHours<=600,'Keep the existing 600-hour native morale-rest bound.');
 assert.ok(Number.isSafeInteger(logisticsHours)&&logisticsHours>0&&logisticsHours<=720);
 assert.ok(Number.isSafeInteger(reserve)&&reserve>=0);
 assert.equal(c.pendingBattle,null,'Settle the actual river battle before quoting relief.');
 assert.equal(c.pendingEncounter,null);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId&&c.operativeState[id].location===source);
 assert.ok(keepers.includes(commanderId),'The actual living commander must return to reserve.');
 assert.ok(field.length>=6&&field.length<=fieldSize,'Retain every actual river survivor.');
 for(const id of keepers){const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'The original living returnees must still be serving.');}
 const roster=rosterFor(c),missing=fieldSize-field.length;
 const candidates=roster.filter(op=>{
  if(!isContractOperative(c,op)||c.recruited.includes(op.id)||!healthy(c,op.id))return false;
  const marker=c.operativeState[op.id].serviceEquipmentReturn,quote=contractQuote(c,op,'week');
  if(marker)return c.sectors[marker.sectorId]?.owner==='patriot'&&!serviceRelationshipRefusal(c,op)&&!serviceObjectionReason(c,op);
  return civicStatus(c,op.id).available&&quote.available;
 }).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,missing).map(op=>({
  id:op.id,marksmanship:op.marksmanship,location:c.operativeState[op.id].location,
  returnMarker:structuredClone(c.operativeState[op.id].serviceEquipmentReturn??null),
  day:contractQuote(c,op,'day'),week:contractQuote(c,op,'week')
 }));
 assert.equal(candidates.length,missing,'Every added fighter needs one actual healthy, publicly recoverable candidate.');
 const serviceWeeks=Math.ceil((maxRestHours+logisticsHours)/168)+1;
 const retainedWeekly=keepers.reduce((sum,id)=>sum+contractQuote(c,roster.find(op=>op.id===id),'week').price,0);
 const candidateWeekly=candidates.reduce((sum,row)=>sum+row.week.price,0),guarantees=candidates.reduce((sum,row)=>sum+row.week.guarantee,0);
 return {fieldSize,commanderId,source,keepers,field,candidates,maxRestHours,logisticsHours,serviceWeeks,reserve,
  requiredTreasury:reserve+serviceWeeks*(retainedWeekly+candidateWeekly)+guarantees,
  retainedWeekly,candidateWeekly,guarantees,fieldDressings:fieldSize*5,batterySize:3};
}

// Prepare a larger paid infantry relief while retaining the separate 4/6-person
// compatibility helper. Troop count never determines the three owned guns.
// No battle is resolved here: the caller must run the unchanged native gate.
export function prepareCreatedExpandedCapitalReturn(start,{report=()=>{},fieldSize=12,commanderId=57,source='santa_fe',hospital='cordoba',staging='san_nicolas',target='buenos_aires',medicalSource='ensenada',maxRestHours=600,maxSavingHours=24000,logisticsHours=240,reserve=10000}={}){
 assert.ok(Number.isSafeInteger(maxSavingHours)&&maxSavingHours>0&&maxSavingHours<=24000,'Use the existing bounded income-saving horizon.');
 const before=structuredClone(start),plan=expandedCapitalReliefPlan(start,{fieldSize,commanderId,source,maxRestHours,logisticsHours,reserve});
 let c=decodeSave(encodeSave(start)).campaign,phase='care';
 const keepers=new Set(plan.keepers),field=[...plan.field],deaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive),events=[];
 const guns=(start.sectorStates[source]?.artillery??[]).filter(g=>g.side==='player'&&g.type==='bronze4');
 assert.equal(guns.length,3,'The relief must retain exactly three actual river bronze guns.');assert.ok(guns.every(g=>!g.loaded&&g.ammo===0),'Empty river guns remain empty.');
 const gunRecords=new Map(guns.map(g=>[g.id,storedArtilleryRecord(g)]));
 const emit=e=>{events.push(e);report(e);};
 const safe=()=>{
  for(const id of keepers){assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured,'Every retained living actor must remain in real service.');const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'Every retained actor needs a current paid term.');}
  for(const[id,r]of deaths){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  assert.equal(c.pendingEncounter,null,'Resolve the actual encounter before continuing expanded preparation.');
 };
 const publicStock=()=>({clock:clock(c),treasury:c.resources.treasury,sector:c.location,
  sources:sectorInventorySites(c,c.location).flatMap(site=>sectorInventoryModel(c,site.id,rosterFor(c)).entries.map(row=>({siteId:site.id,sourceKey:row.key,count:row.count,expected:row.expected}))),
  carried:[...keepers].map(id=>{const op=rosterFor(c).find(op=>op.id===id),r=c.operativeState[id],u=carriedAmmunition(op,r);return {id,location:r.location,medkits:r.medkits,weapon:op.weapon,loaded:u.loaded,rounds:totalAmmo(u),inventory:structuredClone(r.inventory)};})});
 const issue=action=>{
  const time=clock(c),cash=c.resources.treasury,next=dispatchCampaign(c,action);
  if(next.lastError){emit({event:'expandedCapitalOrderRefused',phase,action:structuredClone(action),reason:next.lastError,hour:c.hour,second:c.secondOfHour??0});throw Error(JSON.stringify(action)+' '+next.lastError);}
  c=next;safe();emit({event:'expandedCapitalOrder',phase,action:structuredClone(action),cost:cash-c.resources.treasury,startSeconds:time,endSeconds:clock(c)});
 };
 const retain=seconds=>{for(const id of keepers){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=clock(c)+seconds){
  const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;
  assert.equal(quote.available,true,quote.reason);assert.ok(cash>=quote.price,'Bank the actual retained service cost before renewing.');
  const action={type:'renewContract',id,term:'week',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};issue(action);
  assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.contracts[id].expiresAt,quote.expiresAt);assert.equal(c.contracts[id].expiresSecond??0,quote.expiresSecond??0);
  const next=contractExpiresSeconds(c.contracts[id]);assert.ok(next>expiry);expiry=next;emit({event:'expandedCapitalRenewal',id,quote,action});
 }}};
 const order=action=>{
  if(action.type!=='wait'){issue(action);return;}
  assert.ok(Number.isSafeInteger(action.hours)&&action.hours>=1&&action.hours<=24);
  const until=clock(c)+action.hours*3600;let consecutivePauses=0;
  for(let attempts=0;clock(c)<until&&attempts<action.hours+3;attempts++){
   assert.ok(!c.pendingEncounter&&!c.pendingBattle&&!c.defeated&&!c.completed,'Stop for every actual contact, battle or campaign outcome.');
   const remaining=until-clock(c);assert.equal(remaining%3600,0,'The public hourly wait must preserve the actual second offset.');
   const requestedHours=remaining/3600,time=clock(c);retain(remaining+1);issue({...action,hours:requestedHours});
   assert.ok(!c.pendingEncounter&&!c.pendingBattle&&!c.defeated&&!c.completed,'Stop for every actual contact, battle or campaign outcome.');
   const elapsed=clock(c)-time;assert.ok(elapsed>=0&&elapsed<=remaining,'The ordinary wait must advance within its remaining requested interval.');
   if(!elapsed){
    const notice=expandedCapitalWaitNotice(c,{startedSeconds:time,requestedHours});assert.ok(++consecutivePauses<=3,'Stop after three consecutive actual zero-time notices.');
    emit({event:'expandedCapitalWaitPaused',phase,notice,startSeconds:time,endSeconds:clock(c),remainingSeconds:until-clock(c)});
   }else consecutivePauses=0;
  }
  assert.equal(clock(c),until,'The complete retained public wait must spend its exact requested hours after acknowledgement.');
 };
 const adopt=(name,fn,{hours=24}={})=>{
  retain(hours*3600+1);const beforeStock=publicStock(),receipts=[],next=fn(c,e=>receipts.push(e));c=next;safe();assert.equal(c.pendingBattle,null,'Finish the actual local preparation visit.');
  for(const e of receipts)emit(e);emit({event:'expandedCapitalPhaseAdopted',phase,name,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,beforeStock,afterStock:publicStock()});
 };
 const rest=(ids,{morale=true,limit=maxRestHours,daylight=false}={})=>{
  for(const operativeId of ids){assert.ok(healthy(c,operativeId),'Only stabilized full-health actors enter this rest phase.');order({type:'assignCare',operativeId,assignment:'rest'});}
  const ready=id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep&&(!morale||r.morale>=baseMorale(rosterFor(c).find(op=>op.id===id)));};
  const began=clock(c);for(let hours=0;hours<limit&&(!ids.every(ready)||daylight&&c.hour%24!==6);hours++){
   for(const id of ids)if(c.operativeState[id].asleep&&c.operativeState[id].energy===100)order({type:'setSleep',operativeId:id,asleep:false});
   if(ids.every(ready)&&(!daylight||c.hour%24===6))break;order({type:'wait',hours:1});
  }
  assert.ok(ids.every(ready),'The full-health force must recover actual energy, fatigue and native base morale within the original rest bound.');
  if(daylight)assert.equal(c.hour%24,6);emit({event:'expandedCapitalRestComplete',phase,ids:[...ids],elapsedSeconds:clock(c)-began,hour:c.hour,second:c.secondOfHour??0});
 };
 const form=(ids,at,name)=>{assert.ok(ids.length&&ids.length<=6);order({type:'createSquad',ids,sector:at,name});return c.activeSquadId;};
 const move=(squadId,destination)=>{
  order({type:'selectSquad',id:squadId});
  adopt('finite public journey',(input,r)=>prepareRouteBattery(input,[],{destination,keepServing:[...keepers],waypointsFor:saltaBatteryWaypoints,report:r}).campaign,{hours:2});
  const group=c.squads.find(q=>q.id===squadId);assert.equal(group.location,destination);assert.equal(group.journey,undefined);
  for(const id of group.members)assert.equal(c.operativeState[id].location,destination);
 };
 const kitTotal=ids=>ids.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);
 const dressing=(id,targetCount,reserves)=>adopt('finite dressing transfer',(input,r)=>supplyRouteDressings(input,id,targetCount,{reserves,report:r}));
 const knownMedical=at=>sectorInventorySites(c,at).flatMap(site=>sectorInventoryModel(c,site.id,rosterFor(c)).entries.filter(row=>JSON.parse(row.expected).item==='medkits').map(row=>({siteId:site.id,key:row.key,count:row.count,expected:row.expected})));
 try{
  // Include command at his actual province. Public first aid and separate
  // local columns must complete before Córdoba can treat the whole cohort.
  const careReports=[];c=recoverFreshPort(c,{hospital,fieldIds:plan.keepers,prepareCareSupplies:true,retainField:true,carryDressings:30,report:e=>careReports.push(e)});safe();for(const e of careReports)emit(e);
  for(const id of plan.keepers){assert.ok(healthy(c,id));assert.equal(c.operativeState[id].location,hospital);}
  assert.ok(kitTotal(plan.keepers)>=30,'Carry thirty real post-care dressings before planning the larger relief.');
  emit({stage:'expandedCapitalCare',field:[...field],keepers:[...keepers],campaign:structuredClone(c)});
  phase='retained-rest';rest([...keepers]);
  // An actual reserve donation joins the relief stock before the couriers
  // leave. It moves through drop/take, never through a remote pocket edit.
  const reserveKits=c.operativeState[commanderId].medkits??0;
  if(reserveKits){const recipient=field.find(id=>{try{applyItemQuantity(sectorInventoryModel(c,hospital,rosterFor(c),id).personal,{item:'medkits',count:reserveKits,weight:.2});return true;}catch{return false;}});assert.ok(recipient,'A real local field carrier must accept the reserve donation.');
   const reserves=Object.fromEntries([...keepers].map(id=>[id,id===commanderId?0:c.operativeState[id].medkits]));dressing(recipient,c.operativeState[recipient].medkits+reserveKits,reserves);
  }
  phase='medical-courier';const needed=Math.max(0,fieldSize*5-kitTotal(field));
  if(needed){
   assert.equal(c.sectors[medicalSource]?.owner,'patriot');const knownBefore=knownMedical(medicalSource);assert.ok(knownBefore.reduce((sum,row)=>sum+row.count,0)>=needed,'The larger force needs enough real known dressings outside the occupied capital.');
   const candidates=field.filter(id=>{try{applyItemQuantity(sectorInventoryModel(c,hospital,rosterFor(c),id).personal,{item:'medkits',count:10,weight:.2});return true;}catch{return false;}}).sort((a,b)=>inventoryUsage(sectorInventoryModel(c,hospital,rosterFor(c),b).personal).free-inventoryUsage(sectorInventoryModel(c,hospital,rosterFor(c),a).personal).free||a-b);
   const courierIds=candidates.slice(0,Math.ceil(needed/10));assert.ok(courierIds.length===Math.ceil(needed/10)&&courierIds.length<=6,'Each real courier must have room for ten additional dressings.');
   const courier=form(courierIds,hospital,'Vendas del puerto');move(courier,medicalSource);rest(courierIds,{morale:false,limit:48});
   let remaining=needed;for(const id of courierIds){const quantity=Math.min(10,remaining),old=c.operativeState[id].medkits??0;
    while(c.operativeState[id].medkits-old<quantity){
     const sourceRow=sectorInventorySites(c,medicalSource).map(site=>({siteId:site.id,row:sectorInventoryModel(c,site.id,rosterFor(c),id).entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits')})).find(row=>row.row);
     assert.ok(sourceRow,'The actual Ensenada carrier must reach a known finite dressing source.');const {siteId,row}=sourceRow,count=Math.min(row.count,quantity-(c.operativeState[id].medkits-old)),money=c.resources.treasury,time=clock(c);
     order({type:'sectorInventory',sector:siteId,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
     assert.equal(c.resources.treasury,money);assert.equal(clock(c),time);assert.equal(sectorInventoryModel(c,siteId,rosterFor(c),id).entries.find(next=>next.key===row.key)?.count??0,row.count-count);
     emit({event:'expandedCapitalMedicalSource',operativeId:id,siteId,sourceKey:row.key,expected:row.expected,count,remaining:row.count-count});
    }
    remaining-=quantity;
   }
   assert.equal(remaining,0);move(courier,hospital);rest(courierIds,{morale:false,limit:48});
   assert.equal(knownBefore.reduce((sum,row)=>sum+row.count,0)-knownMedical(medicalSource).reduce((sum,row)=>sum+row.count,0),needed);
   assert.ok(kitTotal(field)>=fieldSize*5);emit({event:'expandedCapitalMedicalCourierComplete',courierIds,source:medicalSource,needed,carried:kitTotal(field),hour:c.hour,second:c.secondOfHour??0});
  }
  phase='returned-property';const returnSites=[...new Set(plan.candidates.map(row=>row.returnMarker?.sectorId).filter(Boolean))];
  const propertyCouriers=field.slice(0,Math.min(3,field.length)),propertyGroup=form(propertyCouriers,hospital,'Equipo de veteranos');
  for(const at of returnSites){move(propertyGroup,at);rest(propertyCouriers,{morale:false,limit:48});adopt('actual returned property',(input,r)=>collectReturnedServiceKit(input,at,propertyCouriers,{report:r}));}
  // Only after the finite markers are collected does ordinary recruitment
  // decide availability. No hypothetical quote is used as hire admission.
  let candidates=rosterFor(c).filter(op=>isContractOperative(c,op)&&!c.recruited.includes(op.id)&&healthy(c,op.id)&&civicStatus(c,op.id).available&&contractQuote(c,op,'week').available).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,fieldSize-field.length);
  assert.equal(candidates.length,fieldSize-field.length,'The restored real property must release enough healthy actual candidates.');
  move(propertyGroup,hospital);rest([...keepers],{limit:48});
  phase='funding';const required=()=>reserve+plan.serviceWeeks*([...keepers].reduce((sum,id)=>sum+contractQuote(c,rosterFor(c).find(op=>op.id===id),'week').price,0)+candidates.reduce((sum,op)=>sum+contractQuote(c,op,'week').price,0))+candidates.reduce((sum,op)=>sum+contractQuote(c,op,'week').guarantee,0);
  const savingStart=clock(c),savingEnd=savingStart+maxSavingHours*3600;
  while(clock(c)<savingEnd&&c.resources.treasury<required())order({type:'wait',hours:Math.min(24,(savingEnd-clock(c))/3600)});
  assert.ok(c.resources.treasury>=required(),'Ordinary real income must bank the complete quoted relief service and transport reserve.');
  emit({event:'expandedCapitalReliefFunded',hour:c.hour,second:c.secondOfHour??0,required:required(),treasury:c.resources.treasury,serviceWeeks:plan.serviceWeeks,savingSeconds:clock(c)-savingStart,candidates:candidates.map(op=>({id:op.id,day:contractQuote(c,op,'day'),week:contractQuote(c,op,'week')}))});
  phase='paid-arrivals';const additions=[];
  for(const op of candidates){const quote=contractQuote(c,op,'week'),cash=c.resources.treasury,record=c.operativeState[op.id],personal=carriedAmmunition(op,record),old={medkits:record.medkits,rounds:totalAmmo(personal)+personal.loaded,startingCartridgesIssued:record.startingCartridgesIssued};
   assert.ok(healthy(c,op.id));assert.equal(civicStatus(c,op.id).available,true,civicStatus(c,op.id).reason);assert.equal(quote.available,true,quote.reason);const destination=c.sectors[record.location]?.owner==='patriot'?record.location:hospital;
   const bookedAt=clock(c);order({type:'recruitCivic',id:op.id,term:'week',destination});assert.equal(c.resources.treasury,cash-quote.total);const treasuryAfterHire=c.resources.treasury;
   for(let h=0;h<48&&!c.recruited.includes(op.id);h++)order({type:'wait',hours:1});assert.ok(c.recruited.includes(op.id));keepers.add(op.id);additions.push(op.id);field.push(op.id);safe();assert.equal(c.operativeState[op.id].location,destination);
   const after=carriedAmmunition(rosterFor(c).find(next=>next.id===op.id),c.operativeState[op.id]);assert.equal(c.operativeState[op.id].medkits,old.medkits);assert.equal(totalAmmo(after)+after.loaded,old.rounds);assert.equal(c.operativeState[op.id].startingCartridgesIssued,old.startingCartridgesIssued,'Returned veterans receive no second starting allowance.');
   emit({event:'expandedCapitalVeteranHired',id:op.id,destination,quote,treasuryBefore:cash,treasuryAfter:treasuryAfterHire,treasuryAtArrival:c.resources.treasury,bookedAt,arrivedAt:clock(c)});
  }
  assert.equal(field.length,fieldSize);
  phase='finite-veteran-equipment';
  for(const at of new Set(additions.map(id=>c.operativeState[id].location))){
   const localIds=additions.filter(id=>c.operativeState[id].location===at);
   for(let offset=0;offset<localIds.length;offset+=6){
   const local=localIds.slice(offset,offset+6),group=form(local,at,'Veteranos del puerto');
   adopt('finite veteran protection',(input,r)=>recoverRouteBodywear(input,local,{report:r}));
   for(const id of local){
    const model=sectorInventoryModel(c,at,rosterFor(c),id),preferred=rosterFor(c).find(op=>op.id===id).weapon===1802?1802:1800;
    const known=model.entries.filter(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon)).sort((a,b)=>Number(JSON.parse(b.expected).weapon===preferred)-Number(JSON.parse(a.expected).weapon===preferred));
    assert.ok(known.length,'A returned veteran needs an actual known finite long gun.');
    adopt('finite veteran primary',(input,r)=>recoverRoutePrimary(input,id,{preferredWeapon:JSON.parse(known[0].expected).weapon,strictPreference:true,replace:true,report:r}));
    const bladeModel=()=>sectorInventoryModel(c,at,rosterFor(c),id);
    if(!bladeModel().personal.blade){
     const row=bladeModel().entries.find(row=>row.reachable&&BLADES[JSON.parse(row.expected).weapon]);assert.ok(row,'The actual veteran needs a finite returned blade.');
     order({type:'sectorInventory',sector:at,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
     const carried=bladeModel().carried.find(row=>row.inventoryKey&&BLADES[JSON.parse(row.expected).weapon]&&row.equip.some(option=>option.slot==='blade'&&option.valid));assert.ok(carried);
     order({type:'sectorInventory',sector:at,operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'blade'});
    }
   }
   move(group,hospital);
   }
  }
  phase='paid-native-rest';rest([...keepers]);assert.equal(c.operativeState[commanderId].location,hospital);
  emit({stage:'expandedCapitalPaidRest',field:[...field],keepers:[...keepers],campaign:structuredClone(c)});
  // Distribute the carried finite linen in Córdoba before the larger field
  // leaves its reserve commander. All donations retain the original stacks.
  const reserves=Object.fromEntries(field.map(id=>[id,5]));for(const id of field)if(c.operativeState[id].medkits<5)dressing(id,5,reserves);
  assert.ok(field.every(id=>c.operativeState[id].medkits>=5));
  phase='finite-ammunition';form([commanderId],hospital,'Reserva de Córdoba');const groups=[];
  for(let offset=0;offset<field.length;offset+=6){const group=form(field.slice(offset,offset+6),hospital,'Auxilio del puerto');groups.push(group);move(group,source);}
  order({type:'selectSquad',id:groups[0]});
  adopt('ordinary river cache opening',(input)=>discoverRouteCache(input,c.squad[0]));
  adopt('finite field protection',(input,r)=>recoverRouteBodywear(input,field,{report:r}));
  for(const id of field)if(c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(op=>op.id===id).weapon)){
   const model=sectorInventoryModel(c,source,rosterFor(c),id),row=model.entries.find(row=>row.reachable&&[1800,1801].includes(JSON.parse(row.expected).weapon));assert.ok(row,'Replace a lost or short gun only with a known finite musket.');
   adopt('finite field primary',(input,r)=>recoverRoutePrimary(input,id,{preferredWeapon:JSON.parse(row.expected).weapon,strictPreference:true,replace:true,report:r}));
  }
  adopt('finite sixteen-round field loads',(input,r)=>supplyRouteAmmunition(input,field,{target:16,report:r}).campaign);
  order({type:'configureArtillery',types:[]});for(const group of groups){order({type:'selectSquad',id:group});adopt('ordinary finished reloads',(input,r)=>finishReloadsBeforeMarch(input,{report:r}),{hours:2});adopt('ordinary primary activation',activateFieldPrimaries,{hours:2});}
  phase='empty-battery';order({type:'selectSquad',id:groups[0]});let selections;
  adopt('three original empty guns',(input,r)=>{const result=prepareRouteBattery(input,['bronze4','bronze4','bronze4'],{destination:staging,keepServing:[...keepers],report:r});selections=result.selections;return result.campaign;},{hours:2});
  for(const[id,record]of gunRecords)assert.deepEqual(c.artilleryDepots[staging].find(gun=>gun.id===id),record,'Transport must retain the exact empty physical gun.');
  for(const group of groups)move(group,staging);rest([...keepers],{limit:48,daylight:true});
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'selectSquad',id:groups[0]});order({type:'configureArtillery',types:selections});
  phase='coordinated-assault';for(const group of groups){order({type:'selectSquad',id:group});order({type:'attack',sector:target,queue:true,mode:'posta'});}
  for(let h=0;h<24&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
  assert.ok(groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'),'Every actual six-person column must finish its real approach.');
  retain(24*3600+1);order({type:'beginAssault',sector:target});assert.equal(c.pendingBattle.squad.length,fieldSize);
  assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),field.slice().sort((a,b)=>a-b));assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));
  const artillery=c.pendingBattle.artillery.filter(g=>!g.stationed);assert.equal(artillery.length,3);assert.deepEqual(artillery.map(g=>g.id).sort(),[...gunRecords.keys()].sort());assert.ok(artillery.every(g=>g.type==='bronze4'&&!g.loaded&&g.ammo===0));
  for(const id of field){const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id),personal=carriedAmmunition(op,r);assert.ok(healthy(c,id));assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=baseMorale(op));assert.ok(!r.weaponDropped&&[1800,1801,1802].includes(op.weapon));assert.equal(r.activeSlot,'primary');assert.ok(personal.loaded+ammoCount(personal)>=16);assert.ok(r.medkits>=5);for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);}
  assert.equal(c.operativeState[commanderId].location,hospital);assert.ok(healthy(c,commanderId));assert.ok(!c.pendingBattle.squad.some(u=>u.id===commanderId));safe();
  const battle=enterSector(c.pendingBattle,c.sectorStates[target]);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});assert.deepEqual(start,before);
  emit({event:'expandedCapitalReliefReady',hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,field:[...field],additions,commanderId,batterySize:3,groups,selections,events:events.filter(e=>e.event==='expandedCapitalOrder')});return c;
 }catch(error){assert.deepEqual(start,before);emit({event:'expandedCapitalPreparationStopped',phase,reason:error.message,campaign:structuredClone(c)});error.campaign=c;throw error;}
}
