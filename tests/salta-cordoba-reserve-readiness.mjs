import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus,recruitmentStatus} from '../packages/game/campaign.js';
import {isContractOperative} from '../packages/game/content-character-ids.js';
import {contractQuote,contractExpiresSeconds} from '../packages/game/contracts.js';
import {hiringArrivalReason} from '../packages/game/hiring-arrivals.js';
import {operativeLocation,operativeInTransit,canReassignOperative} from '../packages/game/squads.js';
import {careAssignmentIssue,doctorRate} from '../packages/game/medical-care.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../packages/game/tactical-inventory.js';
import {carriedAmmunition,ammunitionOrderQuote} from '../packages/game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../packages/game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../packages/game/ammunition-families.js';
import {WEAPONS} from '../packages/game/data.js';
import {encounterDefinitions,encounterRequirements,canRecruitEncounter} from '../packages/game/encounters.js';
import {enterSector} from '../packages/game/world.js';
import {actBattle,getReachable,canSee,lookPreview,artilleryContact} from '../packages/game/tactical.js';
import {dispatchCampaignSandbox} from '../packages/game/public/campaign-playtest-api.js';
import {dialogueApproach} from '../packages/game/npc-dialogue.js';
import {wallMovementBlocked} from '../packages/game/wall-geometry.js';
import {spacePoint,sameCell,sameSurface} from '../packages/game/tactical-space.js';
import {surfaceAt} from '../packages/game/tactical-space.js';
import {syncBattleTime} from '../packages/game/time.js';
import {artilleryProfile} from '../packages/game/artillery-definitions.js';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';
import {saltaEarlyClinicCareOrders,supplySaltaClinicDoctors,clinicCareChange} from './salta-clinic-supply.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {fight} from './opening-driver.mjs';
import {createPairedRouteOrders} from './paired-route-battle.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {searchLocalDepotDressings} from './local-depot-medical-search.mjs';
import {courierSaltaCordobaOriginDressings} from './salta-cordoba-origin-supply.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const local=(c,at)=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===at);
const fit=(c,id)=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&!r.routed&&!r.unconscious&&r.energy>10;};
const freeGuard=(c,id)=>fit(c,id)&&canReassignOperative(c,id)&&['active','rest'].includes(c.operativeState[id].assignment??'active');
const clinicDoctor=(c,town,patients)=>rosterFor(c).filter(op=>town.includes(op.id)&&!patients.includes(op.id)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
const offers=c=>rosterFor(c).filter(op=>isContractOperative(c,op)&&fit(c,op.id)&&civicStatus(c,op.id).available).map(op=>({op,quote:contractQuote(c,op,'week')})).filter(row=>row.quote.available&&!row.quote.permanent&&row.quote.price>0).sort((a,b)=>a.quote.total-b.quote.total||b.op.marksmanship-a.op.marksmanship||a.op.id-b.op.id);

// This is the current local wound/stock quote, before choosing how to obtain
// any missing dressings. Unknown depot stock and future arrivals do not count.
export function saltaRearClinicDressingQuote(c,clinic='tucuman'){
 const town=local(c,clinic),patients=town.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding),physician=clinicDoctor(c,town,patients);
 if(patients.length&&!physician)return {available:false,reason:'The current clinic needs a fit serving colleague before its wound quote.'};
 const demand=patients.reduce((n,id)=>n+Math.max(Number(c.operativeState[id].bleeding>0),Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(physician,c))),0)+2,carried=town.reduce((n,id)=>n+Math.max(0,c.operativeState[id].medkits-(id===physician?.id?0:1)),0);
 return {available:true,town,patients,physician,demand,carried,missing:Math.max(0,demand-carried)};
}

