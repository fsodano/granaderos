import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {operativeInTransit,operativeLocation} from '../game/squads.js';
import {collectRouteItems} from './finite-route-equipment.mjs';
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
export function prepareSaltaClinicSupply(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),previous=campaign.activeSquadId,sector='tucuman',local=servingAt(campaign,sector);
 const patients=local.filter(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp),roster=rosterFor(campaign);
 const physician=roster.filter(op=>local.includes(op.id)&&op.medical>=20&&campaign.operativeState[op.id].hp>=15&&!campaign.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical)[0];
 if(patients.length)assert.ok(physician,'An actual local physician must define the clinic treatment budget.');
 const carried=local.reduce((n,id)=>n+campaign.operativeState[id].medkits,0),needed=patients.reduce((n,id)=>n+Math.ceil((campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)/doctorRate(physician,campaign)),0);
 if(!patients.length||carried>=needed)return {campaign,receipt:{event:'saltaClinicSupply',needed:false,patients,carried,minimumTreatmentDressings:needed,actions:[]}};
 assert.ok(physician,'An actual local physician must define the clinic treatment budget.');assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 assert.ok(local.every(id=>campaign.operativeState[id].hp>=15&&!campaign.operativeState[id].bleeding),'Give actual urgent care before the medical courier leaves.');
 const actions=[],renewals=[],hires=[],events=[];
 const order=action=>{const cash=campaign.resources.treasury;campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);const row={action,hour:campaign.hour,second:campaign.secondOfHour??0,treasuryChange:campaign.resources.treasury-cash};actions.push(row);report({event:'saltaClinicSupplyOrder',...row});};
 const candidates=rosterFor(campaign).filter(op=>op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured&&operativeLocation(campaign,op.id)==='cordoba'&&campaign.operativeState[op.id].hp===campaign.operativeState[op.id].maxHp&&op.medical>=80&&civicStatus(campaign,op.id).available).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||b.op.medical-a.op.medical||a.op.id-b.op.id);
 const courier=candidates[0];assert.ok(courier,'An actual healthy paid Córdoba physician must carry the known linen.');const doctor=courier.op.id,courierKits=campaign.operativeState[doctor].medkits;
 order({type:'recruitCivic',id:doctor,term:'day',destination:'cordoba'});assert.equal(campaign.operativeState[doctor].medkits,courierKits,'Returning service does not reissue dressings.');assert.equal(operativeLocation(campaign,doctor),'cordoba');hires.push({id:doctor,quote:courier.quote,kits:courierKits});
 order({type:'createSquad',sector:'cordoba',name:'Vendas de Córdoba',ids:[doctor]});
 const inventory=()=>sectorInventoryModel(campaign,'cordoba',rosterFor(campaign),doctor),stock=inventory().entries,available=stock.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);assert.ok(available>0,'The courier needs actual reachable known Córdoba dressings.');
 const found=collectRouteItems(campaign,doctor,{item:'medkits'},Math.min(available,needed+1-carried));campaign=found.campaign;
 const after=inventory().entries,debits=stock.flatMap(row=>{const count=row.count-(after.find(next=>next.key===row.key)?.count??0);return count>0?[{key:row.key,expected:row.expected,before:row.count,after:row.count-count,count}]:[];});assert.equal(debits.reduce((n,row)=>n+row.count,0),found.collected);
 if(!campaign.routes.posta)order({type:'transport',mode:'posta'});const journey=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');assert.equal(journey.valid,true,journey.reason);assert.equal(journey.action.type,'travel');
 for(const id of campaign.recruited){const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;let expiry=contractExpiresSeconds(campaign.contracts[id]);while(expiry!==null&&expiry<=clock(campaign)+(journey.hours+1)*3600){const contract=campaign.contracts[id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;assert.equal(quote.available,true,quote.reason);order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);renewals.push({id,quote});expiry=contractExpiresSeconds(campaign.contracts[id]);}}
 const departure=clock(campaign);order({type:'travel',sector,mode:'posta'});assert.equal(campaign.pendingEncounter,null,'Settle the actual courier interruption before clinic preparation.');assert.equal(campaign.pendingBattle,null);assert.equal(operativeLocation(campaign,doctor),sector);assert.equal(clock(campaign)-departure,journey.hours*3600);order({type:'selectSquad',id:previous});
 const total=()=>servingAt(campaign,sector).reduce((n,id)=>n+campaign.operativeState[id].medkits,0);
 while(total()<needed+1){
  const guard=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.asleep&&r.energy>10&&r.medkits>0&&civicStatus(campaign,op.id).available;}).map(op=>({op,quote:contractQuote(campaign,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=campaign.resources.treasury).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id)[0];assert.ok(guard,'The finite clinic deficit needs a real available paid relief guard.');
  const kits=campaign.operativeState[guard.op.id].medkits;order({type:'recruitCivic',id:guard.op.id,term:'day',destination:sector});assert.equal(operativeLocation(campaign,guard.op.id),sector,'Wait for an actual delayed hire before relying on its equipment.');assert.equal(campaign.operativeState[guard.op.id].medkits,kits);hires.push({id:guard.op.id,quote:guard.quote,kits});
 }
 const calm=rosterFor(campaign).filter(op=>{const r=campaign.operativeState[op.id];return local.includes(op.id)&&op.medical>=60&&r.alive&&r.hp>=15&&!r.bleeding&&!r.asleep&&(r.morale??0)>=40;}).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(calm,'The clinic needs an actual stable physician before the incoming raid.');
 if(campaign.operativeState[calm.id].medkits<2){const donor=servingAt(campaign,sector).find(id=>id!==doctor&&id!==calm.id&&!patients.includes(id)&&campaign.operativeState[id].medkits>=2&&!sectorInventoryModel(campaign,sector,rosterFor(campaign),id).reason);assert.ok(donor,'The calm physician needs a real reachable local donation.');const count=2-campaign.operativeState[calm.id].medkits;order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});const row=sectorInventoryModel(campaign,sector,rosterFor(campaign),calm.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>=count);assert.ok(row);order({type:'sectorInventory',sector,operativeId:calm.id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 campaign=recoverRoutePrimary(campaign,doctor,{required:false,report:event=>{events.push(event);report(event);}});
 const guard=hires.filter(row=>row.id!==doctor).map(row=>rosterFor(campaign).find(op=>op.id===row.id)).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0];assert.ok(guard);
 const ids=[...new Set([calm.id,...patients,guard.id,doctor])];assert.ok(ids.length<=6,'The real covered clinic party must fit one ordinary squad.');
 const occupied=servingAt(campaign,sector).filter(id=>!ids.includes(id)).map(id=>campaign.operativeState[id].residentPosition).filter(Boolean),posts=occupied.filter(point=>(point.tacticalLevel??0)>0),positions=[];
 order({type:'createSquad',sector,name:'Enfermería cubierta',ids});for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});order({type:'visitSector'});let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[sector]);
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);actions.push({action,tactical:true});};
 for(const id of ids){const unitId=String(id),roofs=getReachable(battle,battle.units.find(unit=>unit.id===unitId)).filter(point=>(point.tacticalLevel??0)>0&&!occupied.some(other=>sameCell(other,point))&&!positions.some(other=>sameCell(other,point))).map(point=>({...point,neighbors:[...posts,...positions].filter(other=>sameSurface(other,point)&&Math.hypot(other.x-point.x,other.y-point.y)<=1.5).length,distance:[...posts,...positions].reduce((n,other)=>n+Math.hypot(other.x-point.x,other.y-point.y),0)})).sort((a,b)=>b.neighbors-a.neighbors||a.distance-b.distance||a.cost-b.cost||a.y-b.y||a.x-b.x);const destination=roofs[0];assert.ok(destination&&destination.neighbors>0,'The physician and patients need real vacant reachable cover beside the guards.');act({type:'movement',unitId,movement:'walk'});for(let leg=0;!sameCell(battle.units.find(unit=>unit.id===unitId),destination)&&leg<64;leg++)act({type:'move',unitId,...spacePoint(destination)});assert.ok(sameCell(battle.units.find(unit=>unit.id===unitId),destination));act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(battle.units.find(unit=>unit.id===unitId))});}
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
 for(const id of campaign.squads.filter(q=>q.location===sector&&!q.journey&&q.members.length).map(q=>q.id)){order({type:'selectSquad',id});for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});campaign=finishReloadsBeforeMarch(campaign,{report});}
 order({type:'selectSquad',id:previous});assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(campaign.operativeState[id].alive,r.alive);assert.equal(campaign.operativeState[id].captured,r.captured);}
 assert.deepEqual(start,before);const receipt={event:'saltaClinicSupply',needed:true,patients,carried,minimumTreatmentDressings:needed,collectedDressings:found.collected,carriedAfter:total(),doctor,calmDoctor:calm.id,hires,renewals,debits,journey,positions,events,actions,start:[start.hour,start.secondOfHour??0],finish:[campaign.hour,campaign.secondOfHour??0],cashBefore:start.resources.treasury,cashAfter:campaign.resources.treasury};report(receipt);return {campaign:decodeSave(encodeSave(campaign)).campaign,receipt};
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
