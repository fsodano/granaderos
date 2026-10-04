import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {collectRouteItems,repairRouteFirearms} from './finite-route-equipment.mjs';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {actBattle,getReachable,reprimePlan,reloadCost} from '../game/tactical.js';
import {sameSurface} from '../game/tactical-space.js';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {stockAndCarriedAmmo} from './ammunition-balance.mjs';

test('finite route discovery uses an actual carrier and restores local care roles without healing or replenishment',()=>{
 let s=initialCampaign();s.operativeState[3].hp-=30;s.operativeState[3].bandaged=30;
 s=order(s,{type:'assignCare',id:10,assignment:'doctor'});s=order(s,{type:'assignCare',id:3,assignment:'patient'});
 const input=s,before=structuredClone(s),cash=s.resources.treasury;
 const result=collectRouteItems(s,10,{kind:'repair-kit'},1);s=result.campaign;
 assert.deepEqual(before.operativeState[3].hp,s.operativeState[3].hp);assert.equal(s.operativeState[10].assignment,'doctor');assert.equal(s.operativeState[3].assignment,'patient');assert.equal(s.operativeState[10].medkits,2);assert.equal(s.resources.treasury,cash);assert.equal(repairMaterialPoints(s.operativeState[10]),100);
 assert.ok(s.hour*3600+(s.secondOfHour??0)>before.hour*3600+(before.secondOfHour??0),'the actual discovery walk spends time');assert.deepEqual(input,before,'finite collection does not mutate the input checkpoint');
 assert.equal(s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.some(stack=>stack.kind==='repair-kit'),false);assert.deepEqual(saved({campaign:s}).campaign,s);
 const checkpoint=structuredClone(s);assert.throws(()=>collectRouteItems(s,10,{kind:'repair-kit'},1),/finite local equipment/);assert.deepEqual(s,checkpoint);
});

test('finite cache discovery reaches a ground chest through its door instead of its reachable roof',t=>{
 // Declared older local-service checkpoint. Control and physical locality are
 // fixed before admission; the authored Tucumán building and stock are intact.
 let s=initialCampaign(42);s.sectors.tucuman.owner='patriot';s.location='tucuman';s.squads[0].location='tucuman';for(const id of s.recruited)s.operativeState[id].location='tucuman';s=saved({campaign:s}).campaign;
 s=order(s,{type:'createSquad',ids:[10],name:'Portador local',sector:'tucuman'});
 const p=visit(s),before=structuredClone(p),u=p.battle.units.find(u=>u.id==='10'),cacheId='tucuman:building:chest:14:7',chest=p.battle.props.find(prop=>prop.id===cacheId);
 const xyAdjacent=getReachable(p.battle,u).filter(tile=>Math.abs(tile.x-chest.x)+Math.abs(tile.y-chest.y)===1).sort((a,b)=>a.cost-b.cost);
 assert.ok(xyAdjacent.length);assert.equal(sameSurface(xyAdjacent[0],chest),false,'the cheapest XY neighbor is on the roof, above the closed ground chest');
 const rejected=actBattle(p.battle,{type:'move',unitId:u.id,x:xyAdjacent[0].x,y:xyAdjacent[0].y});assert.ok(rejected.lastError,'dropping that roof level reproduces the old invalid ground move');assert.equal(rejected.elapsedSeconds,p.battle.elapsedSeconds);assert.equal(rejected.seed,p.battle.seed);assert.deepEqual(rejected.units,p.battle.units);
 const q=takeFiniteCache(p,10,[{item:'medkits',count:2}]),carrier=q.battle.units.find(u=>u.id==='10'),opened=q.battle.props.find(prop=>prop.id===cacheId);
 assert.deepEqual(p,before);assert.deepEqual(q,takeFiniteCache(saved(before),10,[{item:'medkits',count:2}]),'the official initial save replays the same paid collection');assert.ok(sameSurface(carrier,opened));assert.equal(opened.open,true);assert.equal(opened.knownToPlayer,true);assert.equal(carrier.medkits,u.medkits+2);assert.equal(opened.contents.find(item=>item.item==='medkits').count,10);assert.ok(q.battle.tiles.some(tile=>tile.type==='door'&&tile.buildingId===opened.buildingId&&tile.open&&!p.battle.tiles.find(prior=>prior.x===tile.x&&prior.y===tile.y).open),'an ordinary door order opens the actual building entrance');
 assert.ok(q.battle.elapsedSeconds>p.battle.elapsedSeconds);assert.equal(carrier.hp,u.hp);assert.equal(carrier.bleeding,u.bleeding);assert.equal(q.campaign.resources.treasury,p.campaign.resources.treasury);assert.equal(stockAndCarriedAmmo(q.campaign),stockAndCarriedAmmo(p.campaign));
 const returned=leaveFiniteCache(q),again=visit(returned);assert.equal(again.battle.props.find(prop=>prop.id===cacheId).contents.find(item=>item.item==='medkits').count,10,'return and reentry preserve the finite source debit');assert.equal(again.battle.units.find(u=>u.id==='10').medkits,u.medkits+2);assert.deepEqual(saved({campaign:returned}).campaign,returned);
 t.diagnostic(JSON.stringify({scenario:'declared controlled Tucumán local-service checkpoint',roofCandidate:{x:xyAdjacent[0].x,y:xyAdjacent[0].y,level:xyAdjacent[0].tacticalLevel},groundCarrier:{x:carrier.x,y:carrier.y,level:carrier.tacticalLevel??0},paidSeconds:q.battle.elapsedSeconds-p.battle.elapsedSeconds,dressingsTaken:2,chestDressingsRemaining:10,cash:returned.resources.treasury}));
});