// Quote current roles, every guarantee, finite clinic packs and the later
// twelve-person assault together. No future earnings or unadmitted NPC joins
// reduce the reserve. Re-quote after every actual hire or meeting.
export function quoteSaltaRearFunding(c,{rearIds,paidOffers,clinic='tucuman',deadlineSeconds}={}){
 const clinicQuote=saltaRearClinicDressingQuote(c,clinic);if(!clinicQuote.available)return clinicQuote;
 const {town,demand,carried}=clinicQuote,excluded=new Set([...rearIds,...paidOffers.map(row=>row.op.id)]);
 let missing=Math.max(0,demand-carried),pool=offers(c).filter(row=>!excluded.has(row.op.id)),clinicOffers=[];
 for(const row of pool.filter(row=>!excluded.has(row.op.id)&&c.operativeState[row.op.id].medkits>1).map(row=>({...row,quote:contractQuote(c,row.op,'day')})).filter(row=>row.quote.available).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id)){
  if(!missing)break;clinicOffers.push(row);excluded.add(row.op.id);missing=Math.max(0,missing-(c.operativeState[row.op.id].medkits-1));
 }
 if(missing)return {available:false,reason:'Current finite paid clinic packs do not cover the remaining wound quote.'};
 const fieldPool=pool.filter(row=>!excluded.has(row.op.id)),needed=Math.max(1,12-town.length-clinicOffers.length);let fieldOffers=null;
 for(const specialist of [...fieldPool].sort((a,b)=>b.op.marksmanship-a.op.marksmanship||a.op.id-b.op.id)){
  const first={...specialist,quote:contractQuote(c,specialist.op,'day')};if(!first.quote.available)continue;
  const rest=fieldPool.filter(row=>row.op.id!==first.op.id).map(row=>({...row,quote:contractQuote(c,row.op,'day')})).filter(row=>row.quote.available).sort((a,b)=>a.quote.total-b.quote.total||b.op.marksmanship-a.op.marksmanship).slice(0,needed-1);if(rest.length===needed-1){fieldOffers=[first,...rest];break;}
 }
 if(!fieldOffers)return {available:false,reason:'The quoted rear would consume the later twelve-person Salta force.'};
 const rearCost=paidOffers.reduce((n,row)=>n+row.quote.total,0),clinicCost=clinicOffers.reduce((n,row)=>n+row.quote.total+Math.max(0,Math.floor((deadlineSeconds-clock(c)-row.quote.hours*3600)/(row.quote.hours*3600))+1)*row.quote.price,0),fieldCost=fieldOffers.reduce((n,row)=>n+row.quote.total,0),fieldReserve=250,service=quoteMountainServiceBudget(c,{keepIds:c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),horizonSeconds:deadlineSeconds,fixedCost:rearCost+clinicCost+fieldCost+fieldReserve});
 return {...service,rearCost,clinicCost,fieldCost,fieldReserve,clinicOffers:clinicOffers.map(row=>({id:row.op.id,quote:row.quote})),fieldOffers:fieldOffers.map(row=>({id:row.op.id,quote:row.quote})),demand,carried};
}

