import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {isContractOperative} from '../game/content-character-ids.js';
import {careAssignmentReason,careAssignmentIssue} from '../game/medical-care.js';
import {hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {operativeInTransit,operativeLocation,canReassignOperative} from '../game/squads.js';
import {collectRouteItems,discoverRouteCache} from './finite-route-equipment.mjs';
import {contractQuote,contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {doctorRate} from '../game/medical-care.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {stabilizeOpeningRearSurvivors} from './opening-rear-medical-supply.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const servingAt=(c,sector)=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector;});

// The shared finite urgent-care driver can advance twelve real hours. Retain
// the existing service before that care starts, rather than rehire an expiry.
export function stabilizeSaltaClinicSurvivors(start,sector,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),renewals=[],actions=[];
 const local=servingAt(campaign,sector),urgent=local.some(id=>campaign.operativeState[id].bleeding>0||campaign.operativeState[id].hp<15);
 if(urgent)for(const id of campaign.recruited){
  const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;
  let expiry=contractExpiresSeconds(campaign.contracts[id]);assert.ok(expiry===null||expiry>clock(campaign),'Retain actual service before urgent clinic care.');
  while(expiry!==null&&expiry<=clock(campaign)+12*3600){
   const quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),contract=campaign.contracts[id],cash=campaign.resources.treasury;
   assert.equal(quote.available,true,quote.reason);
   const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
   campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);
   assert.equal(campaign.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(campaign.contracts[id]),expiry+86400);
   renewals.push({id,price:quote.price,expiryBefore:expiry,expiryAfter:expiry+86400});actions.push(action);expiry+=86400;
  }
 }
 const care=stabilizeOpeningRearSurvivors(campaign,sector);campaign=care.campaign;
 const receipt={...care.receipt,renewals,actions:[...actions,...care.receipt.actions]};
 report(receipt);assert.deepEqual(start,before);return {campaign,receipt};
}