test('finite route wear repair preserves ignition failure for paid reprime and revalidates after collection',t=>{
 // Declared older service checkpoint, admitted before any route order.
 // Its existing rounds and worn, failed pan remain finite owned equipment.
 let s=initialCampaign();s.operativeState[4].condition=80;s.operativeState[4].jammed=true;s=saved({campaign:s}).campaign;
 const original=structuredClone(s),cash=s.resources.treasury,rounds=stockAndCarriedAmmo(s);
 s=repairRouteFirearms(s,[4]);assert.equal(s.operativeState[4].condition,100);assert.equal(s.operativeState[4].jammed,true);assert.equal(s.resources.treasury,cash);assert.equal(stockAndCarriedAmmo(s),rounds);
 const remaining=Object.values(s.operativeState).reduce((sum,r)=>sum+repairMaterialPoints(r),0);assert.equal(remaining,80);assert.ok(s.hour>0);assert.deepEqual(saved({campaign:s}).campaign,s);
 const chest=s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache');assert.equal(chest.contents.some(stack=>stack.kind==='repair-kit'),false);
 assert.equal(original.operativeState[4].condition,80);assert.equal(original.operativeState[4].jammed,true);
 const repaired=structuredClone(s);assert.equal(repairRouteFirearms(s,[4]),s,'a full-condition failed pan needs no further mechanical work');assert.deepEqual(s,repaired);
 // Compare the route continuation with those same normal tactical orders.
 let p=visit(s),u=p.battle.units.find(u=>u.id==='4');const pan=reprimePlan(u,p.battle),before=structuredClone(u),startSeconds=p.battle.elapsedSeconds;
 assert.equal(pan.reason,'');assert.ok(pan.pa>0);p.battle=actBattle(p.battle,{type:'reprime',unitId:u.id});assert.equal(p.battle.lastError,null);
 u=p.battle.units.find(u=>u.id==='4');const reprimeSeconds=p.battle.elapsedSeconds-startSeconds;
 assert.equal(reprimeSeconds,Math.max(1,Math.ceil(pan.pa*.06)));assert.equal(u.ap,before.ap);assert.equal(u.jammed,false);assert.equal(u.loaded+u.ammo,before.loaded+before.ammo);assert.equal(u.hp,before.hp);assert.equal(u.bleeding,before.bleeding);
 const reloadPA=reloadCost(u,p.battle),reloadStart=p.battle.elapsedSeconds;p.battle=actBattle(p.battle,{type:'reload',unitId:u.id});assert.equal(p.battle.lastError,null);assert.equal(p.battle.elapsedSeconds-reloadStart,Math.max(1,Math.ceil(reloadPA*.06)));
 const expected=leave(sync(p)),events=[],ready=finishReloadsBeforeMarch(s,{report:e=>events.push(e)});
 assert.deepEqual(ready,expected,'premarch completion uses exactly the paid reprime and reload orders');assert.deepEqual(s,repaired);assert.equal(ready.resources.treasury,cash);assert.equal(stockAndCarriedAmmo(ready),rounds);assert.equal(ready.operativeState[4].jammed,false);assert.equal(ready.operativeState[4].carriedLoaded,2);assert.equal(Object.values(ready.operativeState).reduce((sum,r)=>sum+repairMaterialPoints(r),0),80);assert.ok(events.some(e=>e.event==='finishedReprime'&&e.id===4));assert.deepEqual(saved({campaign:ready}).campaign,ready);
 // A different declared older checkpoint has one already assigned repair.
 // The sector visit pauses that work. After collection its current worker
 // must use the existing reserve, without a competing second assignment.
 let pending=initialCampaign();pending.secondOfHour=3599;pending.operativeState[4].condition=99;pending.operativeState[4].toolkitPoints=1;pending=saved({campaign:pending}).campaign;
 pending=order(pending,{type:'createSquad',ids:[3],name:'Portador',sector:'retiro'});pending=order(pending,{type:'assignWork',operativeId:4,assignment:'repair',targetId:4,repairScope:'primary'});
 const collecting=structuredClone(pending),settled=repairRouteFirearms(pending,[4]);
 assert.deepEqual(pending,collecting);assert.equal(settled.operativeState[4].condition,100);assert.equal(settled.operativeState[4].toolkitPoints,0);assert.equal(repairMaterialPoints(settled.operativeState[10]),100,'the actual assigned worker must debit its existing point, preserving the newly found kit');assert.equal(settled.operativeState[10].assignment,'active');assert.ok(settled.hour>pending.hour);assert.equal(stockAndCarriedAmmo(settled),stockAndCarriedAmmo(pending));assert.deepEqual(saved({campaign:settled}).campaign,settled);
 t.diagnostic(JSON.stringify({scenario:'declared older wear and failed-pan checkpoints',wearWorkHours:s.hour-original.hour,materialDebit:20,remainingPoints:80,reprimePA:pan.pa,reprimeSeconds,reloadPA,ownedRounds:rounds,assignedWorkerAfterCollection:4,existingReserveDebit:1,collectedKitRetained:100}));
});

