import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canSee,interruptAvailable,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const tiles=(width=16)=>Array.from({length:width*10},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const field=(squad,enemies,extra={})=>createBattle(squad,{width:16,height:10,tiles:tiles(),enemies,seed:45,...extra});
function nested(){
 let s=field([{id:'a',x:1,y:1,agility:30},{id:'c',x:1,y:5,agility:90,experienceLevel:9},{id:'57',x:12,y:7,facing:2,agility:100,experienceLevel:10}],
 [{id:'b',x:7,y:1,agility:70,weapon:1813},{id:'d',x:9,y:7,facing:6,agility:100,experienceLevel:10}]);
 s=actBattle(s,{type:'move',unitId:'a',x:4,y:1});
 assert.equal(s.phase,'interrupt');assert.deepEqual(s.interrupt.unitIds,['c']);
 assert.equal(s.reactionStack.length,1);
 s=actBattle(s,{type:'move',unitId:'c',x:3,y:5});
 return s;
}
test('a player interruption can interrupt another interruption and restore its parent',()=>{
 const s=nested();assert.equal(s.phase,'interrupt');assert.deepEqual(s.interrupt.unitIds,['57']);
 assert.equal(s.reactionStack.length,2);assert.equal(s.reactionStack[1].resumePhase,'interrupt');
 assert.equal(s.reactionStack[1].resumeInterrupt.enemyId,'b');
 assert.equal(s.turn,1);assert.equal(s.elapsedSeconds,6);assert.equal(s.enemyTurn,undefined);
 assert.equal(s.units.find(u=>u.id==='a').x,2);assert.equal(s.units.find(u=>u.id==='c').x,2);
 assert.equal(interruptAvailable(s,s.units[1]),false);assert.doesNotThrow(()=>validateBattleSnapshot(s));
 const copy=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
 const resumed=endTurn(copy);assert.deepEqual(resumed,endTurn(s));
 assert.equal(resumed.phase,'interrupt');assert.equal(resumed.interrupt.enemyId,'b');assert.equal(resumed.reactionStack.length,1);
 const finished=endTurn(resumed);assert.equal(finished.phase,'player');assert.equal(finished.reactionStack,undefined);assert.equal(finished.enemyTurn,undefined);
 assert.equal(finished.turn,1);assert.equal(finished.elapsedSeconds,6);
 assert.ok(finished.units.find(u=>u.id==='d').ap<100);assert.equal(finished.units.find(u=>u.id==='57').ap,s.units.find(u=>u.id==='57').ap);
 assert.doesNotThrow(()=>validateBattleSnapshot(finished));
});
test('a new sight line through an opened door grants a remaining-AP enemy reaction',()=>{
 const grid=tiles();for(const t of grid.filter(t=>t.x===4))Object.assign(t,{type:'wall',blocked:true});
 Object.assign(grid.find(t=>t.x===4&&t.y===2),{type:'door',doorId:'door',open:false,locked:false,blocksSight:true});
 const s=field([{id:'a',x:3,y:2}], [{id:'b',x:6,y:2,agility:100,weapon:1806}],{tiles:grid});s.units[1].ap=actionCosts(s,s.units[1]).fire;
 assert.equal(canSee(s,s.units[1],s.units[0]),false);
 const n=actBattle(s,{type:'door',unitId:'a',doorId:'door',open:true});
 assert.equal(n.lastError,null);assert.equal(n.units[0].ap,96);assert.equal(n.units[1].reactionTurn,1);assert.equal(n.units[1].ap,0);
 assert.equal(n.phase,'player');assert.equal(n.elapsedSeconds,6);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('hearing alone grants a window without revealing the shooter identity or exact position',()=>{
 const s=field([{id:'p',x:5,y:2,facing:0,agility:100}], [{id:'e',x:5,y:5,facing:0,loaded:0,ammo:2}]);
 assert.equal(canSee(s,s.units[0],s.units[1]),false);
 const n=endTurn(s);assert.equal(n.phase,'interrupt');assert.equal(n.interrupt.enemyId,'e');
 const p=n.units[0];assert.equal(p.lastHeardNoise.kind,'reload');
 assert.deepEqual(Object.keys(p.lastHeardNoise).sort(),['kind','turn','uncertainty','x','y']);assert.equal(canSee(n,p,n.units[1]),false);
 assert.equal(n.units[1].loaded,1);assert.equal(n.units[1].ammo,1);assert.equal(n.units[1].ap,55);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('an unchanged anonymous sound does not repeatedly grant an interrupt',()=>{
 const s=field([{id:'p',x:5,y:2,facing:0,agility:100}], [{id:'e',x:5,y:5,facing:0,loaded:0,ammo:2}]);
 s.units[0].lastHeardNoise={x:4,y:4,kind:'reload',turn:1,uncertainty:2};s.units[1].ap=45;
 const n=endTurn(s);assert.equal(n.phase,'player');assert.equal(n.turn,2);assert.equal(n.units[0].reactionTurn,0);
});
test('invalid nested order is atomic, and malformed reaction stacks cannot load',()=>{
 const s=nested(),bad=actBattle(s,{type:'move',unitId:'a',x:3,y:1});
 assert.ok(bad.lastError);assert.deepEqual(bad.units,s.units);assert.deepEqual(bad.reactionStack,s.reactionStack);assert.equal(bad.elapsedSeconds,s.elapsedSeconds);
 for(const corrupt of [b=>delete b.reactionStack,b=>b.reactionStack[1].unitIds=['a'],b=>b.reactionStack[1].unitIds=['b'],b=>b.reactionStack[1].unitIndex=5,b=>b.reactionStack[1].resumeInterrupt.enemyId='missing',b=>b.reactionStack[0].resumePhase='interrupt',b=>b.phase='player',b=>b.roundTimeCharged=false]){
  const b=structuredClone(s);corrupt(b);assert.throws(()=>validateBattleSnapshot(b));
 }
});

test('nested reactions resume an existing enemy turn instead of restarting its budget',()=>{
 let s=field([{id:'a',x:1,y:1,agility:30},{id:'c',x:1,y:5,agility:90,experienceLevel:9},{id:'57',x:12,y:7,facing:2,agility:100,experienceLevel:10}],
 [{id:'b',x:7,y:1,agility:70,weapon:1813},{id:'d',x:9,y:7,facing:6,agility:100,experienceLevel:10}]);
 s.units[0].ap=0;s=endTurn(s);assert.equal(s.phase,'interrupt');assert.ok(s.enemyTurn);assert.equal(s.reactionStack,undefined);
 s=actBattle(s,{type:'move',unitId:'c',x:3,y:5});assert.equal(s.phase,'interrupt');assert.deepEqual(s.interrupt.unitIds,['57']);assert.equal(s.reactionStack.length,1);
 assert.ok(s.enemyTurn.started);assert.equal(s.reactionStack[0].resumeInterrupt.enemyId,'b');assert.doesNotThrow(()=>validateBattleSnapshot(s));
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),dBudget=s.units.find(u=>u.id==='d').ap;
 s=endTurn(saved);assert.equal(s.phase,'interrupt');assert.equal(s.interrupt.enemyId,'b');assert.equal(s.reactionStack,undefined);
 s=endTurn(s);assert.equal(s.turn,2);assert.equal(s.phase,'player');assert.equal(s.elapsedSeconds,6);assert.equal(s.enemyTurn,undefined);
 assert.ok(s.units.find(u=>u.id==='d').ap<=dBudget);assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('full campaign saves preserve both nested return windows and their remaining budgets',()=>{
 let campaign=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'san_nicolas'});
 assert.equal(campaign.lastError,null);
 let battle=createBattle([
  {id:'3',x:1,y:1,agility:30},
  {id:'4',x:1,y:5,agility:90,experienceLevel:9},
  {id:'10',x:12,y:7,facing:2,agility:100,experienceLevel:10}
 ],{...campaign.pendingBattle,width:16,height:10,tiles:tiles(),seed:45,hour:campaign.hour,
 enemies:[{id:'b',x:7,y:1,agility:70,weapon:1813},{id:'d',x:8,y:7,facing:6,agility:100,experienceLevel:10}]});
 battle=actBattle(battle,{type:'move',unitId:'3',x:4,y:1});
 assert.deepEqual(battle.interrupt.unitIds,['4']);
 battle=actBattle(battle,{type:'move',unitId:'4',x:3,y:5});
 assert.deepEqual(battle.interrupt.unitIds,['10']);assert.equal(battle.reactionStack.length,2);
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(saved.battle,pair.battle);
 const parent=endTurn(saved.battle);
 assert.equal(parent.phase,'interrupt');assert.equal(parent.interrupt.enemyId,'b');
 assert.equal(parent.reactionStack.length,1);
 // Save a second time at the parent, so neither return path can rely on transient state.
 const parentPair=syncBattleTime(saved.campaign,parent);assert.equal(parentPair.error,null);
 const restoredParent=decodeSave(encodeSave(parentPair.campaign,parentPair.battle));
 const finished=endTurn(restoredParent.battle);
 assert.deepEqual(finished,endTurn(endTurn(pair.battle)));
 assert.equal(finished.phase,'player');assert.equal(finished.turn,1);assert.equal(finished.elapsedSeconds,6);
 assert.equal(finished.reactionStack,undefined);assert.equal(finished.enemyTurn,undefined);
 assert.equal(finished.units.find(u=>u.id==='10').ap,battle.units.find(u=>u.id==='10').ap);
});
