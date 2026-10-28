import assert from 'node:assert/strict';
import {rosterFor} from '../packages/game/campaign.js';
import {contractQuote} from '../packages/game/contracts.js';


// This daylight departure uses personnel who can enter local service now.
// Price the complete force, including guarantees, before spending its budget.
export function quoteSaltaHires(campaign,local,{reserve=250}={}){
 assert.ok(Array.isArray(local)&&new Set(local).size===local.length);
 assert.ok(local.every(id=>campaign.recruited.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured));
 assert.ok(Number.isSafeInteger(reserve)&&reserve>=0);
 const count=Math.max(0,12-local.length-1),budget=campaign.resources.treasury-reserve;
 const roster=rosterFor(campaign).filter(op=>op.id>=100&&op.id<1000&&!campaign.recruited.includes(op.id)&&!campaign.hiringArrivals.some(hire=>hire.operativeId===op.id)&&campaign.operativeState[op.id].alive&&!campaign.operativeState[op.id].captured);
 const offer=(op,term)=>({id:op.id,term,quote:contractQuote(campaign,op,term),marksmanship:op.marksmanship});
 const specialists=roster.map(op=>offer(op,'day')).filter(row=>row.quote.available&&!row.quote.permanent).sort((a,b)=>b.marksmanship-a.marksmanship||a.quote.total-b.quote.total||a.id-b.id);
 for(const specialist of specialists)for(const term of ['week','day']){
  const replacements=roster.filter(op=>op.id!==specialist.id).map(op=>offer(op,term)).filter(row=>row.quote.available&&!row.quote.permanent)
   .sort((a,b)=>a.quote.total-b.quote.total||b.marksmanship-a.marksmanship||a.id-b.id).slice(0,count);
  if(replacements.length!==count)continue;
  const offers=[specialist,...replacements],total=offers.reduce((sum,row)=>sum+row.quote.total,0);
  if(total<=budget)return {specialist, replacements, offers, total, reserve};
 }
 assert.fail(`No complete quoted Salta relief fits the actual budget: ${JSON.stringify({local,needed:count+1,treasury:campaign.resources.treasury,reserve,available:roster.map(op=>({id:op.id,day:contractQuote(campaign,op,'day').total,week:contractQuote(campaign,op,'week').total}))})}`);
}
