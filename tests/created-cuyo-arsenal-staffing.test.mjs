import assert from 'node:assert/strict';
import test from 'node:test';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {returnCreatedCuyoArsenalPhysician} from './created-cuyo-artillery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};

// Declared established-territory subsystem arena. All personnel, terms and
// rural positions below come from public hire, squad and travel orders.
// This is not a fresh campaign, arsenal victory or earned-input fixture.
function staffingArena({depart=true}={}){
 let c=secureArea(initialCampaign(8),'mendoza');
 c=order(c,{type:'recruitCivic',id:100,term:'day',destination:'mendoza'});
 c=order(c,{type:'createSquad',name:'Asamblea local',ids:[100],sector:'mendoza'});const original=c.activeSquadId;
 for(const id of [116,101])c=order(c,{type:'recruitCivic',id,term:'day',destination:'mendoza'});
 c=order(c,{type:'createSquad',name:'Médico y acompañante',ids:[116,101],sector:'mendoza'});const remote=c.activeSquadId;
 if(depart){
  c=order(c,{type:'travel',sector:'cell-6-24',mode:'march',queue:true});
  for(let attempt=0;attempt<8&&c.squads.find(q=>q.id===remote).journey;attempt++)c=order(c,{type:'wait',hours:1});
  assert.equal(c.squads.find(q=>q.id===remote).journey,undefined);assert.equal(c.squads.find(q=>q.id===remote).location,'cell-6-24');
 }
 c=order(c,{type:'selectSquad',id:original});return {campaign:saved(c),original,remote};
}

function assertRecordedReplay(start,result,events){
 const actions=events.filter(event=>event.event==='freshRouteOrder'||event.event==='freshRouteRenewal').map(event=>event.action);
 let replay=saved(start);
 for(const [index,action]of actions.entries()){
  replay=order(replay,action);
  if(index===Math.floor(actions.length/2)){const before=structuredClone(replay);replay=saved(replay);assert.deepEqual(replay,before);}
 }
 assert.deepEqual(replay,result.campaign,'Every actual return and retention order replays through the official midpoint save.');
 assert.deepEqual(saved(result.campaign),result.campaign);return actions;
}

test('an existing qualified local physician preserves the exact campaign without route orders',()=>{
 const {campaign:start}=staffingArena({depart:false}),before=structuredClone(start),events=[];
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)});
 assert.equal(result.returned,false);assert.equal(result.physician,116);assert.equal(result.campaign,start);
 assert.deepEqual(events,[]);assert.deepEqual(start,before);
});

test('the whole existing physician squad makes its real two-hour return without adding morale, supplies or readiness',()=>{
 const {campaign:start,original,remote}=staffingArena(),before=structuredClone(start),events=[];
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.returned,true);assert.equal(result.physician,116);
 const receipt=events.find(event=>event.event==='createdCuyoArsenalPhysicianReturned');assert.ok(receipt);
 assert.deepEqual(receipt.plan.members,[116,101]);assert.deepEqual(receipt.plan.journey.path,['cell-6-24','mendoza']);assert.equal(receipt.plan.hours,2);assert.equal(receipt.seconds,7200);
 assert.equal(clock(c)-clock(start),7200);assert.equal(c.resources.treasury,start.resources.treasury);
 assert.equal(c.activeSquadId,original);assert.deepEqual(c.squad,start.squad);assert.equal(c.location,'mendoza');
 assert.deepEqual(c.squads.find(q=>q.id===remote).members,[116,101]);assert.equal(c.squads.find(q=>q.id===remote).journey,undefined);
 for(const id of [116,101]){
  assert.equal(c.operativeState[id].location,'mendoza');assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].bleeding,0);
  for(const key of ['medkits','inventory','loaded','ammo','ammoStock','condition','weaponMetadata','weaponInstanceId'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
  assert.equal(c.operativeState[id].morale,start.operativeState[id].morale);assert.ok(c.operativeState[id].fatigue>start.operativeState[id].fatigue);assert.ok(c.operativeState[id].energy<100);
 }
 assert.deepEqual(c.artilleryDepots,start.artilleryDepots);assert.deepEqual(c.artilleryTransfers,start.artilleryTransfers);assert.deepEqual(c.sectorStates,start.sectorStates);
 assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);
 const actions=assertRecordedReplay(start,result,events);assert.equal(actions.filter(action=>action.type==='travel').length,1);assert.ok(actions.filter(action=>action.type==='wait').every(action=>action.hours===1));
 const again=returnCreatedCuyoArsenalPhysician(start);assert.deepEqual(again,result);assert.deepEqual(start,before);
});

test('the real return retains every serving term with exact quoted native debits and expiry fields',()=>{
 const arena=staffingArena();let start=arena.campaign;
 for(let attempt=0;attempt<28&&start.hour<22;attempt++)start=order(start,{type:'wait',hours:1});assert.equal(start.hour,22);
 const before=structuredClone(start),events=[],quotes=new Map(start.recruited.map(id=>[id,contractRenewalQuote(start,rosterFor(start).find(op=>op.id===id),'day')]));
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),c=result.campaign;
 const paid=events.filter(event=>event.event==='freshRouteRenewal');assert.deepEqual(paid.map(event=>event.id),start.recruited);
 for(const event of paid){
  const quote=quotes.get(event.id);assert.equal(quote.available,true);assert.equal(event.price,quote.price);assert.equal(contractExpiresSeconds(c.contracts[event.id]),contractExpiresSeconds(start.contracts[event.id])+86400);
  assert.ok(c.recruited.includes(event.id)&&c.operativeState[event.id].alive);assert.equal(c.operativeState[event.id].hp,start.operativeState[event.id].hp);
 }
 assert.equal(c.resources.treasury,start.resources.treasury-paid.reduce((sum,event)=>sum+event.price,0));assert.equal(clock(c)-clock(start),7200);
 assertRecordedReplay(start,result,events);assert.deepEqual(start,before);
});

test('a sleeping physician cannot turn a refused public route into an admitted staffing position',()=>{
 const arena=staffingArena(),start=order(arena.campaign,{type:'setSleep',operativeId:116,asleep:true}),before=structuredClone(start),events=[];
 assert.throws(()=>returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),/healthy serving physician.*existing squad route/);
 assert.deepEqual(start,before);assert.deepEqual(events,[]);assert.equal(start.operativeState[116].location,'cell-6-24');
});
