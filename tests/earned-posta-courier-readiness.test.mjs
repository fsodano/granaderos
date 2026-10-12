import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';
import {transportPath} from '../game/logistics.js';
import {dailyTownIncome} from '../game/town-income.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameSurface} from '../game/tactical-space.js';
import {order,visit,sync,leave} from './local-contract-fixture.mjs';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clock=s=>s.hour*3600+(s.secondOfHour??0);
const admitted=s=>decodeSave(encodeSave(s)).campaign;
function earnedInput(){
 const stem='./fixtures/earned-posta-sleeping-courier-336',metadata=JSON.parse(readFileSync(new URL(`${stem}.provenance.json`,import.meta.url)));
 const compressed=readFileSync(new URL(`${stem}.save.json.gz`,import.meta.url)),raw=gunzipSync(compressed);
 assert.equal(sha(raw),metadata.rawSha256);assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(raw.length,metadata.rawBytes);
 const s=decodeSave(raw.toString()).campaign;assert.deepEqual([s.hour,s.secondOfHour],metadata.clock);assert.equal(s.operativeState[146].asleep,true);assert.equal(s.routes.posta,false);
 const fee=TRANSPORT_NETWORKS.find(n=>n.id==='posta').cost,cash=s.resources.treasury,unlocked=order(s,{type:'transport',mode:'posta'});
 assert.equal(unlocked.resources.treasury,cash-fee);assert.equal(unlocked.routes.posta,true);assert.equal(clock(unlocked),clock(s));return admitted(unlocked);
}
const cacheStock=s=>s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.find(p=>p.item==='medkits').count;

for(const awake of [false,true])test(`the earned ${awake?'awake exhausted':'sleeping'} doctor completes paid posta readiness and can recover actual local stock`,t=>{
 let start=earnedInput();if(awake)start=admitted(order(start,{type:'setSleep',operativeId:146,asleep:false}));
 const before=structuredClone(start),events=[];
 assert.equal(start.operativeState[146].energy,14);assert.equal(start.operativeState[146].fatigue,80);assert.ok(contractExpiresSeconds(start.contracts[146])-clock(start)<7*3600);
 assert.equal(previewStrategicRoute(start,start.activeSquadId,'retiro','posta').valid,false);
 const result=collectRouteMedicalSupplies(start,146,3,{mode:'posta',report:event=>events.push(event)}),end=result.campaign;
 const began=events.find(e=>e.event==='medicalCourierRestStarted'),ready=events.find(e=>e.event==='medicalCourierReady');
 assert.ok(began&&ready);assert.ok(ready.restHours>7);assert.equal(clock(ready.campaign)-clock(began.campaign),ready.elapsedSeconds);
 assert.equal(ready.campaign.operativeState[146].asleep,false);assert.equal(ready.campaign.operativeState[146].energy,100);assert.equal(ready.campaign.operativeState[146].fatigue,0);
 assert.equal(ready.campaign.location,'cordoba');assert.equal(ready.campaign.operativeState[146].medkits,0);
 const readiness=[];let recording=false;
 for(const event of events){if(event===began)recording=true;else if(event===ready)break;else if(recording&&(event.event==='medicalCourierRestOrder'||event.event==='medicalCourierRenewal'))readiness.push(event.action);}
 let replay=admitted(began.campaign),waits=0;
 for(const action of readiness){
  if(action.type==='renewContract'){
   const old=replay.contracts[action.id],quote=contractRenewalQuote(replay,rosterFor(replay).find(op=>op.id===action.id),'day'),cash=replay.resources.treasury;
   assert.equal(action.expectedExpiresAt,old.expiresAt);assert.equal(action.expectedExpiresSecond,old.expiresSecond??0);
   replay=order(replay,action);assert.equal(replay.resources.treasury,cash-quote.price);assert.equal(replay.contracts[action.id].expiresAt,quote.expiresAt);assert.equal(replay.contracts[action.id].expiresSecond??0,quote.expiresSecond??0);
  }else{replay=order(replay,action);if(action.type==='wait'&&++waits===4)replay=admitted(replay);}
 }
 assert.deepEqual(admitted(replay),ready.campaign,'The actual rest and paid renewals replay through an official midpoint save.');
 const readinessRenewals=events.filter(e=>e.event==='medicalCourierRenewal'&&e.phase==='readiness');assert.ok(readinessRenewals.some(e=>e.id===146));assert.ok(readinessRenewals.some(e=>e.id!==146),'Remote and local paid survivors are retained before rest.');
 const localStock=s=>sectorInventoryModel(s,'cordoba',rosterFor(s),146).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
 assert.equal(result.collected,3);assert.equal(localStock(ready.campaign)-localStock(end),3,'The actual local dressing source is debited once.');
 assert.equal(events.some(e=>e.event==='finiteMedicalCourier'),false,'Rest makes the local finite source accessible before a remote journey is planned.');assert.equal(cacheStock(end),cacheStock(start));assert.equal(clock(end)-clock(start),ready.elapsedSeconds);
 const renewals=events.filter(e=>e.event==='medicalCourierRenewal'),cost=renewals.reduce((n,e)=>n+e.cost,0),income=(end.townIncome.lastPaidDay-start.townIncome.lastPaidDay)*dailyTownIncome(start);
 assert.equal(end.resources.treasury,start.resources.treasury-cost+income);assert.ok(cost>0);
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){assert.equal(end.operativeState[id].alive,true);assert.ok(end.recruited.includes(id));assert.equal(end.operativeState[id].location,start.operativeState[id].location);assert.ok(contractExpiresSeconds(end.contracts[id])===null||contractExpiresSeconds(end.contracts[id])>clock(end));assert.equal(end.operativeState[id].medkits,start.operativeState[id].medkits+(id===146?3:0));}
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(end.operativeState[id].alive,false);
 for(const id of [125,144]){assert.equal(end.operativeState[id].bleeding,0);assert.ok(end.operativeState[id].hp>=start.operativeState[id].hp&&end.operativeState[id].hp<end.operativeState[id].maxHp,'The distant courier keeps the real patients and their remaining wounds.');}
 assert.deepEqual(end.loadouts,start.loadouts);assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(end.squad,start.squad);assert.deepEqual(admitted(end),end);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({awakeExhausted:awake,restHours:ready.restHours,restSeconds:ready.elapsedSeconds,renewalCost:cost,income,clock:[end.hour,end.secondOfHour],localSourceDebit:3,retainedRemoteCache:cacheStock(end),officialRestReplay:true}));
});

