import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';

const ordinary=(s,action)=>{
 const next=dispatchCampaign(s,action);
 assert.equal(next.lastError,null,next.lastError);
 return next;
};
const saved=s=>decodeSave(encodeSave(s)).campaign;

// Declared immediate-arrival candidates isolate the route guard. This is not
// an earned opening, funded province, or full campaign acceptance fixture.
function hired({acute=false}={}){
 const content=defaultContentPackage();
 for(const id of [110,116])content.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 if(acute)content.characters.find(c=>c.id==='person-110').startingCondition={hp:8,energy:100,fatigue:0,bleeding:4,bandaged:0};
 let s=ordinary(initialCampaign(45,content),{type:'advanceStrategicTime',seconds:121});
 for(const id of [110,116])s=ordinary(s,{type:'recruitCivic',id,term:'day'});
 return saved(s);
}
function guarded(start){
 let campaign=structuredClone(start);const events=[];
 const guard=createFreshRouteOrders(()=>campaign,next=>{campaign=next;},{report:event=>events.push(event)});
 return {guard,events,current:()=>campaign};
}
function replay(start,events){
 let s=structuredClone(start);
 for(const event of events)if(event.action)s=ordinary(s,event.action);
 return s;
}

test('route waits retain paid survivors outside the active squad at their exact expiry seconds',()=>{
 let start=hired();const active=start.activeSquadId;
 start=ordinary(start,{type:'createSquad',name:'Reserva',ids:[116],sector:'retiro'});
 start=ordinary(start,{type:'selectSquad',id:active});
 assert.deepEqual(start.squad,[110]);
 const original=structuredClone(start),{guard,events,current}=guarded(start),deadline=contractExpiresSeconds(start.contracts[110]);
 const prices=[110,116].reduce((sum,id)=>sum+contractQuote(start,rosterFor(start).find(op=>op.id===id),'day').price,0);
 for(let i=0;i<30&&current().hour*3600+(current().secondOfHour??0)<deadline+3600;i++)guard.order({type:'wait',hours:1});
 const result=current();
 assert.ok(result.hour*3600+(result.secondOfHour??0)>=deadline+3600);
 for(const id of [110,116]){
  assert.ok(result.recruited.includes(id));assert.equal(result.operativeState[id].alive,true);
  assert.equal(contractExpiresSeconds(result.contracts[id]),deadline+24*3600);
  for(const key of ['hp','bleeding','medkits','ammo','carriedLoaded','condition'])assert.equal(result.operativeState[id][key],start.operativeState[id][key]);
 }
 assert.equal(result.resources.treasury,start.resources.treasury-prices);
 assert.deepEqual(saved(result),result);assert.deepEqual(replay(start,events),result);
 assert.deepEqual(start,original);
});

test('route care uses finite hourly dressings and blocks an acute clock advance after the doctor runs out',()=>{
 const start=hired({acute:true}),{guard,events,current}=guarded(start);
 assert.throws(()=>guard.order({type:'wait',hours:1}),/acute survivor 110/);
 assert.deepEqual(current(),start);
 guard.order({type:'assignCare',id:110,assignment:'patient'});
 guard.order({type:'assignCare',id:116,assignment:'doctor'});
 guard.order({type:'wait',hours:1});
 assert.equal(current().operativeState[110].bleeding,0);
 assert.equal(current().operativeState[110].hp,8);
 assert.equal(current().operativeState[116].medkits,1);
 guard.order({type:'wait',hours:1});
 assert.ok(current().operativeState[110].hp>8&&current().operativeState[110].hp<15);
 assert.equal(current().operativeState[116].medkits,0);
 const stopped=structuredClone(current());
 assert.throws(()=>guard.order({type:'wait',hours:1}),/acute survivor 110/);
 assert.deepEqual(current(),stopped);assert.deepEqual(saved(stopped),stopped);
 assert.deepEqual(replay(start,events),stopped);
 assert.equal(stopped.resources.treasury,start.resources.treasury);
});

test('a legal sector entry remains recorded when later route preparation stops for its tactical report',()=>{
 const start=hired(),{guard,events,current}=guarded(start);
 guard.order({type:'visitSector'});
 const entered=structuredClone(current());
 assert.ok(entered.pendingBattle);
 assert.throws(()=>guard.order({type:'wait',hours:1}),/tactical report/);
 assert.deepEqual(current(),entered);
 assert.deepEqual(events.filter(e=>e.action).map(e=>e.action),[{type:'visitSector'}]);
 assert.deepEqual(replay(start,events),entered);
 const battle=enterSector(entered.pendingBattle,entered.sectorStates.retiro);
 const restored=decodeSave(encodeSave(entered,battle));
 assert.deepEqual(restored.campaign,entered);assert.deepEqual(restored.battle,battle);
 assert.equal(entered.resources.treasury,start.resources.treasury);
});
