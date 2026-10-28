import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {careAssignmentReason} from '../packages/game/medical-care.js';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;

// Retain earned positions. Re-staging a mixed scout/roof formation moves its
// ground rifleman into a different firing lane and changes the native battle.
export function openingRearFormation(campaign,sector='tucuman'){
 const ids=campaign.recruited.filter(id=>{
  const r=campaign.operativeState[id];
  return r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector;
 });
 const roofIds=ids.filter(id=>(campaign.operativeState[id].residentPosition?.tacticalLevel??0)>0);
 return {ids,roofIds,hasCover:roofIds.length>0,allCovered:ids.length>0&&roofIds.length===ids.length};
}

// A real Córdoba courier inspects visible remains, retains serving contracts
// and uses the paid posta. The physicians receive only debited physical linen.
// An already supplied clinic keeps its existing equipment, clock and treasury.
export function supplyOpeningRearDoctors(start,carrier,{sector='tucuman',report=()=>{}}={}){
 let campaign=saved(start);const before=structuredClone(start),actions=[],renewals=[],transfers=[];
 const order=action=>{
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);
 };
 const doctors=rosterFor(campaign).filter(op=>{
  const r=campaign.operativeState[op.id];
  return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,op.id)&&operativeLocation(campaign,op.id)===sector&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&op.medical>=70;
 }).sort((a,b)=>b.medical-a.medical||a.id-b.id);
 assert.ok(doctors.length,'The actual rear clinic needs a capable serving physician.');
 if(doctors.some(op=>campaign.operativeState[op.id].medkits>0)){
  return {campaign,receipt:{event:'openingRearMedicalSupply',needed:false,sector,doctors:doctors.map(op=>op.id),actions,renewals,transfers}};
 }
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
 assert.ok(campaign.recruited.includes(carrier)&&campaign.operativeState[carrier].alive&&!campaign.operativeState[carrier].captured);
 const found=recoverVisibleRouteDressings(campaign,carrier,10,{report});campaign=found.campaign;
 const recipients=doctors.slice(0,2),quantity=recipients.length*3;
 assert.ok(found.collected>=quantity,'The medical courier must find sufficient actual finite linen.');
 const cashBeforeTransport=campaign.resources.treasury;
 if(!campaign.routes.posta)order({type:'transport',mode:'posta'});
 const transportCost=cashBeforeTransport-campaign.resources.treasury;
 const journey=previewStrategicRoute(campaign,campaign.activeSquadId,sector,'posta');assert.equal(journey.valid,true,journey.reason);
 for(const id of campaign.recruited){
  const r=campaign.operativeState[id];if(!r.alive||r.captured)continue;
  let expiry=contractExpiresSeconds(campaign.contracts[id]);
  assert.ok(expiry===null||expiry>clock(campaign),'Retain actual service before the courier departs.');
  while(expiry!==null&&expiry<=clock(campaign)+(journey.hours+1)*3600){
   const op=rosterFor(campaign).find(op=>op.id===id),quote=contractRenewalQuote(campaign,op,'day'),contract=campaign.contracts[id],cash=campaign.resources.treasury;
   assert.equal(quote.available,true,quote.reason);
   order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
   assert.equal(campaign.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(campaign.contracts[id]),expiry+86400);
   renewals.push({id,price:quote.price,expiryBefore:expiry,expiryAfter:expiry+86400});expiry+=86400;
  }
 }
 const departure=clock(campaign),cashBeforeTravel=campaign.resources.treasury;order({type:'travel',sector,mode:'posta'});
 const travelCost=cashBeforeTravel-campaign.resources.treasury;
 assert.equal(campaign.pendingEncounter,null,'The medical courier must arrive before an actual raid.');
 assert.equal(campaign.pendingBattle,null);assert.equal(operativeLocation(campaign,carrier),sector);
 assert.equal(clock(campaign)-departure,journey.hours*3600);
 const carried=campaign.operativeState[carrier].medkits;
 order({type:'sectorInventory',sector,operativeId:carrier,direction:'drop',item:'medkits',count:quantity});
 assert.equal(campaign.operativeState[carrier].medkits,carried-quantity);
 for(const op of recipients){
  const model=sectorInventoryModel(campaign,sector,rosterFor(campaign),op.id);assert.equal(model.operativeId,op.id);assert.equal(model.reason,null);
  const source=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count>=3);
  assert.ok(source,'The serving physician must reach the donated finite dressing stack.');
  const kits=campaign.operativeState[op.id].medkits;
  order({type:'sectorInventory',sector,operativeId:op.id,direction:'take',sourceKey:source.key,expected:source.expected,count:3});
  assert.equal(campaign.operativeState[op.id].medkits,kits+3);
  const left=sectorInventoryModel(campaign,sector,rosterFor(campaign),op.id).entries.find(row=>row.key===source.key)?.count??0;
  assert.equal(left,source.count-3);transfers.push({id:op.id,count:3,sourceKey:source.key,expected:source.expected,before:source.count,after:left});
 }
 for(const [id,r] of Object.entries(before.operativeState)){assert.equal(campaign.operativeState[id].alive,r.alive);assert.equal(campaign.operativeState[id].captured,r.captured);}
 const receipt={event:'openingRearMedicalSupply',needed:true,sector,carrier,doctors:recipients.map(op=>op.id),found:found.evidence,quantity,transportCost,travelCost,travelHours:journey.hours,renewals,transfers,actions,startSeconds:clock(start),endSeconds:clock(campaign),treasuryBefore:start.resources.treasury,treasuryAfter:campaign.resources.treasury};
 assert.equal(receipt.treasuryBefore-receipt.treasuryAfter,transportCost+travelCost+renewals.reduce((sum,row)=>sum+row.price,0));
 report(receipt);assert.deepEqual(start,before);return {campaign:saved(campaign),receipt};
}

