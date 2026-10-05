import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {lowMoraleRenewalStatus} from '../game/morale-renewal.js';
import {ammoCount} from '../game/ammo-types.js';
import {earnLowMoraleRenewal,recoverLowMoraleRenewal,renewalStep,renewalSaved,renewalStamp,renewalActor} from './morale-renewal-fixture.mjs';

const person=s=>rosterFor(s).find(o=>o.id===130),record=s=>s.operativeState[130];
const rounds=s=>{const r=record(s);return r.carriedLoaded+ammoCount({...person(s),...r});};
const custody=s=>({inventory:record(s).inventory,rounds:rounds(s),condition:record(s).condition,medkits:record(s).medkits,
 outfit:record(s).outfit,headwear:record(s).headwear,legwear:record(s).legwear,bladeCondition:record(s).bladeCondition});
const refuse=pair=>{
 const before=structuredClone(pair),s=pair.campaign,c=s.contracts[130],next=dispatchCampaign(s,{type:'renewContract',id:130,term:'day',expectedExpiresAt:c.expiresAt,expectedExpiresSecond:c.expiresSecond??0});
 assert.match(next.lastError,/moral personal menor que 30/);assert.deepEqual({...next,lastError:null},s);assert.deepEqual(pair,before);assert.deepEqual(renewalSaved(pair),pair);
};