// An unaffordable paid pack plan can first search the controlled rear depot.
// Only a real delivered parcel changes the later local clinic funding quote.
export function prepareSaltaExistingDepotSupply(start,{rearIds,paidOffers,deadlineSeconds,resolveEncounter,report=()=>{}}){
 const before=structuredClone(start),funding=quoteSaltaRearFunding(start,{rearIds,paidOffers,deadlineSeconds}),clinic=saltaRearClinicDressingQuote(start),orders=[],care=[],renewals=[],encounters=[];
 const costs=[funding.rearCost,funding.fieldCost,funding.fieldReserve],reservedPesos=costs.every(Number.isSafeInteger)?costs.reduce((sum,cost)=>sum+cost,0):null;
 let campaign=start,battle=null,search=null,courier=null,searchStart=null;
 const rememberSearch=()=>{orders.push(...search.orders);renewals.push(...search.renewals);if(clock(campaign)>clock(searchStart))care.push(clinicCareChange(searchStart,campaign));};
 const rememberCourier=()=>{orders.push(...courier.orders);care.push(...courier.care);renewals.push(...courier.renewals);encounters.push(...courier.externalTransitions.map(row=>row.before.campaign.pendingEncounter).filter(Boolean));};
 const finish=reason=>{assert.deepEqual(start,before);return {campaign,receipt:{needed:Boolean(search||courier),reason,funding,clinic,reservedPesos,search,courier,orders,care,renewals,encounters,clinicAfter:saltaRearClinicDressingQuote(campaign),startSeconds:clock(start),endSeconds:clock(campaign),deadlineSeconds}};};
 if(funding.available||!clinic.available||!clinic.missing||!Number.isSafeInteger(reservedPesos))return finish('existing-plan');
 // Preserve the quoted six-person rear, later field force and original250.
 // This does not count uncollected stock or any future campaign income.
 const service=quoteMountainServiceBudget(start,{keepIds:start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),horizonSeconds:deadlineSeconds,fixedCost:reservedPesos});
 if(!service.available)return finish('known-costs-unfunded');
 const holderId=rearIds.filter(id=>freeGuard(start,id)&&operativeLocation(start,id)==='cordoba').sort((a,b)=>start.operativeState[b].medkits-start.operativeState[a].medkits||a-b)[0];
 if(holderId===undefined)return finish('no-free-local-holder');
 try{
  const additional=Math.max(0,clinic.missing+2-campaign.operativeState[holderId].medkits);
  if(additional){
   searchStart=campaign;const result=searchLocalDepotDressings(campaign,{sector:'cordoba',operativeId:holderId,requested:additional,deadlineSeconds,report});campaign=result.campaign;battle=result.battle;search=result.receipt;rememberSearch();
   assert.equal(battle,null,'Finish the actual depot visit before any supply journey.');assert.equal(search.restored,true,'The depot search must really restore its local defender.');
  }
  const actual=saltaRearClinicDressingQuote(campaign),quantity=Math.min(actual.missing+1,campaign.operativeState[holderId].medkits-1);
  if(!actual.available||!actual.missing||quantity<=1)return finish('actual-depot-shortage');
  // Search time changes the actual contract timestamps. Requote the same
  // distinct planned rear and field identities before one real rear booking.
  const roster=rosterFor(campaign),rearOffers=paidOffers.map(row=>{const op=roster.find(op=>op.id===row.op.id);return {op,quote:contractQuote(campaign,op,'week')};}),fieldOffers=funding.fieldOffers.map(row=>{const op=roster.find(op=>op.id===row.id);return {op,quote:contractQuote(campaign,op,'day')};});
  const carrier=rearOffers.find(row=>{if(!fit(campaign,row.op.id)||!civicStatus(campaign,row.op.id).available||campaign.operativeState[row.op.id].medkits<1)return false;try{applyItemQuantity(structuredClone(carriedAmmunition(row.op,campaign.operativeState[row.op.id])),{item:'medkits',count:quantity,weight:SUPPLY_ITEMS.medkits.weight});return true;}catch{return false;}});
  if(!carrier)return finish('no-current-planned-carrier');
  const delivered=courierSaltaCordobaOriginDressings(campaign,{holderId,carrierId:carrier.op.id,requestedCount:quantity,paidOffers:rearOffers,fieldOffers,deadlineSeconds,resolveEncounter,report});campaign=delivered.campaign;courier=delivered.receipt;rememberCourier();
  assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);assert.equal(courier.restored,true);assert.ok(clock(campaign)<=deadlineSeconds);
  return finish('actual-parcel-delivered');
 }catch(error){
  if(error?.campaign)campaign=error.campaign;if(error?.battle)battle=error.battle;
  if(!search&&error?.localDepotMedicalSearch){search=error.localDepotMedicalSearch;rememberSearch();}
  if(!courier&&error?.saltaCordobaOriginSupply){courier=error.saltaCordobaOriginSupply;rememberCourier();}
  if(error&&typeof error==='object'){error.campaign=campaign;error.battle=battle;error.saltaExistingDepotSupply={funding,clinic,reservedPesos,search,courier,orders,care,renewals,encounters,deadlineSeconds,restored:false};}throw error;
 }
}

