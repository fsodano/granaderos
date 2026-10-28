import assert from 'node:assert/strict';
import {rosterFor} from '../packages/game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';

// This is a current cash quote, not an order or a forecast of future income.
// A raid, changed service objection or later XP can require a new quote.
export function quoteMountainServiceBudget(campaign,{keepIds,horizonSeconds,fixedCost=0}={}){
 const nowSeconds=campaign.hour*3600+(campaign.secondOfHour??0);
 assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>=0);
 assert.ok(Array.isArray(keepIds)&&keepIds.every(id=>Number.isSafeInteger(id)&&id>=0),'Name the actual people whose service must be retained.');
 assert.ok(Number.isSafeInteger(horizonSeconds)&&horizonSeconds>=nowSeconds,'Use an absolute current or future service deadline.');
 assert.ok(Number.isSafeInteger(fixedCost)&&fixedCost>=0,'Reserve only a known nonnegative cost.');
 const ids=[...new Set(keepIds)],treasury=campaign.resources.treasury,roster=rosterFor(campaign),entries=[];
 assert.ok(Number.isSafeInteger(treasury)&&treasury>=0);
 let reason=null,renewalCost=0;
 for(const id of ids){
  const record=campaign.operativeState[id],contract=campaign.contracts?.[id],operative=roster.find(op=>op.id===id),expirySeconds=contractExpiresSeconds(contract);
  if(!operative||!campaign.recruited.includes(id)||!record?.alive||record.captured||!contract||expirySeconds!==null&&expirySeconds<=nowSeconds){
   const refusal=`The intended serving person ${id} has no current available service.`;
   entries.push({id,expirySeconds,permanent:false,renewals:0,quote:null,cost:0,reason:refusal});reason??=refusal;continue;
  }
  if(expirySeconds===null){entries.push({id,expirySeconds,permanent:true,renewals:0,quote:null,cost:0,reason:null});continue;}
  const quote=contractRenewalQuote(campaign,operative,'day'),seconds=quote.hours*3600;
  assert.ok(Number.isSafeInteger(seconds)&&seconds>0);
  // The existing route retains expiry strictly after its requested horizon.
  const renewals=expirySeconds>horizonSeconds?0:Math.floor((horizonSeconds-expirySeconds)/seconds)+1,cost=renewals*quote.price;
  assert.ok(Number.isSafeInteger(cost)&&cost>=0);
  const refusal=renewals&&!quote.available?`The actual renewal for ${id} is unavailable: ${quote.reason}.`:null;
  entries.push({id,expirySeconds,permanent:false,renewals,quote,cost,reason:refusal});reason??=refusal;renewalCost+=cost;
  assert.ok(Number.isSafeInteger(renewalCost));
 }
 const totalCost=renewalCost+fixedCost;assert.ok(Number.isSafeInteger(totalCost));
 const shortfall=Math.max(0,totalCost-treasury);
 if(!reason&&shortfall)reason='The actual treasury does not cover the quoted service and known costs.';
 return {available:reason===null,reason,nowSeconds,horizonSeconds,keepIds:ids,fixedCost,renewalCost,totalCost,treasury,shortfall,entries};
}
