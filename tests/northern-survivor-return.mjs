import assert from 'node:assert/strict';
import {operativeLocation} from '../game/squads.js';
import {worldOwner} from '../game/world-cells.js';

// The caller supplies its existing Native order/paid-service closure. A rural
// departure is a real location, but neutral ground does not admit clinical rest.
export function restNorthernSurvivors(start,ids,{issueOrder}={}){
 assert.equal(typeof issueOrder,'function');
 assert.ok(Array.isArray(ids)&&new Set(ids).size===ids.length);
 let campaign=start;
 const receipt={rested:[],deferred:[],orders:[]};
 try{
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
  for(const id of ids){
   const r=campaign.operativeState[id];
   assert.ok(campaign.recruited.includes(id)&&r?.alive&&!r.captured,'Only an actual serving survivor can receive a recovery order.');
   if(worldOwner(campaign,operativeLocation(campaign,id))==='neutral'){receipt.deferred.push(id);continue;}
   // Other origins retain the exact Native care admission, including refusals.
   campaign=issueOrder({type:'assignCare',operativeId:id,assignment:'rest'});
   assert.equal(campaign.lastError,null,campaign.lastError);receipt.orders.push({type:'assignCare',operativeId:id,assignment:'rest'});receipt.rested.push(id);
   assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
  }
  return {campaign,receipt};
 }catch(error){error.campaign=error.campaign??campaign;error.northernSurvivorRest=receipt;throw error;}
}

// Queue the original return without prescribing clinical rest at a neutral
// origin. Native march admission remains authoritative; no sleep or readiness
// is granted when the actual party cannot march.
export function queueNorthernSurvivorReturn(start,squadId,{issueOrder}={}){
 assert.equal(typeof issueOrder,'function');let campaign=start;
 const receipt={squadId,members:[],origin:null,rest:null,orders:[]};
 const issue=action=>{
  campaign=issueOrder(action);assert.equal(campaign.lastError,null,campaign.lastError);receipt.orders.push(structuredClone(action));
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);return campaign;
 };
 try{
  assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);
  const squad=campaign.squads.find(q=>q.id===squadId);assert.ok(squad?.members.length&&!squad.journey,'The actual stopped survivor squad must be available.');
  assert.notEqual(squad.location,'cordoba','A local squad does not need another return.');
  issue({type:'selectSquad',id:squadId});const members=[...campaign.squad];receipt.members=members;receipt.origin=campaign.location;
  const resting=restNorthernSurvivors(campaign,members,{issueOrder:issue});campaign=resting.campaign;receipt.rest=resting.receipt;
  assert.ok(!resting.receipt.deferred.length||resting.receipt.deferred.length===members.length,'One actual squad has one recovery origin.');
  if(!resting.receipt.deferred.length){
   for(let h=0;h<48&&members.some(id=>campaign.operativeState[id].fatigue>0||campaign.operativeState[id].energy<100||campaign.operativeState[id].asleep);h++)issue({type:'wait',hours:1});
  }
  for(const operativeId of members)issue({type:'assignCare',operativeId,assignment:'active'});
  issue({type:'travel',sector:'cordoba',queue:true});
  return {campaign,receipt};
 }catch(error){error.campaign=error.campaign??campaign;error.northernSurvivorReturn=receipt;throw error;}
}