test('a serving reserve doctor makes a real finite medical courier trip and leaves patients at their clinic',async()=>{
 const {collectRouteMedicalSupplies}=await import('./finite-route-equipment.mjs');
 const {sectorInventoryModel}=await import('../game/sector-inventory.js');const {rosterFor}=await import('../game/campaign.js');
 const clinic=initialCampaign();clinic.sectors.ensenada.owner='royalist';
 let s=collectRouteItems(clinic,10,{item:'medkits'},12).campaign;
 // Keep all earlier dressings in a living owner's finite pack. The courier
 // does not confiscate them or refill the already emptied Retiro chest.
 for(const donor of [10,3]){
  const count=s.operativeState[donor].medkits;s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:donor,direction:'drop',item:'medkits',count});
  let left=count;while(left){const row=sectorInventoryModel(s,'retiro',rosterFor(s),4).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);const take=Math.min(left,row.count);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:row.key,expected:row.expected,count:take});left-=take;}
 }
 s=order(s,{type:'squad',ids:[3,4]});s.operativeState[3].hp-=12;s.operativeState[3].bandaged=12;s=order(s,{type:'assignCare',id:3,assignment:'patient'});
 const before=structuredClone(s),events=[],result=collectRouteMedicalSupplies(s,10,3,{report:e=>events.push(e)});s=result.campaign;
 assert.deepEqual(before.operativeState[3].hp,s.operativeState[3].hp);assert.equal(s.operativeState[3].location,'retiro');assert.equal(s.operativeState[3].assignment,'patient');assert.equal(result.collected,3);assert.equal(s.operativeState[10].medkits,3);assert.equal(s.operativeState[10].location,'retiro');assert.equal(s.operativeState[4].medkits,before.operativeState[4].medkits);
 assert.equal(s.activeSquadId,before.activeSquadId);assert.deepEqual(s.squad,before.squad);assert.ok(s.squads.some(q=>q.members.includes(10)&&q.location==='retiro'),'the reserve courier now belongs to its actual returned one-person squad');
 const receipt=events.find(e=>e.event==='finiteMedicalCourier');assert.equal(receipt.source,'buenos_aires');assert.ok(receipt.elapsedSeconds>=24*3600);assert.equal(s.resources.treasury,before.resources.treasury);
 const chest=s.sectorStates.buenos_aires.props.find(p=>p.id==='buenos_aires:building:chest:10:4');assert.equal(chest.contents.find(item=>item.item==='medkits').count,9);assert.deepEqual(saved({campaign:s}).campaign,s);
 const again=collectRouteMedicalSupplies(s,10,2);s=again.campaign;assert.equal(again.collected,2);assert.equal(s.operativeState[10].medkits,5);assert.equal(s.sectorStates.buenos_aires.props.find(p=>p.id===chest.id).contents.find(item=>item.item==='medkits').count,7,'an already discovered chest remains a finite courier source when no soldier is stationed there');assert.deepEqual(saved({campaign:s}).campaign,s);
});