test('an earned posted clinic spends real movement energy, sleeps, then pays current posta fees for four finite remote dressings',t=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/earned-installed-mountain-medical-courier.campaign.json.gz',import.meta.url))),metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-installed-mountain-medical-courier.provenance.json',import.meta.url)));
 assert.equal(sha(raw),metadata.rawSha256);let c=admitted(JSON.parse(raw));const home=c.squads.find(q=>q.members.includes(112)).id;
 c=order(c,{type:'assignCare',id:112,assignment:'active'});c=order(c,{type:'createSquad',ids:[112],name:'Descanso del médico',sector:'mendoza'});
 let p=visit(c);const actor=p.battle.units.find(u=>u.id==='112'),tile=getReachable(p.battle,actor).filter(tile=>sameSurface(tile,actor)&&(tile.x!==actor.x||tile.y!==actor.y)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(tile);
 const battle=actBattle(p.battle,{type:'move',unitId:actor.id,x:tile.x,y:tile.y,level:tile.level});assert.equal(battle.lastError,null);p=sync({campaign:p.campaign,battle});c=leave(p);
 assert.ok(c.operativeState[112].energy<100,'A real tactical move spends the physician\'s energy.');c=order(c,{type:'assignToSquad',operativeId:112,squadId:home});c=admitted(order(c,{type:'setSleep',operativeId:112,asleep:true}));
 const start=c,before=structuredClone(start),events=[],result=collectRouteMedicalSupplies(start,112,4,{mode:'posta',report:e=>events.push(e)}),end=result.campaign;
 const ready=events.find(e=>e.event==='medicalCourierReady'),trip=events.find(e=>e.event==='finiteMedicalCourier');assert.ok(ready&&trip);assert.ok(ready.restHours>0);
 assert.deepEqual(trip.outward,previewStrategicRoute(ready.campaign,ready.campaign.activeSquadId,'retiro','posta'),'The fresh departure quote follows native sleep completion.');assert.equal(trip.returning.valid,true);
 const stock=s=>s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.find(p=>p.item==='medkits').count;assert.equal(stock(start),11);assert.equal(stock(end),7);assert.equal(result.collected,4);
 assert.equal(end.operativeState[112].medkits,start.operativeState[112].medkits+4);assert.equal(end.operativeState[112].asleep,false);assert.equal(clock(end)-clock(start),ready.elapsedSeconds+trip.elapsedSeconds);
 const cost=events.filter(e=>e.event==='medicalCourierRenewal').reduce((n,e)=>n+e.cost,0),fees=(trip.outward.path.length+trip.returning.path.length-2)*10,income=(end.townIncome.lastPaidDay-start.townIncome.lastPaidDay)*dailyTownIncome(start);
 assert.equal(fees,60);assert.equal(end.resources.treasury,start.resources.treasury-cost-fees+income);assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(end.squad,start.squad);assert.deepEqual(end.loadouts,start.loadouts);
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){assert.equal(end.operativeState[id].alive,true);assert.ok(end.recruited.includes(id));assert.equal(end.operativeState[id].location,start.operativeState[id].location);assert.ok(contractExpiresSeconds(end.contracts[id])===null||contractExpiresSeconds(end.contracts[id])>clock(end));if(id!==112)assert.equal(end.operativeState[id].medkits,start.operativeState[id].medkits);}
 assert.equal(end.operativeState[134].bleeding,0);assert.ok(end.operativeState[134].hp<end.operativeState[134].maxHp);for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(end.operativeState[id].alive,false);
 assert.deepEqual(admitted(end),end);assert.deepEqual(start,before);t.diagnostic(JSON.stringify({nativeMoveSeconds:battle.elapsedSeconds,restHours:ready.restHours,journeySeconds:trip.elapsedSeconds,fees,renewalCost:cost,source:[11,7],clock:[end.hour,end.secondOfHour]}));
});