// Complete the currently quoted local wound batch before asking the older
// courier preparer whether its physical stock is still insufficient.
export function prepareSaltaRearClinicBatch(start,{rearIds,deadlineSeconds,resolveEncounter,report=()=>{}}){
 const before=structuredClone(start),town=local(start,'tucuman'),patients=town.filter(id=>start.operativeState[id].hp<start.operativeState[id].maxHp||start.operativeState[id].bleeding),doctor=clinicDoctor(start,town,patients);
 assert.ok(doctor,'The actual local batch needs a fit serving colleague.');
 const target=2+patients.reduce((n,id)=>n+Math.max(Number(start.operativeState[id].bleeding>0),Math.ceil((start.operativeState[id].maxHp-start.operativeState[id].hp)/doctorRate(doctor,start))),0),funding=quoteSaltaRearFunding(start,{rearIds,paidOffers:[],deadlineSeconds});assert.equal(funding.available,true,funding.reason);
 let campaign=start;const orders=[];try{
  const supplied=supplySaltaClinicDoctors(campaign,[doctor.id],{minimumDressings:target,reserveDressings:2,donorReserve:1,reliefIds:funding.clinicOffers.map(row=>row.id),deadlineSeconds,resolveEncounter,report});campaign=supplied.campaign;
  for(const action of saltaEarlyClinicCareOrders(campaign,doctor,patients)){const from=clock(campaign),cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);orders.push({action:structuredClone(action),from,to:clock(campaign),treasuryChange:campaign.resources.treasury-cash});assert.equal(campaign.lastError,null);}
  for(const id of patients)assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured,'Every original batch patient survives the actual supply.');assert.ok(clock(campaign)<=deadlineSeconds);assert.deepEqual(start,before);
  return {campaign,receipt:{...((({campaign,...receipt})=>receipt)(supplied)),doctorId:doctor.id,patients,target,funding,orders,startSeconds:clock(start),endSeconds:clock(campaign)}};
 }catch(error){if(error?.campaign)campaign=error.campaign;if(error&&typeof error==='object'){error.campaign=campaign;error.saltaRearClinicBatch={patients,doctorId:doctor.id,target,funding,orders,deadlineSeconds,localSupply:error.clinicLocalSupply??null};}throw error;}
}

// The actual-entry hook is shared by original execution and official replay.
// Explicit caller controllers bypass this executor in salta-route.
export function saltaCordobaReserveEncounterExecutor(campaign,sector,{ready=false,encounterController}={}){
 if(!ready||encounterController!=null||sector!=='cordoba'||campaign.pendingBattle?.sector!==sector)return undefined;
 return function fightSaltaCordobaReserve(request,previous,options){
  const bridge=createPairedRouteOrders(campaign);let policy=null;
  const result=fight(request,previous,{...options,admitBattle:initial=>{assert.equal(policy,null);const actual=bridge.admitBattle(initial);policy=coordinatedHospitalBattery(actual);return actual;},executeOrder:bridge.executeOrder,controller:(b,u)=>{assert.ok(policy);return policy.controller(b,u);}});
  assert.equal(result.battle,bridge.pair.battle);assert.deepEqual(result.orders,bridge.orders);return {...result,pair:bridge.pair};
 };
}

