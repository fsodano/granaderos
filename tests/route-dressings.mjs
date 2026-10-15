import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {order,saved} from './local-contract-fixture.mjs';

// Use known local dressings first, then actual carried donations or a real
// discovered cache. No purchase, remote transfer, stock grant or refill.
export function attemptRouteDressings(start,operativeId,target,{reserves={},report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(target)&&target>=0&&target<=100000);
 operativeId=Number(operativeId);
 assert.ok(Number.isSafeInteger(operativeId)&&Object.hasOwn(start.operativeState,operativeId),'The actual dressing recipient must exist.');
 let s=structuredClone(start),discovered=false;const sector=operativeLocation(s,operativeId);
 const sites=()=>sectorInventorySites(s,sector).map(site=>({site,model:sectorInventoryModel(s,site.id,rosterFor(s),operativeId)}));
 while((s.operativeState[operativeId].medkits??0)<target){
  const recipient=sectorInventoryModel(s,sector,rosterFor(s),operativeId);
  assert.equal(recipient.operativeId,operativeId,'The actual dressing recipient must be present.');
  assert.equal(recipient.carriedReason,null,recipient.carriedReason);
  const source=sites().map(({site,model})=>({site,model,row:model.operativeId===operativeId&&model.entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits')})).find(source=>source.row);
  if(!source){
   const donor=s.recruited.find(id=>{const r=s.operativeState[id];if(id===operativeId||!r.alive||r.captured||r.medkits<=(reserves[id]??0)||operativeLocation(s,id)!==sector)return false;const model=sectorInventoryModel(s,sector,rosterFor(s),id);return model.operativeId===id&&!model.reason;});
   if(donor!==undefined){const count=Math.min(s.operativeState[donor].medkits-(reserves[donor]??0),target-(s.operativeState[operativeId].medkits??0));s=order(s,{type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});report({event:'routeDressingDonation',donor,recipient:operativeId,sector,count});continue;}
   if(!discovered){discovered=true;s=discoverRouteCache(s,operativeId);continue;}
   const quotedSites=sites().map(({site,model})=>({id:site.id,operativeId:model.operativeId,reason:model.reason,dressings:model.entries.filter(row=>JSON.parse(row.expected).item==='medkits').map(({key,count,reachable,reason})=>({key,count,reachable,reason}))}));
   const inaccessibleCount=quotedSites.reduce((sum,site)=>sum+site.dressings.filter(row=>!row.reachable).reduce((n,row)=>n+row.count,0),0);
   const details={operativeId,sector,target,carried:s.operativeState[operativeId].medkits??0,availability:inaccessibleCount>0?'inaccessible-stock':'no-reachable-stock',inaccessibleCount,sites:quotedSites};
   report({event:'finiteDressingShortage',...details});
   return {campaign:saved({campaign:s}).campaign,supplied:false,reason:'finite-dressing-shortage',details};
  }
  const {site,model,row}=source;
  let count=Math.min(row.count,target-(s.operativeState[operativeId].medkits??0));
  while(count>0){try{applyItemQuantity(model.personal,{...JSON.parse(row.expected),count});break;}catch{count--;}}
  assert.ok(count,'The actual physician has no carrying room for the remaining dressings.');
  const cash=s.resources.treasury,old=s.operativeState[operativeId].medkits??0;
  s=order(s,{type:'sectorInventory',sector:site.id,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count});
  assert.equal(s.resources.treasury,cash);assert.equal(s.operativeState[operativeId].medkits,old+count);report({event:'routeDressingsCollected',operativeId,sector,siteId:site.id,count,sourceKey:row.key});
 }
 return {campaign:saved({campaign:s}).campaign,supplied:true,reason:null,details:null};
}

// Existing callers remain strict. Only the explicit attempt API can hand its
// actual post-discovery campaign to a different legal recovery plan.
export function supplyRouteDressings(start,operativeId,target,options){
 const result=attemptRouteDressings(start,operativeId,target,options);
 if(!result.supplied)throw Error(`No actual reachable finite dressings remain for ${operativeId} at ${result.details.sector}.`);
 return result.campaign;
}
