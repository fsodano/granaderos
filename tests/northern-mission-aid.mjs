import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {contractExpiresSeconds} from '../packages/game/contracts.js';
import {criticalFirstAidNeeded} from '../packages/game/first-aid.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {applyItemQuantity} from '../packages/game/tactical-inventory.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {quoteRescuerFirstAid} from './rescued-first-aid-quote.mjs';
import {northernEmergencyAid} from './northern-emergency-aid.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// Redistribute only admitted local stock before this one existing relief visit.
// A supply quote does not claim tactical access or change a living wound.
export function aidNorthernMissionRelief(start,relief,{report=()=>{}}={}){
 const inputCapture=recordRouteStrategicEvidence({helper:'aidNorthernMissionRelief',stage:'preparation-input',campaign:start});
 let c=start;const stockOrders=[],sector=start.location,roster=rosterFor(start);
 assert.ok(Array.isArray(relief)&&relief.length&&new Set(relief).size===relief.length);
 assert.deepEqual([...start.squad].sort((a,b)=>a-b),[...relief].sort((a,b)=>a-b));
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const serving=id=>{const r=c.operativeState[id],contract=c.contracts[id],expiry=contractExpiresSeconds(contract);return c.recruited.includes(id)&&r?.alive&&!r.captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&contract&&(expiry===null||expiry>clock(c));};
 assert.ok(relief.every(serving),'The actual relief cohort must remain local and serving.');
 const urgent=relief.filter(id=>{const r=c.operativeState[id];return criticalFirstAidNeeded(r)||(r.bleeding??0)>0;});
 const medic=roster.filter(op=>{
  const r=c.operativeState[op.id];return relief.includes(op.id)&&serving(op.id)&&op.medical>0&&r.hp>=15&&!r.bleeding&&!r.asleep&&!r.unconscious&&!r.routed&&!r.surrendered&&!r.detained&&!r.bound&&r.energy>10;
 }).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
 assert.ok(!urgent.length||medic,'Actual urgent relief needs a fit selected physician.');
 const quote=medic?quoteRescuerFirstAid({...medic,...c.operativeState[medic.id]},urgent.map(id=>({...roster.find(op=>op.id===id),...c.operativeState[id],id}))):null;
 const target=quote?.dressings??0;
 const rows=()=>sectorInventorySites(c,sector).flatMap(site=>{
  const model=sectorInventoryModel(c,site.id,rosterFor(c),medic.id);
  return model.operativeId===medic.id?model.entries.filter(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits').map(row=>({...row,siteId:site.id})):[];
 });
 const donors=()=>c.recruited.filter(id=>id!==medic.id&&serving(id)&&(c.operativeState[id].medkits??0)>1).filter(id=>{const model=sectorInventoryModel(c,sector,rosterFor(c),id);return model.operativeId===id&&!model.reason;});
 const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;stockOrders.push(action);};
 if(medic&&target>(c.operativeState[medic.id].medkits??0)){
  const recipient=sectorInventoryModel(c,sector,rosterFor(c),medic.id);assert.equal(recipient.operativeId,medic.id);assert.equal(recipient.carriedReason,null,recipient.carriedReason);
  const needed=target-(c.operativeState[medic.id].medkits??0),available=rows().reduce((n,row)=>n+row.count,0)+donors().reduce((n,id)=>n+c.operativeState[id].medkits-1,0);
  if(available<needed){
   recordRouteStrategicEvidence({helper:'aidNorthernMissionRelief',stage:'missing-finite-dressings',campaign:c,inputCapture,context:{relief,physicianId:medic.id,urgent,quote,target,available,stockOrders,scope:'Known reachable local rows and admitted living local donor surplus only; no discovery, travel or tactical entry.'}});
   assert.fail('Known finite local dressings cannot supply the actual urgent relief.');
  }
  while((c.operativeState[medic.id].medkits??0)<target){
   assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
   const row=rows()[0];
   if(row){
    const count=Math.min(row.count,target-c.operativeState[medic.id].medkits),model=sectorInventoryModel(c,row.siteId,rosterFor(c),medic.id),old=c.operativeState[medic.id].medkits;
    applyItemQuantity(model.personal,{...JSON.parse(row.expected),count});
    order({type:'sectorInventory',sector:row.siteId,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
    assert.equal(c.operativeState[medic.id].medkits,old+count);
   }else{
    const donor=donors()[0];assert.notEqual(donor,undefined,'The quoted actual local donation must remain admitted.');
    const before=c.operativeState[donor].medkits,count=Math.min(before-1,target-c.operativeState[medic.id].medkits);
    order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});assert.equal(c.operativeState[donor].medkits,before-count);assert.ok(c.operativeState[donor].medkits>=1);
   }
  }
 }
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 const p=visit(c),aid=northernEmergencyAid(p.battle,{physicianId:medic?.id,urgentIds:urgent});
 c=leave(sync({campaign:p.campaign,battle:aid.battle}));
 recordRouteStrategicEvidence({helper:'aidNorthernMissionRelief',stage:'route-checkpoint',campaign:start,returnedCampaign:c,inputCapture,context:{relief,physicianId:medic?.id??null,urgent,quote,stockOrders,initial:p.battle,aid,scope:'Actual single relief visit, existing emergency-aid orders and returned campaign before the caller health/bleeding assertions; no additional tactical entry or care.'}});
 report({event:'northernMissionFiniteAid',relief:[...relief],physicianId:medic?.id??null,urgent,quote,stockOrders,steps:aid.steps,stoppedReason:aid.stoppedReason,untreated:aid.untreated,elapsedSeconds:aid.elapsedSeconds});
 return {campaign:c,physicianId:medic?.id??null,urgent,quote,stockOrders,initial:p.battle,enteredCampaign:p.campaign,aid};
}
