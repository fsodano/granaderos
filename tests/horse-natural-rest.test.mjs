import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHorseState,applyHorseAction,MATURITY_HOURS,mountForOperative} from '../game/horses.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {serializeCampaign,restoreCampaign} from '../game/campaign.js';

const horse=(extra={})=>({id:'horse-1',name:'Criollo',sex:'mare',location:'retiro',bornAt:-MATURITY_HOURS,stamina:20,condition:70,feed:0,assignedTo:3,hired:false,hireUntil:null,pregnantUntil:null,...extra});
const horses=(extra={})=>({...initialHorseState(),nextId:2,horses:[horse(extra)]});
const advance=(s,hour)=>{const next=applyHorseAction(s,{type:'advance',hour});assert.equal(next.lastError,null);return next;};

test('owned horses recover through rest without feed depletion or starvation',()=>{
 for(const feed of [0,700]){
  const before=horses({feed}),s=advance(before,72),h=s.horses[0];
  assert.equal(h.condition,73);assert.equal(h.stamina,50);assert.equal(h.feed,feed);assert.equal(s.cost,0);
  assert.equal(before.horses[0].condition,70,'advancement does not mutate its input');
  let hourly=before;for(let hour=1;hour<=72;hour++)hourly=advance(hourly,hour);
  assert.deepEqual(hourly,s,'ordinary hourly advancement gives the same rest as one checkpoint');
 }
 const s=advance(horses({condition:99,stamina:95}),240);
 assert.equal(s.horses[0].condition,100);assert.equal(s.horses[0].stamina,100);
});

test('old feed and pregnancy fields round-trip but neither advances production',()=>{
 const s=initialCampaign();s.horseState=horses({feed:7,pregnantUntil:24});
 const restored=restoreCampaign(serializeCampaign(s));assert.deepEqual(restored.horseState,s.horseState);
 const after=advance(restored.horseState,48);
 assert.equal(after.horses.length,1);assert.equal(after.nextId,2);
 assert.equal(after.horses[0].feed,7);assert.equal(after.horses[0].pregnantUntil,24);assert.deepEqual(after.log,[]);
});

test('custody, paid lease expiry and finite riding stamina remain enforced',()=>{
 const held=horses({custody:{kind:'captured',sector:'retiro',operativeId:3},pregnantUntil:24});
 assert.deepEqual(advance(held,48).horses,held.horses);
 const lease=advance(horses({hired:true,hireUntil:24}),24);
 assert.equal(lease.horses[0].returned,true);assert.equal(lease.horses[0].assignedTo,null);assert.equal(mountForOperative(lease,3),null);
 const ridden=applyHorseAction(horses(),{type:'ride',horseId:'horse-1',operativeId:3,hours:2,ridingSkill:0,destination:'ensenada'});
 assert.equal(ridden.lastError,null);assert.equal(ridden.horses[0].stamina,14);assert.equal(ridden.horses[0].location,'ensenada');
 assert.equal(mountForOperative(ridden,3).canMount,false);
 assert.match(applyHorseAction(ridden,{type:'ride',horseId:'horse-1',operativeId:3,hours:10,ridingSkill:0}).lastError,/agotada/);
});