// The earned clinic has exhausted its local stock. A real Córdoba physician
// carries known finite dressings; fresh paid guards keep their normal supplies.
export function prepareSaltaClinicSupply(start,{report=()=>{},resolveEncounter,deadlineSeconds=Infinity}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),previous=campaign.activeSquadId,sector='tucuman',local=servingAt(campaign,sector);
 const actions=[],renewals=[],hires=[],events=[],encounters=[],localSupplies=[],earlyCare=[],expectedFates=new Map(Object.entries(before.operativeState).map(([id,r])=>[id,{alive:r.alive,captured:r.captured}]));
 let preparationBattle=null;
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareSaltaClinicSupply',stage:'preparation-input',campaign:start,context:{deadlineSeconds:Number.isFinite(deadlineSeconds)?deadlineSeconds:null}});
 try{
 const patients=local.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),roster=rosterFor(campaign);
 const physician=roster.filter(op=>local.includes(op.id)&&op.medical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical)[0];
 if(patients.length)assert.ok(physician,'An actual local physician must define the clinic treatment budget.');
 const carried=local.reduce((n,id)=>n+campaign.operativeState[id].medkits,0);let needed=patients.reduce((n,id)=>n+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/doctorRate(physician,campaign)),0);
 if(!patients.length||carried>=needed)return {campaign,receipt:{event:'saltaClinicSupply',needed:false,patients,carried,minimumTreatmentDressings:needed,actions:[]}};
 assert.ok(physician,'An actual local physician must define the clinic treatment budget.');assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 assert.ok(local.every(id=>campaign.operativeState[id].hp>=15&&!campaign.operativeState[id].bleeding),'Give actual urgent care before the medical courier leaves.');
 const checkBudget=()=>assert.ok(clock(campaign)<=deadlineSeconds,'The actual clinic preparation must remain within its shared 72-hour allowance.');
 const settle=()=>{
  if(!campaign.pendingEncounter)return;
  assert.equal(typeof resolveEncounter,'function','Settle the actual courier interruption before clinic preparation.');
  const pending=structuredClone(campaign.pendingEncounter),at=clock(campaign),selected=campaign.activeSquadId;campaign=resolveEncounter(campaign);
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.ok(clock(campaign)>=at);encounters.push(pending);checkBudget();
  for(const [id,r]of Object.entries(before.operativeState)){if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}expectedFates.set(id,{alive:campaign.operativeState[id].alive,captured:campaign.operativeState[id].captured});}
  if(campaign.activeSquadId!==selected)order({type:'selectSquad',id:selected});
 };
 const order=action=>{settle();checkBudget();if(action.type==='wait')assert.ok(clock(campaign)+action.hours*3600<=deadlineSeconds,'The actual clinic preparation has no paid hour left in its shared 72-hour allowance.');const old=campaign,cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);if(clock(campaign)>clock(old))earlyCare.push(clinicCareChange(old,campaign));const row={action,hour:campaign.hour,second:campaign.secondOfHour??0,treasuryChange:campaign.resources.treasury-cash};actions.push(row);report({event:'saltaClinicSupplyOrder',...row});checkBudget();settle();};
 const retain=hours=>{
  for(const id of campaign.recruited){const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;let expiry=contractExpiresSeconds(campaign.contracts[id]);assert.ok(campaign.contracts[id]&&(expiry===null||expiry>clock(campaign)),'The actual clinic duty must still be serving.');while(expiry!==null&&expiry<=clock(campaign)+hours*3600){const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);renewals.push({id,quote});expiry=contractExpiresSeconds(campaign.contracts[id]);}}
 };
 const candidates=rosterFor(campaign).filter(op=>op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured&&operativeLocation(campaign,op.id)==='cordoba'&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp&&op.medical>=80&&civicStatus(campaign,op.id).available).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||b.op.medical-a.op.medical||a.op.id-b.op.id);
 const servingCourier=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id],expiry=contractExpiresSeconds(campaign.contracts[op.id]);return campaign.recruited.includes(op.id)&&canReassignOperative(campaign,op.id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,op.id)&&operativeLocation(campaign,op.id)==='cordoba'&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10&&op.medical>=80&&campaign.contracts[op.id]&&(expiry===null||expiry>clock(campaign));}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 const courier=servingCourier?{op:servingCourier,quote:null}:candidates[0];assert.ok(courier,'An actual healthy paid Córdoba physician must carry the known linen.');const doctor=courier.op.id,courierKits=campaign.operativeState[doctor].medkits;
 if(!servingCourier){order({type:'recruitCivic',id:doctor,term:'day',destination:'cordoba'});assert.equal(campaign.operativeState[doctor].medkits,courierKits,'Returning service does not reissue dressings.');hires.push({id:doctor,quote:courier.quote,kits:courierKits});}
 assert.equal(operativeLocation(campaign,doctor),'cordoba');
 order({type:'createSquad',sector:'cordoba',name:'Vendas de Córdoba',ids:[doctor]});
 if(!campaign.routes.posta)order({type:'transport',mode:'posta'});
 // Local treatment starts before discovery or travel spends any real time.
 // Prefer a stable colleague, never the injured physician treating themself.
 const earlyDoctor=rosterFor(campaign).filter(op=>local.includes(op.id)&&!patients.includes(op.id)&&(!careAssignmentIssue(campaign,op,'doctor')||careAssignmentIssue(campaign,op,'doctor').code==='no_medkits')).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 const adoptLocal=supplied=>{
  campaign=supplied.campaign;localSupplies.push((({campaign,...receipt})=>receipt)(supplied));actions.push(...supplied.actions);hires.push(...supplied.hires);renewals.push(...supplied.renewals);earlyCare.push(...supplied.care);encounters.push(...supplied.encounters);
  if(supplied.encounters.length)for(const [id,r]of Object.entries(before.operativeState)){if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}expectedFates.set(id,{alive:campaign.operativeState[id].alive,captured:campaign.operativeState[id].captured});}
  checkBudget();settle();return supplied;
 };
 const supplyEarly=count=>adoptLocal(supplySaltaClinicDoctors(campaign,[earlyDoctor.id],{minimumDressings:count,allowPartial:true,deadlineSeconds,resolveEncounter,report}));
 if(earlyDoctor){
  supplyEarly(1);
  if(campaign.operativeState[earlyDoctor.id].medkits){
   for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
   assert.equal(careAssignmentReason(campaign,earlyDoctor,'doctor'),'');order({type:'assignCare',operativeId:earlyDoctor.id,assignment:'doctor'});
   const plan=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');
   if(plan.valid)supplyEarly(Math.max(1,Math.min(needed,plan.hours)));
  }
 }
 const beforeDiscovery=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');assert.equal(beforeDiscovery.valid,true,beforeDiscovery.reason);retain(beforeDiscovery.hours+1);
 // Discovery is an actual local visit before any source is counted. An empty
 // discovered cache does not reissue a returning physician's spent pack.
 {const old=campaign;campaign=discoverRouteCache(campaign,doctor);if(clock(campaign)>clock(old))earlyCare.push(clinicCareChange(old,campaign));}checkBudget();settle();
 const inventory=()=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),doctor),stock=inventory().entries,available=stock.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
 const currentStock=servingAt(campaign,sector).reduce((n,id)=>n+campaign.operativeState[id].medkits,0),request=Math.max(0,needed+1-currentStock);const found=available&&request?collectRouteItems(campaign,doctor,{item:'medkits'},Math.min(available,request)):{campaign,collected:0};{const old=campaign;campaign=found.campaign;if(clock(campaign)>clock(old))earlyCare.push(clinicCareChange(old,campaign));}settle();
 const after=inventory().entries,debits=stock.flatMap(row=>{const count=row.count-(after.find(next=>next.key===row.key)?.count??0);return count>0?[{key:row.key,expected:row.expected,before:row.count,after:row.count-count,count}]:[];});assert.equal(debits.reduce((n,row)=>n+row.count,0),found.collected);
 if(!campaign.routes.posta)order({type:'transport',mode:'posta'});const journey=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');assert.equal(journey.valid,true,journey.reason);assert.equal(journey.action.type,'travel');assert.ok(clock(campaign)+journey.hours*3600<=deadlineSeconds,'The actual clinic supply journey exceeds its shared 72-hour allowance.');
 retain(journey.hours+1);
 const departure=clock(campaign);order({type:'travel',sector,mode:'posta'});
 for(let step=0;operativeLocation(campaign,doctor)!==sector&&step<72;step++){
  assert.ok(campaign.squads.find(q=>q.members.includes(doctor))?.journey,'The actual courier needs its remaining journey.');order({type:'wait',hours:1});
 }
 assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.equal(operativeLocation(campaign,doctor),sector);
 if(!encounters.length)assert.equal(clock(campaign)-departure,journey.hours*3600);else assert.ok(clock(campaign)-departure>=journey.hours*3600);
 order({type:'selectSquad',id:previous});
 const total=()=>servingAt(campaign,sector).reduce((n,id)=>n+campaign.operativeState[id].medkits,0);
 for(const id of servingAt(campaign,sector))if(campaign.operativeState[id].hp<campaign.operativeState[id].maxHp&&!patients.includes(id))patients.push(id);
 needed=patients.filter(id=>campaign.operativeState[id].alive&&!campaign.operativeState[id].captured).reduce((n,id)=>n+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/doctorRate(physician,campaign)),0);
 while(total()<needed+1){
  const guard=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.asleep&&r.energy>10&&r.medkits>0&&civicStatus(campaign,op.id).available;}).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id)[0];assert.ok(guard,'The finite clinic deficit needs a real available paid relief guard.');
  const kits=campaign.operativeState[guard.op.id].medkits;order({type:'recruitCivic',id:guard.op.id,term:'day',destination:sector});assert.equal(operativeLocation(campaign,guard.op.id),sector,'Wait for an actual delayed hire before relying on its equipment.');assert.equal(campaign.operativeState[guard.op.id].medkits,kits);hires.push({id:guard.op.id,quote:guard.quote,kits});
 }
 const calm=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return local.includes(op.id)&&op.medical>=60&&r.alive&&r.hp>=15&&!r.bleeding&&!r.asleep&&(r.morale??0)>=40;}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(calm,'The clinic needs an actual stable physician before the incoming raid.');
 if(campaign.operativeState[calm.id].medkits<2){
  adoptLocal(supplySaltaClinicDoctors(campaign,[calm.id],{minimumDressings:2,reserveDressings:2,deadlineSeconds,resolveEncounter,report}));
 }
 assert.ok(campaign.operativeState[calm.id].medkits>=2,'The calm clinic physician retains the existing two finite defensive dressings.');
 campaign=recoverRoutePrimary(campaign,doctor,{required:false,report:event=>{events.push(event);report(event);}});
 const guard=hires.filter(row=>row.id!==doctor).map(row=>rosterFor(campaign).find(op=>op.id===row.id)).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0]??rosterFor(campaign).find(op=>local.includes(op.id)&&op.id!==calm.id&&!patients.includes(op.id)&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp);assert.ok(guard,'The clinic party needs an actual healthy serving guard.');
 const ids=[...new Set([calm.id,...patients,guard.id,doctor])];assert.ok(ids.length<=6,'The real covered clinic party must fit one ordinary squad.');
 const occupied=servingAt(campaign,sector).filter(id=>!ids.includes(id)).map(id=>campaign.operativeState[id].residentPosition).filter(Boolean),posts=occupied.filter(point=>(point.tacticalLevel??0)>0),positions=[];
 order({type:'createSquad',sector,name:'Enfermería cubierta',ids});for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});order({type:'visitSector'});let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[sector]);preparationBattle=battle;
 const act=action=>{battle=actBattle(battle,action);preparationBattle=battle;assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);actions.push({action,tactical:true});};
 for(const id of ids){const unitId=String(id),current=battle.units.find(unit=>unit.id===unitId);if((current.tacticalLevel??0)>0){if(current.stance!=='crouched')act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});continue;}const roofs=getReachable(battle,battle.units.find(unit=>unit.id===unitId)).filter(point=>(point.tacticalLevel??0)>0&&!occupied.some(other=>sameCell(other,point))&&!positions.some(other=>sameCell(other,point))).map(point=>({...point,neighbors:[...posts,...positions].filter(other=>sameSurface(other,point)&&Math.hypot(other.x-point.x,other.y-point.y)<=1.5).length,distance:[...posts,...positions].reduce((n,other)=>n+Math.hypot(other.x-point.x,other.y-point.y),0)})).sort((a,b)=>b.neighbors-a.neighbors||a.distance-b.distance||a.cost-b.cost||a.y-b.y||a.x-b.x);const destination=roofs[0];assert.ok(destination&&destination.neighbors>0,'The physician and patients need real vacant reachable cover beside the guards.');act({type:'movement',unitId,movement:'walk'});for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++)act({type:'move',unitId,...spacePoint(destination)});assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});}
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
 // Newly hired supply carriers outside the clinical squad need their own
 // actual group and visit before roof movement can address their bodies.
 // Stage only those new local hires; preserve other residents' earned posts.
 const reliefIds=hires.map(row=>row.id).filter(id=>!ids.includes(id)&&servingAt(campaign,sector).includes(id)&&(campaign.operativeState[id].residentPosition?.tacticalLevel??0)===0);
 if(reliefIds.length){
  const cover=stageOpeningRearCover(campaign,{sector,exclude:servingAt(campaign,sector).filter(id=>!reliefIds.includes(id)),report});campaign=cover.campaign;events.push(cover.receipt);checkBudget();settle();
 }
 for(const id of campaign.squads.filter(q=>q.location===sector&&!q.journey&&q.members.length).map(q=>q.id)){order({type:'selectSquad',id});for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});}
 order({type:'selectSquad',id:previous});assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(campaign.operativeState[id].alive,expectedFates.get(id).alive);assert.equal(campaign.operativeState[id].captured,expectedFates.get(id).captured);if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}}
 for(const id of patients)assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured,'An actual original clinic patient cannot be removed by the supply journey.');
 checkBudget();assert.deepEqual(start,before);const receipt={event:'saltaClinicSupply',needed:true,patients,carried,minimumTreatmentDressings:needed,collectedDressings:found.collected,carriedAfter:total(),doctor,courierAlreadyServing:Boolean(servingCourier),calmDoctor:calm.id,hires,renewals,debits,journey,positions,events,encounters,localSupplies,earlyCare,actions,start:[start.hour,start.secondOfHour??0],finish:[campaign.hour,campaign.secondOfHour??0],cashBefore:start.resources.treasury,cashAfter:campaign.resources.treasury};report(receipt);return {campaign:decodeSave(encodeSave(campaign)).campaign,receipt};
 }catch(error){
  if(error?.campaign)campaign=error.campaign;
  recordRouteStrategicEvidence({helper:'prepareSaltaClinicSupply',stage:'preparation-failure',campaign:before,returnedCampaign:campaign,inputCapture,error,context:{partialStateScope:'Last adopted Native campaign and current retained preparation battle; nested helper work that failed before returning is not reconstructed.',actions,renewals,hires,encounters,localSupplies,earlyCare,localSupplyFailure:error?.clinicLocalSupply??null,preparationBattle,deadlineSeconds:Number.isFinite(deadlineSeconds)?deadlineSeconds:null}});
  if(error&&typeof error==='object')error.campaign=campaign;throw error;
 }
}

