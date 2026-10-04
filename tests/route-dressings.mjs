import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {order,saved} from './local-contract-fixture.mjs';

// Use known local dressings first, then actual carried donations or a real
// discovered cache. No purchase, remote transfer, stock grant or refill.
export function supplyRouteDressings(start,operativeId,target,{reserves={},report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(target)&&target>=0&&target<=100000);
 let s=structuredClone(start),discovered=false;const sector=operativeLocation(s,operativeId);
 const model=()=>sectorInventoryModel(s,sector,rosterFor(s),operativeId);
 while((s.operativeState[operativeId].medkits??0)<target){
  let row=model().entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits');
  if(!row){
   const donor=s.recruited.find(id=>id!==operativeId&&s.operativeState[id].alive&&!s.operativeState[id].captured&&s.operativeState[id].medkits>(reserves[id]??0)&&operativeLocation(s,id)===sector&&!sectorInventoryModel(s,sector,rosterFor(s),id).reason);
   if(donor!==undefined){const count=Math.min(s.operativeState[donor].medkits-(reserves[donor]??0),target-(s.operativeState[operativeId].medkits??0));s=order(s,{type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});report({event:'routeDressingDonation',donor,recipient:operativeId,sector,count});continue;}
   if(!discovered){discovered=true;s=discoverRouteCache(s,operativeId);continue;}
   report({event:'finiteDressingShortage',operativeId,sector,target,carried:s.operativeState[operativeId].medkits??0});throw Error(`No actual reachable finite dressings remain for ${operativeId} at ${sector}.`);
  }
  let count=Math.min(row.count,target-(s.operativeState[operativeId].medkits??0));
  while(count>0){try{applyItemQuantity(model().personal,{...JSON.parse(row.expected),count});break;}catch{count--;}}
  assert.ok(count,'The actual physician has no carrying room for the remaining dressings.');
  const cash=s.resources.treasury,old=s.operativeState[operativeId].medkits??0;
  s=order(s,{type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(s.resources.treasury,cash);assert.equal(s.operativeState[operativeId].medkits,old+count);report({event:'routeDressingsCollected',operativeId,sector,count,sourceKey:row.key});
 }
 return saved({campaign:s}).campaign;
}