test('real paid clinical injuries and isolation block renewal; paid regroup and ordinary rest restore eligibility with full saved finite replay',t=>{
 const route=earnLowMoraleRenewal(),old=earnLowMoraleRenewal({oldRenewal:true}),low=structuredClone(route.pair),initial=structuredClone(route.start);
 assert.deepEqual(route.prices,[{id:130,price:252},{id:110,price:420}]);
 assert.equal(low.campaign.resources.treasury,2528);assert.equal(rounds(low.campaign),7);assert.equal(record(low.campaign).condition,97);assert.equal(record(low.campaign).medkits,1);
 assert.equal(record(low.campaign).hp,30);assert.equal(record(low.campaign).bleeding,0);assert.equal(low.campaign.operativeState[110].captured,true);
 assert.equal(record(low.campaign).morale,29.700000000000003);assert.equal(record(low.campaign).strategicIsolation.loss,14);
 refuse(low);
 assert.equal(lowMoraleRenewalStatus(old.pair.campaign,person(old.pair.campaign)).eligible,false);assert.equal(contractRenewalQuote(old.pair.campaign,person(old.pair.campaign)).available,true);
 const oldPrice=contractQuote(old.pair.campaign,person(old.pair.campaign)).price,oldRecord=structuredClone(record(old.pair.campaign)),oldExpiry=contractExpiresSeconds(old.pair.campaign.contracts[130]);
 old.pair=renewalStep(old.pair,{kind:'campaign',action:{type:'renewContract',id:130,term:'day'}});old.events.push({kind:'campaign',action:{type:'renewContract',id:130,term:'day'}});
 assert.equal(old.pair.campaign.resources.treasury,2528-oldPrice);assert.equal(record(old.pair.campaign).morale,oldRecord.morale+2);assert.equal(contractExpiresSeconds(old.pair.campaign.contracts[130]),oldExpiry+86400);
 assert.deepEqual(custody(old.pair.campaign),custody(low.campaign));
 recoverLowMoraleRenewal(route);
 assert.equal(renewalStamp(route.regroup.campaign)-renewalStamp(low.campaign),21600);assert.equal(route.regroup.campaign.resources.treasury,2276);
 assert.equal(record(route.regroup.campaign).morale,24.700000000000003,'five actual isolated hourly losses precede the real arrival; regroup never refunds them');
 assert.equal(record(route.regroup.campaign).strategicIsolation,undefined);
 assert.equal(renewalStamp(route.recovered.campaign)-renewalStamp(route.regroup.campaign),36*3600);
 refuse(route.beforeRecovery);assert.equal(lowMoraleRenewalStatus(route.recovered.campaign,person(route.recovered.campaign)).blocked,false);
 assert.equal(record(route.recovered.campaign).morale,30.700000000000003);assert.equal(record(route.recovered.campaign).hp,36);assert.equal(record(route.recovered.campaign).bandaged,31);
 assert.equal(record(route.recovered.campaign).bleeding,0);assert.deepEqual(custody(route.recovered.campaign),custody(low.campaign));
 const perform=event=>{route.pair=renewalStep(route.pair,event);route.events.push(structuredClone(event));};
 const recovered=structuredClone(route.pair),q=contractRenewalQuote(recovered.campaign,person(recovered.campaign)),expiry=contractExpiresSeconds(recovered.campaign.contracts[130]);
 assert.equal(q.available,true);assert.equal(q.price,36);
 perform({kind:'campaign',action:{type:'renewContract',id:130,term:'day'}});
 assert.equal(route.pair.campaign.resources.treasury,2240);assert.equal(contractExpiresSeconds(route.pair.campaign.contracts[130]),expiry+86400);
 assert.equal(record(route.pair.campaign).morale,32.7);assert.equal(record(route.pair.campaign).lastMoralePayAt,74);assert.equal(record(route.pair.campaign).lastMoralePaySecond,30);
 assert.deepEqual(custody(route.pair.campaign),custody(recovered.campaign));assert.equal(renewalStamp(route.pair.campaign),renewalStamp(recovered.campaign));assert.equal(route.pair.campaign.seed,recovered.campaign.seed);
 const paid=structuredClone(route.pair),contracts=structuredClone(paid.campaign.contracts);
 perform({kind:'campaign',action:{type:'assignCare',operativeId:130,assignment:'active'}});
 perform({kind:'campaign',action:{type:'visitSector'}});
 const unit=renewalActor(route.pair.battle,130);assert.equal(unit.hp,36);assert.equal(unit.bleeding,0);assert.equal(unit.personalMorale,32.7);assert.equal(unit.loaded+ammoCount(unit),7);assert.equal(unit.condition,97);assert.equal(unit.medkits,1);
 const facing=unit.facing,dx=[0,1,1,1,0,-1,-1,-1][(facing+1)%8],dy=[-1,-1,0,1,1,1,0,-1][(facing+1)%8];
 perform({kind:'tactical',action:{type:'look',unitId:'130',x:unit.x+dx,y:unit.y+dy}});
 perform({kind:'leave'});assert.deepEqual(route.pair.campaign.contracts,contracts);assert.equal(record(route.pair.campaign).morale,32.7);assert.deepEqual(custody(route.pair.campaign),custody(paid.campaign));
 perform({kind:'campaign',action:{type:'visitSector'}});assert.equal(renewalActor(route.pair.battle,130).personalMorale,32.7);assert.equal(renewalActor(route.pair.battle,130).loaded+ammoCount(renewalActor(route.pair.battle,130)),7);perform({kind:'leave'});
 for(const execution of [route,old]){
  let campaign=structuredClone(execution.campaignStart.campaign);
  for(const action of execution.campaignHistory){
   campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
   if(!campaign.pendingBattle)campaign=renewalSaved({campaign}).campaign;
  }
  // The first battlefield admission uses the declared geometry. No earned
  // battle has been moved, reset or substituted during the replay.
  assert.deepEqual(renewalSaved({campaign,battle:execution.start.battle}),execution.start);
  let replay=structuredClone(execution.start);for(const event of execution.events)replay=renewalStep(replay,event);
  assert.deepEqual(replay,execution.pair);assert.deepEqual(renewalSaved(execution.pair),execution.pair);
 }
 assert.deepEqual(route.start,initial);assert.equal(route.pair.campaign.operativeState[110].captured,true);assert.equal(route.pair.campaign.operativeState[110].alive,true);
 t.diagnostic(JSON.stringify({scenario:'Declared seed42 pre-kinetic clinical arena; real native weekly hires, not conquest or a stock ending',prices:route.prices,
  low:{clock:renewalStamp(low.campaign),morale:record(low.campaign).morale,loss:record(low.campaign).strategicIsolation.loss,hp:30,rounds:rounds(low.campaign)},
  regroup:{clock:renewalStamp(route.regroup.campaign),morale:record(route.regroup.campaign).morale,paidArrival:252},
  recovered:{clock:renewalStamp(recovered.campaign),morale:record(recovered.campaign).morale,hp:record(recovered.campaign).hp,restHours:36},
  final:{clock:renewalStamp(route.pair.campaign),morale:record(route.pair.campaign).morale,treasury:route.pair.campaign.resources.treasury,rounds:rounds(route.pair.campaign),condition:record(route.pair.campaign).condition,medkits:record(route.pair.campaign).medkits},
  paidPrefixOrders:route.campaignHistory.length,savedOrders:route.events.length,legacyOrders:old.events.length,legacyMorale:record(old.pair.campaign).morale}));
});