// Actual elapsed campaign orders can treat other local people. This records
// the returned Native changes; it never predicts or applies a care stroke.
const clinicCareChange=(before,after)=>({from:clock(before),to:clock(after),
 doctors:servingAt(before,'tucuman').filter(id=>before.operativeState[id].assignment==='doctor'),
 patients:servingAt(before,'tucuman').filter(id=>before.operativeState[id].assignment==='patient').map(id=>({id,before:before.operativeState[id].hp,after:after.operativeState[id].hp,alive:after.operativeState[id].alive})),
 usedDressings:servingAt(before,'tucuman').filter(id=>before.operativeState[id].assignment==='doctor').reduce((n,id)=>n+Math.max(0,before.operativeState[id].medkits-after.operativeState[id].medkits),0)});

// Repeatable local resupply. Known admitted sources and actual donations come
// first. A remaining deficit can pay for a finite supplied arrival here; it
// never repeats the separate Córdoba courier or creates another care budget.
export function supplySaltaClinicDoctors(start,doctors,{minimumDressings=1,reserveDressings=0,allowPartial=false,deadlineSeconds=Infinity,resolveEncounter,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(minimumDressings)&&minimumDressings>0);assert.ok(Number.isSafeInteger(reserveDressings)&&reserveDressings>=0);
 assert.equal(new Set(doctors).size,doctors.length);
 let campaign=start,battle=null;const before=structuredClone(start),previous=start.activeSquadId,sector='tucuman',actions=[],receipts=[],hires=[],renewals=[],care=[],encounters=[];
 let gatheredDressings=0,donatedDressings=0;
 const local=()=>servingAt(campaign,sector),inventory=(id,site=sector)=>sectorInventoryModel(campaign,site,rosterFor(campaign),id);
 const check=()=>{assert.equal(campaign.defeated,false,'The actual clinic preparation stops on a Native defeat.');assert.ok(clock(campaign)<=deadlineSeconds,'The actual clinic preparation must remain within its shared 72-hour allowance.');};
 const settle=()=>{
  assert.equal(campaign.pendingBattle,null,'Finish the actual open clinic visit before resupply.');
  if(!campaign.pendingEncounter)return;
  assert.equal(typeof resolveEncounter,'function','Settle the actual local supply interruption before care continues.');
  const pending=structuredClone(campaign.pendingEncounter);campaign=resolveEncounter(campaign,{deadlineSeconds});encounters.push(pending);
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);check();
 };
 const order=action=>{
  settle();check();if(action.type==='wait')assert.ok(clock(campaign)+action.hours*3600<=deadlineSeconds,'The actual clinic preparation has no paid hour left in its shared 72-hour allowance.');
  const old=campaign,cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);
  actions.push({action:structuredClone(action),hour:campaign.hour,second:campaign.secondOfHour??0,treasuryChange:campaign.resources.treasury-cash});
  assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);
  if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));check();if(action.type!=='visitSector')settle();
 };
 const retain=until=>{
  for(const id of campaign.recruited){const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;
   let expiry=contractExpiresSeconds(campaign.contracts[id]);assert.ok(campaign.contracts[id]&&(expiry===null||expiry>clock(campaign)),'The clinic needs actual current paid service.');
   for(let n=0;expiry!==null&&expiry<=until;n++){
    assert.ok(n<8,'A local clinic arrival has a bounded paid term.');const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});renewals.push({id,quote});expiry=contractExpiresSeconds(campaign.contracts[id]);
   }
  }
 };
 const cover=id=>{
  if((campaign.operativeState[id].residentPosition?.tacticalLevel??0)>0)return;
  retain(clock(campaign)+3600);assert.ok(clock(campaign)+3600<=deadlineSeconds,'The actual relief visit needs its bounded retained hour inside the clinic allowance.');
  const until=clock(campaign)+3600,posts=local().filter(other=>other!==id&&campaign.operativeState[other].residentPosition).map(other=>({id:other,position:structuredClone(campaign.operativeState[other].residentPosition)}));
  order({type:'createSquad',sector,name:'Vendas de la enfermería',ids:[id]});order({type:'assignCare',operativeId:id,assignment:'active'});order({type:'visitSector'});
  battle=enterSector(campaign.pendingBattle,campaign.sectorStates[sector]);const initial=structuredClone(battle),unitId=String(id),actor=()=>battle.units.find(u=>u.id===unitId),steps=[];
  const roofs=posts.filter(row=>row.position.tacticalLevel>0),destination=getReachable(battle,actor()).filter(point=>point.tacticalLevel>0&&!posts.some(row=>sameCell(row.position,point))).map(point=>({...point,neighbors:roofs.filter(row=>sameSurface(row.position,point)&&Math.hypot(row.position.x-point.x,row.position.y-point.y)<=1.5).length})).sort((a,b)=>b.neighbors-a.neighbors||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  assert.ok(destination&&(!roofs.length||destination.neighbors>0),'The new supplied relief needs actual reachable roof cover beside the old posts.');
  const act=action=>{
   const path=action.type==='move'?getReachable(battle,actor(),{stopAt:point=>sameCell(point,action)})[0]?.path:null;if(action.type==='move')assert.ok(path);
   assert.ok(clock(campaign)+(path?path.length*6:6)<=until&&clock(campaign)+(path?path.length*6:6)<=deadlineSeconds,'The actual relief step must fit its retained clinic time.');
   battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);steps.push(structuredClone(action));actions.push({action:structuredClone(action),tactical:true});
   const old=campaign,synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;if(clock(campaign)>clock(old))care.push(clinicCareChange(old,campaign));check();assert.equal(campaign.pendingEncounter,null,'A real raid must stop the actual relief visit.');
   assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.equal(battle.mode,'exploration');
  };
  act({type:'movement',unitId,movement:'walk'});
  for(let step=0;!sameCell(actor(),destination)&&step<64;step++){const from=spacePoint(actor());act({type:'move',unitId,...spacePoint(destination)});assert.notDeepEqual(spacePoint(actor()),from);}
  assert.ok(sameCell(actor(),destination));act({type:'stance',unitId,stance:'crouched'});
  const returned=structuredClone(battle),action={type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);actions.push({action:structuredClone(action),hour:campaign.hour,second:campaign.secondOfHour??0,treasuryChange:0});battle=null;
  for(const post of posts)assert.deepEqual(campaign.operativeState[post.id].residentPosition,post.position,'The supplied arrival preserves every old resident post.');
  receipts.push({kind:'new-relief-cover',id,initial,steps,returned});settle();
  if(campaign.activeSquadId!==previous)order({type:'selectSquad',id:previous});
 };
 const finish=reason=>{assert.deepEqual(start,before);return {campaign,doctors:[...doctors],minimumDressings,reserveDressings,gatheredDressings,donatedDressings,actions,receipts,hires,renewals,care,encounters,supplied:!reason,reason};};
 try{
  settle();
  for(const id of doctors){
   assert.ok(local().includes(id),'Every selected doctor must actually serve at the local clinic.');
   const issue=careAssignmentIssue(campaign,rosterFor(campaign).find(op=>op.id===id),'doctor');assert.ok(!issue||issue.code==='no_medkits',issue?.reason);
   const target=()=>Math.max(reserveDressings,Math.min(minimumDressings,local().filter(other=>other!==id&&(campaign.operativeState[other].bleeding||campaign.operativeState[other].hp<campaign.operativeState[other].maxHp)).reduce((n,other)=>n+Math.max(Number(campaign.operativeState[other].bleeding>0),Math.ceil((campaign.operativeState[other].maxHp-campaign.operativeState[other].hp)/doctorRate(rosterFor(campaign).find(op=>op.id===id),campaign))),0)));
   while(campaign.operativeState[id].medkits<target()){
    assert.ok(local().includes(id)&&campaign.operativeState[id].hp>=15&&!campaign.operativeState[id].bleeding&&!campaign.operativeState[id].asleep,'Re-select actual doctors after a local supply interruption.');
    const model=inventory(id);assert.equal(model.operativeId,id);assert.equal(model.reason,null,model.reason);
    applyItemQuantity(model.personal,{item:'medkits',count:target()-campaign.operativeState[id].medkits,weight:SUPPLY_ITEMS.medkits.weight});
    let source=sectorInventorySites(campaign,sector).map(site=>{const current=inventory(id,site.id);return {site:site.id,row:current.operativeId===id&&!current.reason&&current.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>0)};}).find(row=>row.row);
    if(!source){
     const donor=local().find(other=>!doctors.includes(other)&&campaign.operativeState[other].medkits>0&&inventory(other).operativeId===other&&!inventory(other).reason);
     if(donor!==undefined){
      const count=Math.min(campaign.operativeState[donor].medkits,target()-campaign.operativeState[id].medkits),known=new Set(inventory(id).entries.map(row=>row.key));
      order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});donatedDressings+=count;
      const dropped=inventory(id).entries.find(row=>!known.has(row.key)&&JSON.parse(row.expected).item==='medkits');assert.ok(dropped,'The actual donation must expose its own finite source.');
      const row=inventory(id).entries.find(row=>row.key===dropped.key&&row.reachable);assert.ok(row,'The doctor needs actual access to the donated dressing.');source={site:sector,row};receipts.push({doctor:id,kind:'donation',donor,count,sourceKey:row.key});
     }else{
      const queued=campaign.hiringArrivals?.find(a=>a.destination===sector&&campaign.operativeState[a.operativeId]?.medkits>0),roster=rosterFor(campaign);
      const fit=op=>{const r=campaign.operativeState[op.id];return isContractOperative(campaign,op)&&!campaign.recruited.includes(op.id)&&!campaign.hiringArrivals?.some(a=>a.operativeId===op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10&&r.medkits>0&&civicStatus(campaign,op.id).available;};
      const chosen=roster.filter(fit).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id)[0];
      if(!queued&&!chosen){if(allowPartial)return finish('finite-clinic-supply-shortage');assert.fail('The finite clinic deficit needs a real available paid relief guard.');}
      const relief=queued?.operativeId??chosen.op.id;
      if(!queued){const kits=campaign.operativeState[relief].medkits;order({type:'recruitCivic',id:relief,term:'day',destination:sector});hires.push({id:relief,quote:chosen.quote,kits});assert.equal(campaign.operativeState[relief].medkits,kits);}
      for(let attempt=0;!campaign.recruited.includes(relief);attempt++){
       const arrival=campaign.hiringArrivals?.find(a=>a.operativeId===relief);assert.ok(arrival&&arrival.destination===sector&&attempt<240,'The paid supplied relief needs its actual bounded arrival.');
       assert.ok(hireArrivalDueSeconds(arrival)-clock(campaign)<=168*3600);retain(clock(campaign)+3600);order({type:'wait',hours:1});
      }
      assert.ok(local().includes(relief),'Use the new finite pack only after its actual local arrival.');cover(relief);continue;
     }
    }
    const count=Math.min(source.row.count,target()-campaign.operativeState[id].medkits),stock=campaign.operativeState[id].medkits;
    order({type:'sectorInventory',sector:source.site,operativeId:id,direction:'take',sourceKey:source.row.key,expected:source.row.expected,count});assert.equal(campaign.operativeState[id].medkits,stock+count);gatheredDressings+=count;
   }
  }
  return finish(null);
 }catch(error){if(error?.campaign)campaign=error.campaign;if(error&&typeof error==='object'){error.campaign=campaign;error.clinicLocalSupply={actions,receipts,hires,renewals,care,encounters,...(battle?{battle}:{})};}throw error;}
}