// Stop actual bleeding before a long courier walk. Strategic local care uses
// its real hourly rate; it does not erase wounds, restore a death or claim a win.
export function stabilizeOpeningRearSurvivors(start,sector,{report=()=>{}}={}){
 let campaign=saved(start);const before=structuredClone(start),actions=[],ticks=[];
 const local=campaign.recruited.filter(id=>{
  const r=campaign.operativeState[id];return r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector;
 });
 const urgent=()=>local.filter(id=>{const r=campaign.operativeState[id];return r.bleeding>0||r.hp<15;});
 const patients=urgent();
 if(!patients.length)return {campaign,receipt:{event:'openingRearUrgentCare',sector,patients,hours:0,ticks,actions}};
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);};
 for(let hour=0;urgent().length&&hour<12;hour++){
  assert.equal(campaign.pendingEncounter,null,'Settle an actual incoming raid before continuing local care.');assert.equal(campaign.pendingBattle,null);
  const doctors=rosterFor(campaign).filter(op=>local.includes(op.id)&&!urgent().includes(op.id)&&!careAssignmentReason(campaign,op,'doctor')).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2).map(op=>op.id);
  assert.ok(doctors.length,'A supplied actual serving physician must stabilize the rear survivors.');
  for(const id of urgent())order({type:'assignCare',operativeId:id,assignment:'patient'});
  for(const id of doctors)order({type:'assignCare',operativeId:id,assignment:'doctor'});
  const kits=doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
  const midpoint=saved(campaign);assert.deepEqual(midpoint,campaign);campaign=midpoint;
  order({type:'wait',hours:1});const used=kits-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
  assert.ok(used>0,'Actual urgent care consumes the carried finite dressings.');
  assert.ok(local.every(id=>campaign.operativeState[id].alive),'Local care must retain every actual survivor.');
  ticks.push({hour:campaign.hour,second:campaign.secondOfHour??0,doctors,usedDressings:used,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))});
  for(const id of doctors)if(!campaign.operativeState[id].medkits)order({type:'assignCare',operativeId:id,assignment:'rest'});
 }
 assert.deepEqual(urgent(),[],'Actual finite urgent care completes before the battery trip continues.');
 for(const id of local)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(const [id,r]of Object.entries(before.operativeState)){assert.equal(campaign.operativeState[id].alive,r.alive);assert.equal(campaign.operativeState[id].captured,r.captured);if(!r.alive)assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}
 const receipt={event:'openingRearUrgentCare',sector,patients,hours:ticks.length,ticks,usedDressings:ticks.reduce((sum,row)=>sum+row.usedDressings,0),actions,startSeconds:clock(start),endSeconds:clock(campaign)};
 report(receipt);assert.deepEqual(start,before);return {campaign:saved(campaign),receipt};
}
