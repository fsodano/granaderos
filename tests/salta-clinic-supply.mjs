import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
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
 const actions=[],renewals=[],hires=[],events=[],encounters=[],expectedFates=new Map(Object.entries(before.operativeState).map(([id,r])=>[id,{alive:r.alive,captured:r.captured}]));
 let preparationBattle=null;
 const inputCapture=recordRouteStrategicEvidence({helper:'prepareSaltaClinicSupply',stage:'preparation-input',campaign:start,context:{deadlineSeconds:Number.isFinite(deadlineSeconds)?deadlineSeconds:null}});
 try{
 const patients=local.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),roster=rosterFor(campaign);
 const physician=roster.filter(op=>local.includes(op.id)&&op.medical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical)[0];
 if(patients.length)assert.ok(physician,'An actual local physician must define the clinic treatment budget.');
 const carried=local.reduce((n,id)=>n+campaign.operativeState[id].medkits,0),needed=patients.reduce((n,id)=>n+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/doctorRate(physician,campaign)),0);
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
 const order=action=>{settle();checkBudget();if(action.type==='wait')assert.ok(clock(campaign)+action.hours*3600<=deadlineSeconds,'The actual clinic preparation has no paid hour left in its shared 72-hour allowance.');const cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);const row={action,hour:campaign.hour,second:campaign.secondOfHour??0,treasuryChange:campaign.resources.treasury-cash};actions.push(row);report({event:'saltaClinicSupplyOrder',...row});checkBudget();settle();};
 const candidates=rosterFor(campaign).filter(op=>op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured&&operativeLocation(campaign,op.id)==='cordoba'&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp&&op.medical>=80&&civicStatus(campaign,op.id).available).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||b.op.medical-a.op.medical||a.op.id-b.op.id);
 const servingCourier=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id],expiry=contractExpiresSeconds(campaign.contracts[op.id]);return campaign.recruited.includes(op.id)&&canReassignOperative(campaign,op.id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,op.id)&&operativeLocation(campaign,op.id)==='cordoba'&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10&&op.medical>=80&&campaign.contracts[op.id]&&(expiry===null||expiry>clock(campaign));}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 const courier=servingCourier?{op:servingCourier,quote:null}:candidates[0];assert.ok(courier,'An actual healthy paid Córdoba physician must carry the known linen.');const doctor=courier.op.id,courierKits=campaign.operativeState[doctor].medkits;
 if(!servingCourier){order({type:'recruitCivic',id:doctor,term:'day',destination:'cordoba'});assert.equal(campaign.operativeState[doctor].medkits,courierKits,'Returning service does not reissue dressings.');hires.push({id:doctor,quote:courier.quote,kits:courierKits});}
 assert.equal(operativeLocation(campaign,doctor),'cordoba');
 order({type:'createSquad',sector:'cordoba',name:'Vendas de Córdoba',ids:[doctor]});
 // Discovery is an actual local visit before any source is counted. An empty
 // discovered cache does not reissue a returning physician's spent pack.
 campaign=discoverRouteCache(campaign,doctor);checkBudget();settle();
 const inventory=()=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),doctor),stock=inventory().entries,available=stock.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
 const found=available?collectRouteItems(campaign,doctor,{item:'medkits'},Math.min(available,needed+1-carried)):{campaign,collected:0};campaign=found.campaign;settle();
 const after=inventory().entries,debits=stock.flatMap(row=>{const count=row.count-(after.find(next=>next.key===row.key)?.count??0);return count>0?[{key:row.key,expected:row.expected,before:row.count,after:row.count-count,count}]:[];});assert.equal(debits.reduce((n,row)=>n+row.count,0),found.collected);
 if(!campaign.routes.posta)order({type:'transport',mode:'posta'});const journey=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');assert.equal(journey.valid,true,journey.reason);assert.equal(journey.action.type,'travel');assert.ok(clock(campaign)+journey.hours*3600<=deadlineSeconds,'The actual clinic supply journey exceeds its shared 72-hour allowance.');
 for(const id of campaign.recruited){const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;let expiry=contractExpiresSeconds(campaign.contracts[id]);while(expiry!==null&&expiry<=clock(campaign)+(journey.hours+1)*3600){const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);renewals.push({id,quote});expiry=contractExpiresSeconds(campaign.contracts[id]);}}
 const departure=clock(campaign);order({type:'travel',sector,mode:'posta'});
 for(let step=0;operativeLocation(campaign,doctor)!==sector&&step<72;step++){
  assert.ok(campaign.squads.find(q=>q.members.includes(doctor))?.journey,'The actual courier needs its remaining journey.');order({type:'wait',hours:1});
 }
 assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.equal(operativeLocation(campaign,doctor),sector);
 if(!encounters.length)assert.equal(clock(campaign)-departure,journey.hours*3600);else assert.ok(clock(campaign)-departure>=journey.hours*3600);
 order({type:'selectSquad',id:previous});
 const total=()=>servingAt(campaign,sector).reduce((n,id)=>n+campaign.operativeState[id].medkits,0);
 while(total()<needed+1){
  const guard=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.asleep&&r.energy>10&&r.medkits>0&&civicStatus(campaign,op.id).available;}).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id)[0];assert.ok(guard,'The finite clinic deficit needs a real available paid relief guard.');
  const kits=campaign.operativeState[guard.op.id].medkits;order({type:'recruitCivic',id:guard.op.id,term:'day',destination:sector});assert.equal(operativeLocation(campaign,guard.op.id),sector,'Wait for an actual delayed hire before relying on its equipment.');assert.equal(campaign.operativeState[guard.op.id].medkits,kits);hires.push({id:guard.op.id,quote:guard.quote,kits});
 }
 const calm=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return local.includes(op.id)&&op.medical>=60&&r.alive&&r.hp>=15&&!r.bleeding&&!r.asleep&&(r.morale??0)>=40;}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(calm,'The clinic needs an actual stable physician before the incoming raid.');
 if(campaign.operativeState[calm.id].medkits<2){const donor=servingAt(campaign,sector).find(id=>id!==doctor&&id!==calm.id&&!patients.includes(id)&&campaign.operativeState[id].medkits>=2&&!sectorInventoryModel(campaign,sector,rosterFor(campaign),id).reason);assert.ok(donor,'The calm physician needs a real reachable local donation.');const count=2-campaign.operativeState[calm.id].medkits;order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});const row=sectorInventoryModel(campaign,sector,rosterFor(campaign),calm.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>=count);assert.ok(row);order({type:'sectorInventory',sector,operativeId:calm.id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 campaign=recoverRoutePrimary(campaign,doctor,{required:false,report:event=>{events.push(event);report(event);}});
 const guard=hires.filter(row=>row.id!==doctor).map(row=>rosterFor(campaign).find(op=>op.id===row.id)).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0]??rosterFor(campaign).find(op=>local.includes(op.id)&&op.id!==calm.id&&!patients.includes(op.id)&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp);assert.ok(guard,'The clinic party needs an actual healthy serving guard.');
 const ids=[...new Set([calm.id,...patients,guard.id,doctor])];assert.ok(ids.length<=6,'The real covered clinic party must fit one ordinary squad.');
 const occupied=servingAt(campaign,sector).filter(id=>!ids.includes(id)).map(id=>campaign.operativeState[id].residentPosition).filter(Boolean),posts=occupied.filter(point=>(point.tacticalLevel??0)>0),positions=[];
 order({type:'createSquad',sector,name:'Enfermería cubierta',ids});for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});order({type:'visitSector'});let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[sector]);preparationBattle=battle;
 const act=action=>{battle=actBattle(battle,action);preparationBattle=battle;assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);actions.push({action,tactical:true});};
 for(const id of ids){const unitId=String(id),current=battle.units.find(unit=>unit.id===unitId);if((current.tacticalLevel??0)>0){if(current.stance!=='crouched')act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});continue;}const roofs=getReachable(battle,battle.units.find(unit=>unit.id===unitId)).filter(point=>(point.tacticalLevel??0)>0&&!occupied.some(other=>sameCell(other,point))&&!positions.some(other=>sameCell(other,point))).map(point=>({...point,neighbors:[...posts,...positions].filter(other=>sameSurface(other,point)&&Math.hypot(other.x-point.x,other.y-point.y)<=1.5).length,distance:[...posts,...positions].reduce((n,other)=>n+Math.hypot(other.x-point.x,other.y-point.y),0)})).sort((a,b)=>b.neighbors-a.neighbors||a.distance-b.distance||a.cost-b.cost||a.y-b.y||a.x-b.x);const destination=roofs[0];assert.ok(destination&&destination.neighbors>0,'The physician and patients need real vacant reachable cover beside the guards.');act({type:'movement',unitId,movement:'walk'});for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++)act({type:'move',unitId,...spacePoint(destination)});assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});}
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
 for(const id of campaign.squads.filter(q=>q.location===sector&&!q.journey&&q.members.length).map(q=>q.id)){order({type:'selectSquad',id});for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});}
 order({type:'selectSquad',id:previous});assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(campaign.operativeState[id].alive,expectedFates.get(id).alive);assert.equal(campaign.operativeState[id].captured,expectedFates.get(id).captured);if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}}
 for(const id of patients)assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured,'An actual original clinic patient cannot be removed by the supply journey.');
 checkBudget();assert.deepEqual(start,before);const receipt={event:'saltaClinicSupply',needed:true,patients,carried,minimumTreatmentDressings:needed,collectedDressings:found.collected,carriedAfter:total(),doctor,courierAlreadyServing:Boolean(servingCourier),calmDoctor:calm.id,hires,renewals,debits,journey,positions,events,encounters,actions,start:[start.hour,start.secondOfHour??0],finish:[campaign.hour,campaign.secondOfHour??0],cashBefore:start.resources.treasury,cashAfter:campaign.resources.treasury};report(receipt);return {campaign:decodeSave(encodeSave(campaign)).campaign,receipt};
 }catch(error){
  recordRouteStrategicEvidence({helper:'prepareSaltaClinicSupply',stage:'preparation-failure',campaign:before,returnedCampaign:campaign,inputCapture,error,context:{partialStateScope:'Last adopted Native campaign and current retained preparation battle; nested helper work that failed before returning is not reconstructed.',actions,renewals,hires,encounters,preparationBattle,deadlineSeconds:Number.isFinite(deadlineSeconds)?deadlineSeconds:null}});
  if(error&&typeof error==='object')error.campaign=campaign;throw error;
 }
}

