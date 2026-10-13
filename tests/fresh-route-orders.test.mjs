import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
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

test('the earned mountain paid stage retains the due contract before taking its fresh hire quote and cash baseline',t=>{
 const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url)),name='earned-stock-mountain-recruit-accounting';
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const meta=JSON.parse(fixture(`${name}.provenance.json`)),compressed=fixture(`${name}.campaign.json.gz`),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const start=JSON.parse(raw),original=structuredClone(start);
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,111836);
 assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 assert.ok(start.recruited.includes(133));assert.ok(!start.recruited.includes(132));
 assert.equal(contractExpiresSeconds(start.contracts[133])-start.hour*3600-start.secondOfHour,2328);
 assert.deepEqual(saved(start),start,'The unchanged raw captured campaign must pass official save admission.');
 const {guard,events,current}=guarded(start),renewalQuote=contractQuote(start,rosterFor(start).find(op=>op.id===133),'day');
 assert.equal(renewalQuote.available,true);assert.equal(renewalQuote.price,66);
 guard.retain();
 const retained=current();
 assert.equal(retained.resources.treasury,111770);assert.deepEqual([retained.hour,retained.secondOfHour],[942,177]);
 assert.deepEqual(retained.contracts[133],meta.actualRenewedContract);
 assert.equal(contractExpiresSeconds(retained.contracts[133]),contractExpiresSeconds(start.contracts[133])+86400);
 assert.deepEqual(retained.operativeState[133],{...start.operativeState[133],morale:88,lastMoralePayAt:942});
 assert.deepEqual(saved(retained),retained);
 const quote=contractQuote(retained,rosterFor(retained).find(op=>op.id===132),'day'),cash=retained.resources.treasury;
 assert.equal(quote.available,true);assert.equal(quote.price,7740);assert.equal(quote.guarantee,0);
 const retainedEvents=events.length;guard.retain();
 assert.equal(events.length,retainedEvents,'Repeated retention at the same clock must not debit another renewal.');
 assert.deepEqual(current(),retained);
 guard.order({type:'recruitCivic',id:132,term:'day'});
 const end=current(),actions=events.filter(event=>event.action).map(event=>event.action);
 assert.deepEqual(actions,[{type:'renewContract',id:133,term:'day',expectedExpiresAt:942,expectedExpiresSecond:2505},{type:'recruitCivic',id:132,term:'day'}]);
 assert.equal(end.resources.treasury,cash-quote.price);assert.equal(end.resources.treasury,104030);
 assert.equal(start.resources.treasury-end.resources.treasury,66+7740);
 assert.deepEqual([end.hour,end.secondOfHour],[942,177]);assert.deepEqual(end.contracts[132],meta.actualHiredContract);
 assert.deepEqual(end.contracts[133],meta.actualRenewedContract);
 for(const [id,contract]of Object.entries(start.contracts))if(id!=='133')assert.deepEqual(end.contracts[id],contract);
 assert.deepEqual(end.recruited,[...start.recruited,132]);assert.equal(end.recruited.filter(id=>id===132).length,1);
 assert.deepEqual(end.hiringArrivals,start.hiringArrivals,'The observed stock hire arrives immediately.');
 assert.deepEqual(end.squad,[...start.squad,132]);assert.equal(end.activeSquadId,start.activeSquadId);
 for(const group of start.squads)assert.deepEqual(end.squads.find(q=>q.id===group.id),group.id===start.activeSquadId?{...group,members:[...group.members,132]}:group);
 assert.equal(end.squads.length,start.squads.length);
 for(const [id,record]of Object.entries(start.operativeState)){
  for(const key of ['alive','captured','hp','maxHp','bleeding','bandaged','energy','fatigue','asleep','deathMinute'])assert.deepEqual(end.operativeState[id][key],record[key],`${id} ${key}`);
  const expected=id==='133'?{...record,morale:88,lastMoralePayAt:942}:id==='132'?{...record,...meta.actualHireRecordChanges}:record;
  assert.deepEqual(end.operativeState[id],expected,`${id} native health, equipment and service records`);
 }
 for(const key of ['sectorStates','sceneStates','sectors','artilleryDepots','artilleryTransfers','artillerySelection','missions'])assert.deepEqual(end[key],start[key],key);
 assert.deepEqual(saved(end),end);assert.deepEqual(start,original);
 let repeated=saved(start);
 repeated=ordinary(repeated,actions[0]);repeated=saved(repeated);
 repeated=ordinary(repeated,actions[1]);assert.deepEqual(repeated,end,'Every paid native action must replay exactly across the official midpoint save.');
 const eventCount=events.length;guard.retain();assert.equal(events.length,eventCount);assert.deepEqual(current(),end);
 t.diagnostic(JSON.stringify({scope:meta.scope,inputSha256:meta.rawSha256,clock:[end.hour,end.secondOfHour],renewal:66,hire:7740,treasury:[start.resources.treasury,retained.resources.treasury,end.resources.treasury],morale133:[86,88],paidOrders:actions.length,officialMidpointReplayExact:true}));
});
