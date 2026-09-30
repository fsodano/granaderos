import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {operativeInTransit} from '../game/squads.js';
import {squadTravelStatus} from '../game/squad-travel.js';
import {localDefenderIds,launchEnemyGroup} from '../game/enemy-groups.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {workAssignmentReason} from '../game/assignments.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const queue=(s,sector='buenos_aires',extra={})=>order(s,{type:'travel',sector,queue:true,...extra});
const wait=(s,hours)=>order(s,{type:'wait',hours});
const roundtrip=s=>assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
const record=(s,id=3)=>s.operativeState[id];
const split=()=>order(initialCampaign(),{type:'createSquad',name:'Exploradores',ids:[3]});
const q=s=>s.squads.find(q=>q.id===s.activeSquadId);
test('queueing does not advance time; actual arrival stops a long wait',()=>{
 let s=queue(initialCampaign());assert.equal(s.hour,0);assert.equal(s.location,'retiro');assert.equal(operativeInTransit(s,3),true);assert.deepEqual(localDefenderIds(s,'retiro'),[]);roundtrip(s);
 s=wait(s,5);assert.equal(s.hour,5);assert.equal(s.location,'retiro');assert.equal(record(s).fatigue,10);assert.equal(record(s).energy,90);assert.equal(squadTravelStatus(q(s)).remaining,7);roundtrip(s);
 const known=playerKnownCampaign(s);assert.equal(known.operatives.find(o=>o.id===3).inTransit,true);assert.equal(known.squads[0].journey.legRemaining,7);
 s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');assert.equal(record(s).fatigue,24);assert.equal(record(s).energy,76);assert.equal(q(s).journey,undefined);assert.equal(operativeInTransit(s,3),false);assert.equal(s.travelNotice.events[0].sector,'buenos_aires');roundtrip(s);
});
test('two routes move concurrently while local personnel continue their work',()=>{
 let s=split();s=queue(s);s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'createSquad',name:'Segunda marcha',ids:[4]});s=queue(s,'ensenada');
 s=order(s,{type:'assignWork',operativeId:10,assignment:'practice',skill:'marksmanship'});const before=record(s,10).trainingCredit;
 s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.squads.find(q=>q.name==='Exploradores').location,'buenos_aires');assert.equal(s.location,'buenos_aires');assert.ok(q(s).journey);assert.ok(record(s,10).trainingCredit>before);assert.equal(record(s).fatigue,24);assert.equal(record(s,4).fatigue,24);
 s=wait(s,24);assert.equal(s.hour,24);assert.equal(s.location,'ensenada');roundtrip(s);
});
test('stop discards later stages but completes the current stage; return retraces elapsed hours',()=>{
 let s=wait(queue(initialCampaign(),'ensenada'),5);s=order(s,{type:'cancelTravel',choice:'stop'});assert.equal(squadTravelStatus(q(s)).destination,'buenos_aires');s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');assert.equal(q(s).journey,undefined);
 s=wait(queue(initialCampaign()),5);s=order(s,{type:'cancelTravel',choice:'return'});assert.equal(s.location,'retiro');assert.equal(squadTravelStatus(q(s)).remaining,5);roundtrip(s);
 s=wait(s,4);assert.ok(operativeInTransit(s,3));assert.equal(q(s).journey.elapsed,1);s=wait(s,24);assert.equal(s.hour,10);assert.equal(s.location,'retiro');assert.equal(q(s).journey,undefined);assert.equal(record(s).fatigue,20);roundtrip(s);
 s=queue(initialCampaign());s=order(s,{type:'cancelTravel'});assert.equal(s.hour,0);assert.equal(q(s).journey,undefined);
});
test('waypoints determine the full route and malformed orders are atomic',()=>{
 let s=queue(initialCampaign(),'retiro',{waypoints:['ensenada']});assert.deepEqual(q(s).journey.path,['retiro','buenos_aires','ensenada','buenos_aires','retiro']);assert.equal(squadTravelStatus(q(s)).remaining,48);
 for(const extra of [{waypoints:'ensenada'},{waypoints:['mendoza']},{mode:'balloon'},{waypoints:Array(9).fill('ensenada')}]){const before=initialCampaign(),next=dispatchCampaign(before,{type:'travel',queue:true,sector:'buenos_aires',...extra});assert.ok(next.lastError);delete next.lastError;delete before.lastError;assert.deepEqual(next,before);}
});
test('exhaustion pauses at a sector, preserves route, and allows rest then resume',()=>{
 let s=initialCampaign();for(const region of Object.values(s.sectors))region.owner='patriot';s=queue(s,'humahuaca');s=wait(s,72);assert.equal(s.hour,48);assert.equal(q(s).journey.status,'paused');assert.equal(q(s).journey.reason,'exhausted');assert.equal(record(s).fatigue,96);assert.ok(!operativeInTransit(s,3));roundtrip(s);
 assert.match(dispatchCampaign(s,{type:'resumeTravel'}).lastError,/descansar/);
 s=wait(s,12);if(s.hour===48)s=wait(s,12);assert.ok(s.hour>48);assert.equal(record(s).fatigue,0);assert.equal(record(s).asleep,false);s=order(s,{type:'resumeTravel'});s=wait(s,72);assert.equal(s.location,'humahuaca');assert.equal(q(s).journey,undefined);roundtrip(s);
});
test('travelers cannot work, heal, sleep, equip, join another squad or defend their source',()=>{
 let s=queue(split());s=wait(s,1);
 for(const action of [{type:'setSleep',operativeId:3,asleep:true},{type:'assignCare',operativeId:3,assignment:'rest'},{type:'assignWork',operativeId:3,assignment:'practice',skill:'marksmanship'},{type:'purchaseMedicalSupplies',operativeId:3},{type:'equip',operativeId:3,item:1800},{type:'dismiss',id:3},{type:'visitSector',sector:'retiro'},{type:'travel',sector:'buenos_aires'},{type:'createSquad',name:'Otro',ids:[3]}])assert.ok(dispatchCampaign(s,action).lastError,action.type);
 s=order(s,{type:'selectSquad',id:'squad-1'});assert.deepEqual(localDefenderIds(s,'retiro'),[4,10]);assert.ok(dispatchCampaign(s,{type:'squad',ids:[3,4]}).lastError);
 const op=rosterFor(s).find(o=>o.id===10);record(s,10).toolkitPoints=100;assert.match(workAssignmentReason(s,op,'repair',{targetId:3,repairScope:'equipment'},rosterFor(s)),/presente/);
});
test('expired contracts remain attached while moving and depart at a real arrival',()=>{
 let s=split();s.contracts[3]={kind:'paid',term:'day',started:0,expiresAt:3,paid:100};s=queue(s,'ensenada');s=wait(s,4);assert.equal(s.hour,1);s=wait(s,4);assert.equal(s.hour,3);assert.ok(s.recruited.includes(3));assert.equal(s.contracts[3].departurePending,true);roundtrip(s);
 s=order(s,{type:'selectSquad',id:'squad-1'});assert.ok(s.recruited.includes(3));s=wait(s,24);assert.equal(s.hour,12);assert.ok(!s.recruited.includes(3));assert.equal(record(s).location,'buenos_aires');assert.equal(s.squads.find(q=>q.name==='Exploradores').journey,undefined);roundtrip(s);
});
test('route closure during transit causes a timed return, not instant relocation',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});s=wait(queue(s,'ensenada'),4);s.sectors.ensenada.owner='royalist';s=wait(s,24);assert.equal(s.hour,17);assert.equal(q(s).journey.returning,true);assert.equal(q(s).journey.elapsed,3);roundtrip(s);
 s=wait(s,24);assert.equal(s.hour,20);assert.equal(s.location,'buenos_aires');assert.equal(q(s).journey,undefined);
});
test('arrivals can defend a same-hour contact, including an intermediate stage',()=>{
 let s=queue(initialCampaign(),'ensenada');const group=launchEnemyGroup(s,'interior','buenos_aires');group.nextArrivalAt=12;group.arrivalAt=12;
 s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.pendingEncounter?.sector,'buenos_aires');assert.equal(q(s).journey.status,'paused');assert.deepEqual(localDefenderIds(s,'buenos_aires'),[3,4,10]);roundtrip(s);
 s=order(s,{type:'respondToEncounter',groupId:group.id,choice:'tactical'});assert.ok(s.pendingBattle);assert.equal(q(s).journey,undefined);roundtrip(s);
});
test('a raid cannot use travelers as defenders of their departure sector',()=>{
 let s=wait(queue(initialCampaign()),1);const group=launchEnemyGroup(s,'interior','retiro',{immediate:true});s=wait(s,1);assert.equal(s.pendingEncounter,null);assert.equal(s.enemyGroups.find(g=>g.id===group.id).status,'stationed');assert.equal(s.sectors.retiro.owner,'royalist');assert.ok(operativeInTransit(s,3));
});
test('mounted travelers lose stamina hourly and retain hired mounts until arrival',()=>{
 let s=split();s=order(s,{type:'horseAction',order:{type:'hire',name:'Alazán'}});const horse=s.horseState.horses.at(-1);s=order(s,{type:'horseAction',order:{type:'assign',horseId:horse.id,operativeId:3}});const h=()=>s.horseState.horses.find(h=>h.id===horse.id);h().hireUntil=3;const stamina=h().stamina;
 s=wait(queue(s),4);assert.equal(h().stamina,stamina-8);assert.equal(h().assignedTo,3);assert.equal(h().returned,false);roundtrip(s);
 s=order(s,{type:'selectSquad',id:'squad-1'});assert.equal(h().assignedTo,3);assert.ok(dispatchCampaign(s,{type:'horseAction',order:{type:'unassign',horseId:horse.id}}).lastError);
 s=wait(s,24);assert.equal(h().location,'buenos_aires');assert.equal(h().returned,true);roundtrip(s);
});
test('posta charges a remount per started stage; save/reload does not charge twice',()=>{
 let s=initialCampaign();s.routes.posta=true;const horses=s.resources.horses;s=queue(s,'ensenada',{mode:'posta'});assert.equal(s.resources.horses,horses);s=wait(s,1);assert.equal(s.resources.horses,horses-1);s=restoreCampaign(serializeCampaign(s));s=wait(s,3);assert.equal(s.resources.horses,horses-1);s=wait(s,24);assert.equal(s.hour,8);assert.equal(s.resources.horses,horses-2);assert.equal(record(s).fatigue,8);
});
test('another squad travels during tactical time synchronization',()=>{
 let s=queue(split());s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'visitSector',sector:'retiro'});const before=structuredClone(s.pendingBattle.squad);s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:12*3600});assert.equal(s.squads.find(q=>q.name==='Exploradores').location,'buenos_aires');assert.equal(s.location,'retiro');assert.deepEqual(s.pendingBattle.squad,before);roundtrip(s);
});
test('invalid saved journey progress, routes and double deployment are rejected',()=>{
 const s=wait(queue(initialCampaign()),3);
 for(const change of [j=>j.elapsed=-1,j=>j.elapsed=12,j=>j.legHours=1,j=>j.path=['retiro','mendoza'],j=>j.path[0]='ensenada',j=>j.status='teleport',j=>j.mode='balloon',j=>j.startedAt=99,j=>j.status='paused']){const bad=structuredClone(s);change(q(bad).journey);assert.throws(()=>restoreCampaign(JSON.stringify(bad)),/ruta|avance/);}
 for(const change of [r=>r.asleep=true,r=>r.assignment='rest']){const bad=structuredClone(s);change(record(bad));assert.throws(()=>restoreCampaign(JSON.stringify(bad)),/viajeros/);}
 roundtrip(s);
});

test('an expired hired mount leaves at an intermediate arrival, before the next stage',()=>{
 let s=split();s=order(s,{type:'horseAction',order:{type:'hire',name:'Criollo'}});const id=s.horseState.horses.at(-1).id;s=order(s,{type:'horseAction',order:{type:'assign',horseId:id,operativeId:3}});s.horseState.horses.find(h=>h.id===id).hireUntil=2;
 s=wait(queue(s,'ensenada'),12);const horse=s.horseState.horses.find(h=>h.id===id);assert.equal(horse.location,'buenos_aires');assert.equal(horse.returned,true);assert.equal(horse.assignedTo,null);assert.equal(q(s).journey.status,'moving');roundtrip(s);
});
test('all same-hour arrivals appear in the saved player notice',()=>{
 let s=queue(split());s=order(s,{type:'selectSquad',id:'squad-1'});s=queue(s);s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.travelNotice.events.length,2);assert.equal(playerKnownCampaign(s).travelNotice.events.length,2);roundtrip(s);
 s=wait(s,1);assert.equal(s.travelNotice,null);
});