// Allocate actual local dressings before assigning the selected doctors.
// A selected physician's remaining kit is reserved for that same care tick.
export function supplySaltaClinicDoctors(start,doctors){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const protectedDoctors=new Set(doctors),sector='tucuman',actions=[],receipts=[];
 assert.equal(protectedDoctors.size,doctors.length);
 const local=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector;});
 assert.ok(doctors.every(id=>local.includes(id)),'Every selected doctor must actually serve at the local clinic.');
 const inventory=id=>sectorInventoryModel(campaign,sector,rosterFor(campaign),id);
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);};
 let gatheredDressings=0,donatedDressings=0;
 for(const id of doctors){
  if(campaign.operativeState[id].medkits)continue;
  let source=inventory(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!source){
   const donor=local.find(other=>!protectedDoctors.has(other)&&campaign.operativeState[other].medkits>0&&!inventory(other).reason);
   if(donor===undefined){const found=collectRouteItems(campaign,id,{item:'medkits'},1);campaign=found.campaign;gatheredDressings+=found.collected;receipts.push({doctor:id,kind:'local-recovery',count:found.collected});continue;}
   const carried=campaign.operativeState[donor].medkits;
   order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});
   assert.equal(campaign.operativeState[donor].medkits,carried-1);donatedDressings++;
   source=inventory(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   receipts.push({doctor:id,kind:'donation',donor,count:1});
  }
  assert.ok(source,'The doctor must reach the actual dressing.');
  const carried=campaign.operativeState[id].medkits;
  order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
  assert.equal(campaign.operativeState[id].medkits,carried+1);assert.equal(inventory(id).entries.find(row=>row.key===source.key)?.count??0,source.count-1);gatheredDressings++;
 }
 assert.ok(doctors.every(id=>campaign.operativeState[id].medkits>0),'All selected doctors must retain a finite dressing before assignment.');
 return {campaign,gatheredDressings,donatedDressings,actions,receipts};
}