export function prepareSaltaCordobaReserveReadiness(start,{deadlineSeconds,report=()=>{},resolveEncounter}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareSaltaCordobaReserveReadiness',stage:'preparation-input',campaign:start,context:{deadlineSeconds}});
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(start));const before=structuredClone(start),selected=start.activeSquadId,oldGroups=structuredClone(start.squads),oldPosts=local(start,'cordoba').filter(id=>start.operativeState[id].residentPosition?.tacticalLevel>0).map(id=>({id,position:structuredClone(start.operativeState[id].residentPosition)})),originalPatients=local(start,'tucuman').filter(id=>start.operativeState[id].hp<start.operativeState[id].maxHp||start.operativeState[id].bleeding),orders=[],hires=[],meetings=[],funding=[],visits=[],care=[],renewals=[],encounters=[],transfers=[],depotSupplies=[];
 let c=start,b=null,visitDeadline=null;const sector='cordoba';
 const check=()=>{assert.equal(c.defeated,false);assert.ok(clock(c)<=deadlineSeconds,'Córdoba readiness uses the same clinical deadline.');for(const id of originalPatients)assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured,'Every original clinic patient survives actual rear preparation.');};
 const settle=()=>{if(!c.pendingEncounter)return;assert.equal(typeof resolveEncounter,'function','Settle the actual rear-preparation encounter.');const pending=structuredClone(c.pendingEncounter);c=resolveEncounter(c,{deadlineSeconds});encounters.push(pending);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);check();};
 const order=action=>{settle();check();const from=clock(c),cash=c.resources.treasury;c=dispatchCampaign(c,action);orders.push({kind:'campaign',action:structuredClone(action),from,to:clock(c),cost:cash-c.resources.treasury});assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);check();if(action.type!=='visitSector')settle();};
 const retain=until=>{const q=quoteMountainServiceBudget(c,{keepIds:c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),horizonSeconds:until});assert.equal(q.available,true,q.reason);for(const row of q.entries)for(let i=0;i<row.renewals;i++){const contract=c.contracts[row.id];order({type:'renewContract',id:row.id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});renewals.push({id:row.id,quote:row.quote});}};
 const inventory=(id,site=operativeLocation(c,id))=>sectorInventoryModel(c,site,rosterFor(c),id);
 const take=(id,selector,count)=>{const at=operativeLocation(c,id),source=sectorInventorySites(c,at).map(site=>({site:site.id,view:inventory(id,site.id)})).flatMap(({site,view})=>view.operativeId===id&&!view.reason?view.entries.filter(row=>row.reachable&&row.count>=count&&selector(JSON.parse(row.expected))).map(row=>({site,row})):[])[0];if(!source)return false;applyItemQuantity(inventory(id,source.site).personal,{...JSON.parse(source.row.expected),count});order({type:'sectorInventory',sector:source.site,operativeId:id,direction:'take',sourceKey:source.row.key,expected:source.row.expected,count});transfers.push({recipient:id,site:source.site,sourceKey:source.row.key,expected:source.row.expected,count});return true;};
 const linen=(id,reserveIds,target=2)=>{while(c.operativeState[id].medkits<target){if(take(id,item=>item.item==='medkits',1))continue;const at=operativeLocation(c,id),donor=local(c,at).find(other=>other!==id&&c.operativeState[other].medkits>(reserveIds.includes(other)?1:0)&&inventory(other).operativeId===other&&!inventory(other).reason);assert.ok(donor!==undefined,'A rear doctor needs real accessible finite linen.');const known=new Set(inventory(id).entries.map(row=>row.key));order({type:'sectorInventory',sector:at,operativeId:donor,direction:'drop',item:'medkits',count:1});const row=inventory(id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);order({type:'sectorInventory',sector:at,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});transfers.push({donor,recipient:id,site:at,sourceKey:row.key,expected:row.expected,count:1});}};
 const beginVisit=()=>{retain(Math.min(deadlineSeconds,clock(c)+3600));assert.ok(clock(c)+3600<=deadlineSeconds,'The actual rear visit needs its retained hour inside the same clinical budget.');for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});visitDeadline=Math.min(deadlineSeconds,clock(c)+3600);order({type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates[sector]);visits.push({initial:structuredClone(b),actions:[]});};
 const act=action=>{const unit=b.units.find(u=>u.id===String(action.unitId)),path=action.type==='move'?getReachable(b,unit,{stopAt:p=>sameCell(p,action)})[0]?.path:null;if(action.type==='move')assert.ok(path);assert.ok(clock(c)+(path?path.length*6:6)<=visitDeadline,'The actual rear step must fit its retained clinical deadline.');b=actBattle(b,action);assert.equal(b.lastError,null,JSON.stringify(action)+': '+b.lastError);orders.push({kind:'battle',action:structuredClone(action)});visits.at(-1).actions.push(structuredClone(action));const old=c,sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;if(clock(c)>clock(old))care.push(clinicCareChange(old,c));check();assert.equal(c.pendingEncounter,null,'A real raid stops the open rear visit.');assert.equal(b.mode,'exploration');};
 const leave=()=>{visits.at(-1).returned=structuredClone(b);const action={type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')};c=dispatchCampaign(c,action);orders.push({kind:'campaign',action:structuredClone(action)});assert.equal(c.lastError,null);b=null;settle();};
 const quoteAndHire=(row,plan)=>{funding.push(plan);assert.equal(plan.available,true,plan.reason);const old=c.resources.treasury;order({type:'recruitCivic',id:row.op.id,term:'week',destination:sector});assert.equal(old-c.resources.treasury,row.quote.total);assert.ok(c.recruited.includes(row.op.id)&&operativeLocation(c,row.op.id)===sector);hires.push({id:row.op.id,quote:row.quote});};
 try{
  settle();check();assert.equal(c.pendingBattle,null);assert.equal(c.sectors[sector].owner,'patriot');assert.ok(local(c,sector).length,'An actual local Córdoba group is required.');assert.equal(hiringArrivalReason(c,sector),null);
  // Start the real local clinic before a single Córdoba movement second.
  const doctors=rosterFor(c).filter(op=>local(c,'tucuman').includes(op.id)&&!originalPatients.includes(op.id)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id);
  if(originalPatients.length){assert.ok(doctors.length,'Start actual local care before remote readiness.');const doctor=doctors[0];linen(doctor.id,local(c,'tucuman').filter(id=>!originalPatients.includes(id)),1);for(const action of saltaEarlyClinicCareOrders(c,doctor,originalPatients))order(action);}
  const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.some(id=>local(c,sector).includes(id)));assert.ok(home);if(c.activeSquadId!==home.id)order({type:'selectSquad',id:home.id});
  let guards=local(c,sector).filter(id=>freeGuard(c,id));assert.ok(guards.length<=6,'Preserve the existing bounded hospital reserve doctrine.');
  // A real qualified leader also supplies the separate physician role. Never
  // assume that a physical local officer has joined or accepts recruitment.
  let leader=rosterFor(c).filter(op=>guards.includes(op.id)&&op.medical>=60&&op.leadership>=50).sort((a,b)=>b.leadership-a.leadership)[0];
  if(!leader){
   const pool=offers(c),row=pool.find(row=>row.op.medical>=60&&row.op.leadership>=50);assert.ok(row,'A real immediate qualified paid rear leader must be available.');const proposed=[row,...pool.filter(other=>other.op.id!==row.op.id).slice(0,Math.max(0,5-guards.length))];
   const supplied=prepareSaltaExistingDepotSupply(c,{rearIds:guards,paidOffers:proposed,deadlineSeconds,resolveEncounter,report});c=supplied.campaign;orders.push(...supplied.receipt.orders);care.push(...supplied.receipt.care);renewals.push(...supplied.receipt.renewals);encounters.push(...supplied.receipt.encounters);if(supplied.receipt.needed)depotSupplies.push(supplied.receipt);if(supplied.receipt.courier?.hire)hires.push(supplied.receipt.courier.hire);check();
   // Travel, care and actual encounters can change both availability and need.
   // Choose and quote the current paid rear again after the real delivery.
   guards=local(c,sector).filter(id=>freeGuard(c,id));leader=rosterFor(c).filter(op=>guards.includes(op.id)&&op.medical>=60&&op.leadership>=50).sort((a,b)=>b.leadership-a.leadership)[0];
   if(!leader){const current=offers(c),next=current.find(row=>row.op.medical>=60&&row.op.leadership>=50);assert.ok(next,'A real immediate qualified paid rear leader must still be available.');const planned=[next,...current.filter(other=>other.op.id!==next.op.id).slice(0,Math.max(0,5-guards.length))];quoteAndHire(next,quoteSaltaRearFunding(c,{rearIds:guards,paidOffers:planned,deadlineSeconds}));leader=next.op;guards=local(c,sector).filter(id=>freeGuard(c,id));}
  }
  order({type:'squad',ids:guards});beginVisit();
  const contacts=encounterDefinitions(c).filter(n=>canRecruitEncounter(n)&&!c.recruited.includes(n.operativeId)&&c.operativeState[n.operativeId]?.alive&&recruitmentStatus(c,n.operativeId,true).available&&!encounterRequirements(c,n,leader)&&contractQuote(c,rosterFor(c).find(op=>op.id===n.operativeId),'day').permanent&&b.npcs.some(actual=>actual.id===n.id&&actual.hp>=15&&!actual.bleeding));
  for(const npc of contacts){if(c.squad.length>=6)break;
   for(let step=0;step<240;step++){const u=b.units.find(u=>u.id===String(leader.id)),n=b.npcs.find(n=>n.id===npc.id);assert.ok(n);const adjacent=sameSurface(u,n)&&Math.abs(u.x-n.x)+Math.abs(u.y-n.y)<=1&&!wallMovementBlocked(b,u,n);if(adjacent&&canSee(b,u,n))break;if(adjacent){const look={type:'look',unitId:u.id,x:n.x,y:n.y};assert.equal(lookPreview(b,u,look).valid,true);act(look);}else{const route=dialogueApproach(getReachable(b,u).filter(p=>!wallMovementBlocked(b,p,n)),n);assert.ok(route?.path.length,'The actual local meeting needs an ordinary accessible path.');act({type:'move',unitId:u.id,...spacePoint(route.path[0])});}assert.ok(step<239,'The actual meeting has the existing bounded approach.');}
   const action={type:'talk',unitId:leader.id,npcId:npc.id,approach:'recruit'},from=clock(c),cash=c.resources.treasury,next=dispatchCampaignSandbox({version:1,history:[],campaign:c,battle:b},action);c=next.campaign;b=next.battle;orders.push({kind:'sandbox',action,from,to:clock(c),cost:cash-c.resources.treasury});assert.equal(next.lastError,null);assert.equal(c.lastConversation.outcome,'recruited');const id=c.lastConversation.operativeId;assert.ok(b.units.some(u=>u.id===String(id)));meetings.push({id,npcId:npc.id});check();assert.equal(c.pendingEncounter,null,'A real raid stops the admitted local meeting.');
  }
  leave();guards=local(c,sector).filter(id=>freeGuard(c,id));
  while(guards.length<6){const pool=offers(c),deficit=6-guards.length,proposed=pool.slice(0,deficit);assert.equal(proposed.length,deficit,'The actual rear deficit needs real available paid service.');const plan=quoteSaltaRearFunding(c,{rearIds:guards,paidOffers:proposed,deadlineSeconds});quoteAndHire(proposed[0],plan);guards=local(c,sector).filter(id=>freeGuard(c,id));}
  order({type:'squad',ids:guards});const physician=rosterFor(c).filter(op=>guards.includes(op.id)&&op.medical>=60).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(physician);linen(physician.id,local(c,sector));
  for(const id of guards){const op=rosterFor(c).find(op=>op.id===id);if(c.operativeState[id].weaponDropped){assert.ok(take(id,item=>WEAPONS[item.weapon]?.capacity>0,1));const item=inventory(id).carried.find(row=>WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0&&row.equip?.some(e=>e.slot==='primary'&&e.valid));assert.ok(item);order({type:'sectorInventory',sector,operativeId:id,direction:'equip',slot:'primary',inventoryKey:item.inventoryKey,expected:item.expected});}
   const held=()=>carriedAmmunition(op,c.operativeState[id]),family=ammoTypeFor(held());if(!family)continue;for(let attempt=0;held().loaded+ammoCount(held(),family)<16;attempt++){assert.ok(attempt<32);const missing=16-held().loaded-ammoCount(held(),family),stored=c.ammunitionStores[sector]?.[family]??0;if(stored){const count=Math.min(missing,stored);const q=ammunitionOrderQuote(c,op,family,count,'take',true);assert.equal(q.available,true,q.reason);order({type:'ammunition',operativeId:id,family,quantity:count,direction:'take'});}else assert.ok(take(id,item=>item.kind==='ammunition'&&item.ammoType===AMMUNITION_FAMILIES[family].type,1),'The current rear needs actual accessible finite cartridges.');}
  }
  beginVisit();const gun=b.artillery.find(g=>g.side==='player'&&(g.loaded||g.ammo>0)),crew=[];
  if(gun){const count=artilleryProfile(b,gun).crew,candidates=b.units.filter(u=>u.side==='player'&&guards.includes(Number(u.id))&&u.id!==String(physician.id)&&!oldPosts.some(row=>row.id===Number(u.id)&&row.position.tacticalLevel>0)).sort((a,d)=>a.marksmanship-d.marksmanship||a.id.localeCompare(d.id));crew.push(...candidates.slice(0,count).map(u=>u.id));assert.equal(crew.length,count,'Preserve the actual complete crew beside the charged battery.');}
  const reserved=oldPosts.map(row=>row.position),staged=[];
  for(const id of guards.filter(id=>!crew.includes(String(id))&&!oldPosts.some(row=>row.id===id&&row.position.tacticalLevel>0))){const actor=()=>b.units.find(u=>u.id===String(id));act({type:'movement',unitId:String(id),movement:'walk'});const destination=getReachable(b,actor()).filter(p=>p.tacticalLevel>0&&surfaceAt(b,p)?.kind==='roof'&&![...reserved,...staged].some(other=>sameCell(other,p))).sort((a,d)=>a.cost-d.cost||a.y-d.y||a.x-d.x)[0];assert.ok(destination,'The actual rear guard needs an available reachable roof.');for(let leg=0;!sameCell(actor(),destination)&&leg<64;leg++){const from=spacePoint(actor());act({type:'move',unitId:String(id),...spacePoint(destination)});assert.notDeepEqual(spacePoint(actor()),from);}assert.ok(sameCell(actor(),destination));act({type:'stance',unitId:String(id),stance:'crouched'});staged.push(spacePoint(actor()));}
  if(gun){
   for(const id of crew){const actor=()=>b.units.find(u=>u.id===id);act({type:'movement',unitId:id,movement:'walk'});
    for(let leg=0;!artilleryContact(b,actor(),b.artillery.find(g=>g.id===gun.id))&&leg<64;leg++){
     const current=b.artillery.find(g=>g.id===gun.id),route=getReachable(b,actor()).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(b,{...actor(),...p},current)).sort((a,d)=>a.cost-d.cost||a.y-d.y||a.x-d.x)[0];assert.ok(route,'The complete paid crew needs a real reachable contact cell at the owned gun.');const from=spacePoint(actor());act({type:'move',unitId:id,...spacePoint(route)});assert.notDeepEqual(spacePoint(actor()),from);
    }
    assert.ok(artilleryContact(b,actor(),b.artillery.find(g=>g.id===gun.id)));
   }
   const actual=b.artillery.find(g=>g.id===gun.id);assert.deepEqual(actual,gun,'Readiness preserves the complete actual saved gun and its finite charges.');
  }
  const prepared=structuredClone(b),roles=coordinatedHospitalBattery(prepared).roles;if(gun){assert.equal(roles.physicianId,String(physician.id));assert.equal(roles.crews.find(row=>row.gunId===gun.id).ids.length,crew.length);}leave();for(const id of guards)order({type:'assignCare',operativeId:id,assignment:'rest'});for(const post of oldPosts)assert.deepEqual(c.operativeState[post.id].residentPosition,post.position);
  if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});for(const q of oldGroups.filter(q=>q.location!==sector&&q.members.length))assert.deepEqual(c.squads.find(row=>row.id===q.id),q,'The original field and clinical groups remain intact.');for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}check();assert.deepEqual(start,before);
  const receipt={needed:true,ids:guards,physicianId:physician.id,crewIds:crew.map(Number),orders,hires,meetings,funding,visits,care,renewals,encounters,transfers,depotSupplies,originalPatients,prepared,startSeconds:clock(start),endSeconds:clock(c),deadlineSeconds};report({event:'saltaCordobaReserveReady',receipt});return {campaign:c,receipt};
 }catch(error){if(error?.campaign)c=error.campaign;if(error?.battle)b=error.battle;if(error?.saltaExistingDepotSupply){const partial=error.saltaExistingDepotSupply;depotSupplies.push(partial);orders.push(...partial.orders);care.push(...partial.care);renewals.push(...partial.renewals);encounters.push(...partial.encounters);if(partial.courier?.hire)hires.push(partial.courier.hire);}if(error&&typeof error==='object'){error.campaign=c;error.saltaCordobaReadiness={orders,hires,meetings,funding,visits,care,renewals,encounters,transfers,depotSupplies,originalPatients,deadlineSeconds,...(b?{battle:b}:{})};}recordRouteStrategicEvidence({helper:'prepareSaltaCordobaReserveReadiness',stage:'preparation-failure',campaign:c,inputCapture,error,context:{orders,hires,meetings,funding,visits,care,renewals,encounters,transfers,depotSupplies,originalPatients,deadlineSeconds,...(b?{battle:b}:{})}});throw error;}
}
