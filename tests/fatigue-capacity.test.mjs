import test from 'node:test';
import assert from 'node:assert/strict';
import {maximumEnergy,gainFatigue,recoverEnergy,recoverFatigue} from '../game/fatigue.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
const flat=Array.from({length:120},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
const battle=(extra={},sector={})=>createBattle([{id:3,hp:100,maxHp:100,energy:20,fatigue:40,x:1,y:1,weapon:1800,...extra}],{width:20,height:6,tiles:flat,exploration:true,enemies:[],...sector});
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
test('fatigue lowers energy capacity and additional breath recovery cannot erase it',()=>{
 const unit={energy:90,fatigue:10};gainFatigue(unit,30);assert.equal(unit.energy,60);assert.equal(maximumEnergy(unit),60);recoverEnergy(unit,100);assert.equal(unit.energy,60);assert.equal(unit.fatigue,40);recoverFatigue(unit,8,12);assert.equal(unit.energy,68);assert.equal(maximumEnergy(unit),68);
 gainFatigue(unit,100);assert.equal(unit.fatigue,100);assert.equal(unit.energy,10);assert.equal(maximumEnergy(unit),10);
});
test('exploration rest catches breath up to capacity without reducing fatigue',()=>{
 let s=battle();for(let i=0;i<4;i++)s=endTurn(s);const u=s.units[0];assert.equal(u.energy,60);assert.equal(u.fatigue,40);assert.ok(s.elapsedSeconds>0);assert.equal(u.hp,100);
});
test('combat turn recovery respects the same energy capacity',()=>{
 let s=battle({energy:58},{exploration:false,enemies:[{id:'e',x:18,y:4,weapon:0,patrol:false,marksmanship:0}]});s=endTurn(s);assert.equal(s.units[0].energy,60);assert.equal(s.units[0].fatigue,40);
});
test('entering a battle limits starting energy and movement preserves the lower ceiling',()=>{
 let s=battle({energy:100,fatigue:20});assert.equal(s.units[0].energy,80);s=actBattle(s,{type:'move',unitId:'3',x:2,y:1});assert.equal(s.lastError,null);assert.equal(s.units[0].fatigue,20);assert.ok(s.units[0].energy<=maximumEnergy(s.units[0]));
});
test('a held ration restores some fatigue but cannot exceed the new capacity',()=>{
 let s=battle({energy:55,activeSlot:'supply',activeSupply:'rations',rations:1});s=actBattle(s,{type:'useItem',unitId:'3',targetId:'3'});assert.equal(s.lastError,null);assert.equal(s.units[0].rations,0);assert.equal(s.units[0].fatigue,30);assert.equal(s.units[0].energy,70);
});
test('strategic rest restores capacity before current energy without granting health to a full soldier',()=>{
 let s=initialCampaign();Object.assign(s.operativeState[3],{energy:10,fatigue:60});s=order(s,{type:'assignCare',operativeId:3,assignment:'rest'});s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[3].fatigue,44);assert.equal(s.operativeState[3].energy,34);assert.equal(maximumEnergy(s.operativeState[3]),56);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('return from a fatigued sector keeps capacity across save and redeployment',()=>{
 let s=initialCampaign();Object.assign(s.operativeState[3],{energy:50,fatigue:40});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);b=endTurn(b);const u=b.units.find(u=>u.id==='3');assert.equal(u.energy,60);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});s=restoreCampaign(serializeCampaign(s));assert.equal(s.operativeState[3].energy,60);assert.equal(playerKnownCampaign(s).operatives.find(u=>u.id===3).maximumEnergy,60);s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(u=>u.id===3).energy,60);
});
test('public tactical state exposes capacity for the player without exposing enemy fatigue',()=>{
 const s=battle({}, {exploration:false,enemies:[{id:'e',x:3,y:1,energy:30,fatigue:60}]});const p=playerKnownBattle(s);assert.equal(p.units.find(u=>u.id==='3').maximumEnergy,60);const e=p.units.find(u=>u.id==='e');assert.ok(e);assert.ok(!Object.hasOwn(e,'maximumEnergy'));assert.ok(!Object.hasOwn(e,'fatigue'));
});
test('tactical fatigue follows elapsed hours, not the number of movement orders',async()=>{
 const {advanceBattleClock}=await import('../game/time.js');const a=battle({energy:100,fatigue:0}),b=structuredClone(a);
 advanceBattleClock(a,3600);for(let i=0;i<600;i++)advanceBattleClock(b,6);
 assert.deepEqual(a,b);assert.equal(a.units[0].fatigue,2);assert.equal(a.units[0].energy,98);
 const resumed=JSON.parse(JSON.stringify(b));advanceBattleClock(b,3600);advanceBattleClock(resumed,3600);assert.deepEqual(resumed,b);
});
test('quiet tactical rest slowly restores capacity and excludes departed soldiers',async()=>{
 const {advanceBattleClock}=await import('../game/time.js');const s=battle({energy:60,fatigue:40});s.units.push({...s.units[0],id:'left',departure:{edge:'W'}});advanceBattleClock(s,3600,{resting:true});assert.equal(s.units[0].fatigue,39);assert.equal(s.units[0].energy,60);assert.equal(maximumEnergy(s.units[0]),61);assert.equal(s.units[1].fatigue,40);
});