// One real clinical phase. The caller carries the same remaining allowance
// across the earlier recovery and the later daylight preparation.
export function recoverSaltaClinic(start,{deadlineSeconds=clock(start)+72*3600,daylight=false,resolveEncounter,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>clock(start));
 let campaign=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),began=clock(campaign),patients=new Set(),doctors=new Set(),ticks=[],orders=[],localSupplies=[],earlyCare=[];
 const inputCapture=recordRouteStrategicEvidence({helper:'recoverSaltaClinic',stage:'preparation-input',campaign:start,context:{deadlineSeconds,daylight}});
 try{
 const check=()=>assert.ok(clock(campaign)<=deadlineSeconds,'The actual clinic preparation must remain within its shared 72-hour allowance.');
 const settle=()=>{
  if(!campaign.pendingEncounter)return;
  assert.equal(typeof resolveEncounter,'function','The actual clinic raid must be won before care continues.');
  campaign=resolveEncounter(campaign,{deadlineSeconds});assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);check();
 };
 const order=action=>{settle();check();if(action.type==='wait')assert.ok(clock(campaign)+action.hours*3600<=deadlineSeconds,'The actual clinic preparation has no paid hour left in its shared 72-hour allowance.');const at=clock(campaign),cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);orders.push({action:structuredClone(action),from:at,to:clock(campaign),treasuryBefore:cash,treasuryAfter:campaign.resources.treasury});check();};
 const local=()=>servingAt(campaign,'tucuman'),wounded=()=>local().filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp||campaign.operativeState[id].bleeding);
 for(const id of wounded())patients.add(id);
 settle();const supply=prepareSaltaClinicSupply(campaign,{report,deadlineSeconds,resolveEncounter:state=>{campaign=state;settle();return campaign;}});campaign=supply.campaign;earlyCare.push(...(supply.receipt.earlyCare??[]));for(const row of earlyCare)for(const id of row.doctors)doctors.add(id);check();
 const earliestDeparture=campaign.hour+(24-campaign.hour%24)%24;let departure=null,zeroTime=0,gatheredDressings=0,donatedDressings=0;
 for(let hour=0;hour<72;hour++){
  settle();check();const injured=wounded();for(const id of injured)patients.add(id);
  const arrivalHour=(campaign.hour+12)%24;
  if(!injured.length&&(!daylight||campaign.hour>=earliestDeparture&&arrivalHour>=6&&arrivalHour<18)){departure=campaign.hour;break;}
  assert.ok(clock(campaign)+3600<=deadlineSeconds,'The actual clinic preparation has no paid hour left in its shared 72-hour allowance.');
  let hourlyDoctors=[];
  if(injured.length){
   const eligible=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return local().includes(op.id)&&op.medical>=20&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}).sort((a,b)=>b.medical-a.medical||a.id-b.id);
   hourlyDoctors=eligible.slice(0,2).map(op=>op.id);
   if(injured.every(id=>hourlyDoctors.includes(id)))hourlyDoctors.splice(hourlyDoctors.indexOf(injured.at(-1)),1);
   assert.ok(hourlyDoctors.length,'An actual stable colleague must restore the wounded doctor.');
   const supplied=supplySaltaClinicDoctors(campaign,hourlyDoctors,{deadlineSeconds,resolveEncounter:state=>{campaign=state;settle();return campaign;},report});campaign=supplied.campaign;localSupplies.push((({campaign,...receipt})=>receipt)(supplied));earlyCare.push(...supplied.care);for(const row of supplied.care)for(const id of row.doctors)doctors.add(id);gatheredDressings+=supplied.gatheredDressings;donatedDressings+=supplied.donatedDressings;check();settle();if(supplied.encounters.length||supplied.care.length)continue;
   for(const id of hourlyDoctors){assert.ok(campaign.operativeState[id].medkits,'Continued care consumes finite reachable dressings.');doctors.add(id);}
   for(const operativeId of local())order({type:'assignCare',operativeId,assignment:hourlyDoctors.includes(operativeId)?'doctor':injured.includes(operativeId)?'patient':'rest'});
  }else for(const operativeId of local())order({type:'assignCare',operativeId,assignment:'rest'});
  for(const id of campaign.recruited.filter(id=>campaign.operativeState[id].alive&&!campaign.operativeState[id].captured)){
   let expiry=contractExpiresSeconds(campaign.contracts[id]);
   assert.ok(campaign.contracts[id]&&(expiry===null||expiry>clock(campaign)),'The clinic needs actual current paid service.');
   while(expiry!==null&&expiry<=clock(campaign)+2*3600){
    const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(campaign.contracts[id]),expiry+86400);expiry=contractExpiresSeconds(campaign.contracts[id]);
   }
  }
  const at=clock(campaign),kits=hourlyDoctors.reduce((n,id)=>n+campaign.operativeState[id].medkits,0),old=injured.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}));
  order({type:'wait',hours:1});const spent=kits-hourlyDoctors.reduce((n,id)=>n+campaign.operativeState[id].medkits,0);assert.ok(spent>=0&&spent<=hourlyDoctors.length);
  zeroTime=clock(campaign)===at?zeroTime+1:0;assert.ok(zeroTime<3,'Clinic care stopped after three consecutive zero-time notices.');
  ticks.push({from:at,to:clock(campaign),doctors:[...hourlyDoctors],before:old,after:injured.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding})),usedDressings:spent});settle();
 }
 assert.ok(Number.isInteger(departure),'Supplied paid care completes within its shared 72-hour allowance.');
 for(const id of patients){assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured,'Actual clinic patients remain living and serving.');assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);assert.equal(campaign.operativeState[id].bleeding,0);}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 check();assert.deepEqual(start,before);
 const receipt={patients:[...patients],doctors:[...doctors],ticks,orders,supply:supply.receipt,localSupplies,earlyCare,gatheredDressings,donatedDressings,usedDressings:ticks.reduce((n,t)=>n+t.usedDressings,0)+earlyCare.reduce((n,t)=>n+t.usedDressings,0),startSeconds:began,endSeconds:clock(campaign),elapsedSeconds:clock(campaign)-began,deadlineSeconds,departure};
 report({event:'saltaClinicRecovery',receipt});return {campaign:decodeSave(encodeSave(campaign)).campaign,receipt,departure};
 }catch(error){
  if(error?.campaign)campaign=error.campaign;
  recordRouteStrategicEvidence({helper:'recoverSaltaClinic',stage:'preparation-failure',campaign:before,returnedCampaign:campaign,inputCapture,error,context:{patients:[...patients],doctors:[...doctors],ticks,orders,earlyCare,localSupplies,localSupplyFailure:error?.clinicLocalSupply??null,deadlineSeconds}});
  if(error&&typeof error==='object')error.campaign=campaign;throw error;
 }
}