// One real clinical phase. The caller carries the same remaining allowance
// across the earlier recovery and the later daylight preparation.
export function recoverSaltaClinic(start,{deadlineSeconds=clock(start)+72*3600,daylight=false,resolveEncounter,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>clock(start));
 let campaign=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),began=clock(campaign),patients=new Set(),doctors=new Set(),ticks=[],orders=[];
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
 settle();const supply=prepareSaltaClinicSupply(campaign,{report,deadlineSeconds,resolveEncounter:state=>{campaign=state;settle();return campaign;}});campaign=supply.campaign;check();
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
   const supplied=supplySaltaClinicDoctors(campaign,hourlyDoctors);campaign=supplied.campaign;gatheredDressings+=supplied.gatheredDressings;donatedDressings+=supplied.donatedDressings;check();settle();
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
 const receipt={patients:[...patients],doctors:[...doctors],ticks,orders,supply:supply.receipt,gatheredDressings,donatedDressings,usedDressings:ticks.reduce((n,t)=>n+t.usedDressings,0),startSeconds:began,endSeconds:clock(campaign),elapsedSeconds:clock(campaign)-began,deadlineSeconds,departure};
 report({event:'saltaClinicRecovery',receipt});return {campaign:decodeSave(encodeSave(campaign)).campaign,receipt,departure};
 }catch(error){
  if(error?.campaign)campaign=error.campaign;
  recordRouteStrategicEvidence({helper:'recoverSaltaClinic',stage:'preparation-failure',campaign:before,returnedCampaign:campaign,inputCapture,error,context:{patients:[...patients],doctors:[...doctors],ticks,orders,deadlineSeconds}});
  if(error&&typeof error==='object')error.campaign=campaign;throw error;
 }
}