test('a native occupation during paid rest cuts the old medical path before a new courier quote',t=>{
 const control=earnedInput();assert.deepEqual(transportPath(control,'cordoba','retiro'),['cordoba','buenos_aires','retiro']);
 // Declared marching-column control before admission. Actual shared reserve
 // and arrival rules occupy the unguarded town while the doctor sleeps.
 assert.deepEqual(control.sectors.buenos_aires.militia,[0,0,0]);
 const group=launchEnemyGroup(control,'interior','buenos_aires');assert.ok(group);const start=admitted(control),before=structuredClone(start),events=[];
 const local=collectRouteMedicalSupplies(start,146,100,{mode:'posta',report:e=>events.push(e)}),s=local.campaign,ready=events.find(e=>e.event==='medicalCourierReady');
 assert.ok(ready);assert.ok(s.hour>=group.arrivalAt);assert.equal(s.pendingEncounter,null);assert.equal(s.sectors.buenos_aires.owner,'royalist');assert.equal(s.enemyGroups.find(g=>g.id===group.id).status,'stationed');
 assert.equal(transportPath(s,'cordoba','retiro'),null);assert.ok(local.collected>0);assert.equal(cacheStock(s),6);
 const localRows=sectorInventoryModel(s,'cordoba',rosterFor(s),146).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.deepEqual(localRows,[],'The first collection exhausts only actual reachable local stock.');
 let failure;try{collectRouteMedicalSupplies(s,146,1,{mode:'posta'});}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/no controlled finite medical source/);assert.equal(clock(failure.campaign),clock(s));assert.equal(failure.campaign.resources.treasury,s.resources.treasury);assert.equal(cacheStock(failure.campaign),6);
 assert.equal(events.some(e=>e.event==='finiteMedicalCourier'),false);for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){assert.equal(s.operativeState[id].alive,true);assert.ok(s.recruited.includes(id));assert.ok(contractExpiresSeconds(s.contracts[id])===null||contractExpiresSeconds(s.contracts[id])>clock(s));}
 assert.deepEqual(admitted(failure.campaign),failure.campaign);assert.deepEqual(start,before);t.diagnostic(JSON.stringify({scope:'Declared finite enemy column; native timed occupation and source-path refusal, no battle or full-route claim',arrivalHour:group.arrivalAt,restHours:ready.restHours,localDressings:local.collected,remoteDressings:cacheStock(s),occupation:'buenos_aires'}));
});

function incomingRestWave(){
 // Declared marching-column control before initial admission. Shared finite
 // reserve and arrival rules create a real interruption after six rest hours.
 const s=earnedInput(),group=launchEnemyGroup(s,'interior','cordoba');assert.ok(group);return {start:admitted(s),group};
}
test('a real finite enemy arrival interrupts posta readiness and retains the exact stopped state',()=>{
 const {start,group}=incomingRestWave(),before=structuredClone(start);let failure;
 try{collectRouteMedicalSupplies(start,146,3,{mode:'posta'});}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/resolve the actual medical courier encounter/);const s=failure.campaign;
 assert.equal(s.pendingEncounter.groupId,group.id);assert.equal(s.pendingEncounter.sector,'cordoba');assert.equal(s.hour,group.arrivalAt);assert.equal(s.enemyGroups.find(g=>g.id===group.id).status,'waiting');
 assert.equal(cacheStock(s),cacheStock(start));assert.equal(s.operativeState[146].medkits,0);assert.deepEqual(admitted(s),s);assert.deepEqual(start,before);
});

test('the supplied resolver uses the native retreat and courier readiness refuses its changed clinic',()=>{
 const {start,group}=incomingRestWave(),before=structuredClone(start);let failure,calls=0,returned;
 try{collectRouteMedicalSupplies(start,146,3,{mode:'posta',resolveEncounter:s=>{calls++;assert.equal(s.pendingEncounter.groupId,group.id);returned=order(s,{type:'respondToEncounter',groupId:group.id,choice:'retreat',destination:'buenos_aires'});return admitted(returned);}});}catch(error){failure=error;}
 assert.equal(calls,1);assert.ok(failure);assert.match(failure.message,/return the courier to the clinic/);const s=failure.campaign;
 assert.equal(s.pendingEncounter,null);assert.equal(s.pendingBattle,null);assert.equal(s.sectors.cordoba.owner,'royalist');assert.equal(s.operativeState[146].location,'buenos_aires');assert.equal(s.enemyGroups.find(g=>g.id===group.id).status,'stationed');
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){assert.equal(s.operativeState[id].alive,true);assert.equal(s.operativeState[id].medkits,start.operativeState[id].medkits);}for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(s.operativeState[id].alive,false);
 assert.equal(cacheStock(s),cacheStock(start));assert.equal(clock(s),clock(returned));assert.deepEqual(admitted(s),s);assert.deepEqual(start,before);
});
