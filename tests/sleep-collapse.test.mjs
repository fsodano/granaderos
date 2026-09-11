import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {maximumEnergy} from '../game/fatigue.js';
import {sleepOrderReason} from '../game/sleep.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const wake=s=>order(s,{type:'setSleep',operativeId:3,asleep:false});
const r=s=>s.operativeState[3];
const roundtrip=s=>{const n=restoreCampaign(serializeCampaign(s));assert.deepEqual(n,s);return n;};
function march(onward=true){let s=initialCampaign();s.sectors.cordoba.owner='patriot';Object.assign(r(s),{fatigue:70,energy:30});return order(s,{type:'travel',sector:onward?'cordoba':'buenos_aires',queue:true});}

test('exhausted travelers finish the stage, collapse on arrival, and retain their onward route',()=>{
 let s=wait(march(),6);assert.equal(s.hour,6);assert.equal(r(s).fatigue,82);assert.equal(r(s).asleep,false);assert.equal(r(s).sleepCollapsed,false);assert.equal(s.squads[0].journey.elapsed,6);roundtrip(s);
 s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.location,'buenos_aires');assert.equal(r(s).fatigue,94);assert.equal(r(s).asleep,true);assert.equal(r(s).sleepCollapsed,true);assert.equal(s.squads[0].journey.status,'paused');assert.equal(s.squads[0].journey.reason,'exhausted');assert.deepEqual(s.squads[0].journey.path,['buenos_aires','cordoba']);assert.ok(s.assignmentAttention.notice.events.some(e=>e.code==='sleep_collapsed'));roundtrip(s);
 const before=serializeCampaign(s);for(const a of [{type:'setSleep',operativeId:3,asleep:false},{type:'resumeTravel'}]){const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},JSON.parse(before));}
 assert.equal(playerKnownCampaign(s).operatives.find(u=>u.id===3).sleepCollapsed,true);
 s=wait(roundtrip(s),6);assert.equal(r(s).fatigue,46);assert.equal(maximumEnergy(r(s)),54);assert.equal(r(s).sleepCollapsed,true);assert.ok(sleepOrderReason(s,3,false));
 s=wait(s,1);assert.equal(maximumEnergy(r(s)),62);assert.equal(r(s).sleepCollapsed,false);assert.equal(r(s).asleep,true);s=wake(s);s=order(s,{type:'resumeTravel'});s=wait(s,24);assert.equal(s.location,'cordoba');assert.equal(s.squads[0].journey,undefined);roundtrip(s);
});
test('collapse at the final destination requires recovery without recreating a finished route',()=>{
 let s=wait(march(false),24);assert.equal(s.squads[0].journey,undefined);assert.equal(r(s).sleepCollapsed,true);s=wait(s,24);assert.equal(r(s).fatigue,0);assert.equal(r(s).asleep,false);assert.equal(r(s).sleepCollapsed,false);assert.equal(s.hour,24);assert.equal(s.location,'buenos_aires');roundtrip(s);
});
test('low breath alone does not cause collapse and ordinary sleep can still end early',()=>{
 let s=initialCampaign();Object.assign(r(s),{energy:10,fatigue:20});s=wait(s,24);assert.equal(s.hour,0);assert.equal(r(s).asleep,true);assert.equal(r(s).sleepCollapsed,false);s=wake(s);assert.equal(r(s).energy,10);assert.equal(r(s).fatigue,20);roundtrip(s);
});
test('severe exhaustion during manual sleep cannot bypass the recovery requirement',()=>{
 let s=initialCampaign();Object.assign(r(s),{fatigue:90,energy:10});s=order(s,{type:'setSleep',operativeId:3,asleep:true});assert.equal(r(s).sleepCollapsed,true);assert.ok(dispatchCampaign(s,{type:'setSleep',operativeId:3,asleep:false}).lastError);roundtrip(s);
});
test('same-hour enemy arrival takes precedence over sleeping at the destination',()=>{
 let s=march(false),g=launchEnemyGroup(s,'coast','buenos_aires');g.nextArrivalAt=12;g.arrivalAt=12;s=wait(s,24);assert.equal(s.hour,12);assert.equal(s.pendingEncounter.sector,'buenos_aires');assert.equal(r(s).asleep,false);assert.equal(r(s).fatigue,94);
 s=order(s,{type:'respondToEncounter',groupId:g.id,choice:'tactical'});assert.equal(s.pendingBattle.squad.find(u=>u.id===3).energy,10);assert.equal(s.pendingBattle.squad.find(u=>u.id===3).asleep,false);roundtrip(s);
});
test('forced defense wakes a collapsed soldier but does not erase the recovery requirement',()=>{
 let s=wait(march(false),24);launchEnemyGroup(s,'coast','buenos_aires',{immediate:true});s=wait(s,1);assert.equal(r(s).asleep,false);assert.equal(r(s).sleepCollapsed,true);s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});roundtrip(s);
 let b=enterSector(s.pendingBattle);const exit=b.exits.find(e=>e.destination==='retiro');b=actBattle(b,{type:'exit',unitIds:s.squad.map(String),exitId:exit.id});assert.equal(b.lastError,null);assert.equal(b.status,'retreat');
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(r(s).sleepCollapsed,true);s=wait(s,24);assert.equal(r(s).asleep,true);assert.ok(dispatchCampaign(s,{type:'setSleep',operativeId:3,asleep:false}).lastError);roundtrip(s);
});
test('collapse state rejects malformed saves and is cleared when service ends or a soldier dies',()=>{
 const base=wait(march(false),24);for(const value of [null,1,'true']){const bad=structuredClone(base);r(bad).sleepCollapsed=value;assert.throws(()=>restoreCampaign(serializeCampaign(bad)),/agotamiento/);}
 let s=order(base,{type:'dismiss',id:3});assert.equal(r(s).sleepCollapsed,false);assert.equal(r(s).asleep,false);roundtrip(s);
 s=structuredClone(base);Object.assign(r(s),{hp:1,bandaged:0,bleeding:100});s=wait(s,1);assert.equal(r(s).alive,false);assert.equal(r(s).sleepCollapsed,false);roundtrip(s);
});
test('direct travel also collapses exhausted soldiers before its next stage',()=>{
 let s=initialCampaign();s.sectors.cordoba.owner='patriot';Object.assign(r(s),{fatigue:70,energy:30});s=order(s,{type:'travel',sector:'cordoba'});assert.equal(s.location,'buenos_aires');assert.equal(s.hour,12);assert.equal(r(s).fatigue,94);assert.equal(r(s).asleep,true);assert.equal(r(s).sleepCollapsed,true);roundtrip(s);
});
