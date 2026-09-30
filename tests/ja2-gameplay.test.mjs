import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,maxActionPoints,actionPointBudget,shotChance,stanceCost,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const field=(squad=[{id:'p',x:1,y:1}],extra={})=>createBattle(squad,{width:24,height:8,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:22,y:6,overwatch:false}],seed:45,...extra});
const order=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null);return n;};

test('earned campaign experience reaches tactical AP and interruption attributes',()=>{
 const novice=field([{id:'p',x:1,y:1,agility:40,dexterity:40,xp:0}]);
 const veteran=field([{id:'p',x:1,y:1,agility:40,dexterity:40,xp:200}]);
 assert.equal(veteran.units[0].experienceLevel,6);
 assert.ok(veteran.units[0].ap>novice.units[0].ap);
});
test('reserved fire uses the same operative and cavalry discount as a normal shot',()=>{
 for(const unit of [{id:4,weapon:1808},{id:'p',weapon:1800,mounted:true,traits:['cavalry_commander']}]){
  const s=field([{x:1,y:1,...unit}]),u=s.units[0],cost=actionCosts(s,u);
  assert.equal(cost.overwatch,cost.fire);u.ap=cost.fire;
  const n=actBattle(s,{unitId:u.id,type:'overwatch'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,cost.fire);
 }
});

test('health, bandages, breath, attributes and experience all affect AP budgets',()=>{
 const s=field(),u=s.units[0],base=maxActionPoints(s,u);
 const wounded={...u,hp:40,bleeding:5,bandaged:0};
 assert.ok(maxActionPoints(s,wounded)<maxActionPoints(s,{...wounded,bleeding:0,bandaged:60}));
 assert.ok(maxActionPoints(s,{...wounded,bleeding:0,bandaged:60})<base);
 for(const change of [{energy:20},{agility:30,dexterity:30},{experienceLevel:1},{fatigue:70}])assert.ok(maxActionPoints(s,{...u,...change})<base);
 assert.equal(maxActionPoints(s,{...u,hp:10}),0);
});
test('unused AP carries up to twenty, never accumulates without a bound, and survives validation',()=>{
 let s=field();s.units[0].ap=7;s=endTurn(s);assert.equal(s.units[0].ap,107);assert.equal(s.units[0].carriedAP,7);
 for(let i=0;i<4;i++){s=endTurn(s);assert.equal(s.units[0].ap,120);assert.doesNotThrow(()=>validateBattleSnapshot(s));}
 assert.deepEqual(actionPointBudget(s,s.units[0]),{base:100,carryover:20,total:120});
 const corrupt=structuredClone(s);corrupt.units[0].ap=121;assert.throws(()=>validateBattleSnapshot(corrupt));
});
test('interrupt stops a route at the first step and spends only completed movement and remaining reaction AP',()=>{
 const s=field([{id:'p',x:1,y:1,morale:100}],{enemies:[{id:'e',x:6,y:1,overwatch:true,weapon:1806}]});
 s.units[1].ap=actionCosts(s,s.units[1]).fire;const n=order(s,{type:'move',x:4,y:1});
 assert.equal(n.units[0].x,2);assert.equal(n.units[0].ap,92);assert.equal(n.units[1].ap,0);
 assert.equal(s.units[0].x,1);assert.equal(n.units[1].reactionSpent,0);
});
test('an exhausted first enemy budget cannot be refreshed after an interrupt',()=>{
 let s=field([{id:'p',x:1,y:1,morale:100}],{enemies:[{id:'e',x:6,y:1,overwatch:true,marksmanship:100}]});
 s.units[1].ap=12;s=order(s,{type:'move',x:4,y:1});assert.equal(s.units[1].ap,0);
 const n=endTurn(s);assert.equal(n.units[1].ap,0);assert.equal(n.units[1].loaded,0);
});
test('resting before contact does not grant an extra first enemy AP budget',()=>{
 let s=field([{id:'p',x:1,y:1}],{exploration:true,enemies:[{id:'e',x:22,y:1,overwatch:false}]});
 s=endTurn(s);assert.equal(s.turn,2);s=order(s,{type:'move',x:15,y:1});assert.equal(s.mode,'combat');
 s.units[1].ap=0;const n=endTurn(s);assert.equal(n.units[1].ap,0);assert.equal(n.units[1].carriedAP,0);
});
test('legacy charges stop at an interrupt and cannot strike through a wall',()=>{
 let s=field([{id:'p',x:1,y:1,morale:100}],{enemies:[{id:'e',x:6,y:1,overwatch:true,weapon:1806}]});
 s.units[1].ap=actionCosts(s,s.units[1]).fire;const n=order(s,{type:'charge',targetId:'e'});assert.equal(n.units[0].x,2);assert.equal(n.units[1].hp,100);assert.equal(n.units[0].ap,92);
 s=field([{id:'p',x:1,y:1}],{enemies:[{id:'e',x:3,y:1,overwatch:false}]});
 Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{type:'wall',blocked:true});
 const blocked=actBattle(s,{type:'charge',unitId:'p',targetId:'e'});assert.ok(blocked.lastError);assert.deepEqual(blocked.units,s.units);
});
test('reserved player reaction AP is paid once and only its remainder carries over',()=>{
 let s=field([{id:'p',x:1,y:1,ap:20,morale:100,overwatch:true,marksmanship:100}],{enemies:[{id:'e',x:7,y:1,weapon:1809,energy:100,overwatch:false,morale:100}]});
 // A partial enemy turn leaves the reacting soldier available for the carryover check.
 s.units[0].ap=20;s.units[1].ap=24;let n=endTurn(s);assert.equal(n.phase,'interrupt');
 assert.equal(n.units[0].ap,20);assert.equal(n.units[1].ap,16);
 n=actBattle(n,{type:'useItem',unitId:'p',targetId:'e'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,8);n=endTurn(n);
 assert.equal(n.status,'active');assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[0].carriedAP,8);assert.equal(n.units[0].ap,maxActionPoints(n,n.units[0])+8);
});
test('experience can defeat an interrupt and a knocked-down defender cannot cancel movement',()=>{
 const s=field([{id:'p',x:1,y:1,experienceLevel:10}],{enemies:[{id:'e',x:6,y:1,overwatch:true,experienceLevel:1}]});
 assert.equal(order(s,{type:'move',x:4,y:1}).units[0].x,4);
 s.units[0].experienceLevel=1;s.units[1].knockedDown=true;
 assert.equal(order(s,{type:'move',x:4,y:1}).units[0].x,4);
});
test('three stances have paid transitions and mounted soldiers cannot bypass them through movement',()=>{
 let s=field();s=order(s,{type:'stance',stance:'crouched'});assert.equal(s.units[0].ap,97);assert.equal(s.units[0].movementMode,'crouch');
 s=order(s,{type:'stance',stance:'prone'});assert.equal(s.units[0].ap,94);assert.equal(stanceCost(s.units[0],'standing'),6);
 s.units[0].mounted=true;const n=actBattle(s,{type:'movement',unitId:'p',movement:'crouch'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);
});
test('invalid movement cannot change stance, AP, fatigue or the clock',()=>{
 const s=field(),n=actBattle(s,{type:'move',unitId:'p',x:-1,y:4,movement:'prone'});
 assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
});
test('posture, firearm condition, breath and shock affect shots; nearby prone targets get no distance concealment',()=>{
 const s=field([{id:'p',x:1,y:1,marksmanship:65}],{enemies:[{id:'e',x:16,y:1}]}),a=s.units[0],t=s.units[1],base=shotChance(s,a,t);
 assert.ok(shotChance(s,{...a,stance:'prone'},t)>base);
 assert.ok(shotChance(s,a,{...t,stance:'crouched'})<base);
 assert.ok(shotChance(s,a,{...t,stance:'prone'})<shotChance(s,a,{...t,stance:'crouched'}));
 for(const change of [{condition:10},{energy:20},{shock:4}])assert.ok(shotChance(s,{...a,...change},t)<base);
 assert.equal(shotChance(s,a,{...t,x:4,stance:'prone'}),shotChance(s,a,{...t,x:4,stance:'standing'}));
});
test('repeated fire at the same target gives a bonus that movement clears',()=>{
 let s=field([{id:'p',x:1,y:1,marksmanship:40,weapon:1808}],{enemies:[{id:'e',x:9,y:1,morale:100}]});
 s=order(s,{type:'useItem',targetId:'e'});const a=s.units[0],t=s.units[1];
 assert.ok(shotChance(s,a,t)>shotChance(s,{...a,lastTargetId:undefined},t));
 s=order(s,{type:'move',x:1,y:2});assert.equal(s.units[0].lastTargetId,undefined);
});
test('equipped medical kit stabilizes a critical ally without restoring ordinary HP or ammunition',()=>{
 let s=field([{id:'p',x:1,y:1,hp:80,bleeding:2,medical:80},{id:'ally',x:2,y:1,hp:10,bleeding:5}]);
 const rounds=s.units[0].loaded;s=order(s,{type:'weapon',slot:'medical'});
 assert.equal(s.units[0].activeSlot,'medical');s=order(s,{type:'useItem',targetId:'ally'});
 assert.equal(s.units[1].hp,15);assert.equal(s.units[1].bleeding,0);assert.equal(s.units[1].bandaged,85);assert.equal(s.units[1].unconscious,false);assert.equal(s.units[1].ap,0);
 s=order(s,{type:'useItem',targetId:'p'});assert.equal(s.units[0].hp,80);assert.equal(s.units[0].medkits,0);assert.equal(s.units[0].loaded,rounds);
 const n=actBattle(s,{type:'useItem',unitId:'p',targetId:'ally'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('medical gear cannot shoot or charge and a blade uses the same target action',()=>{
 let s=field([{id:'p',x:1,y:1,blade:1813}],{enemies:[{id:'e',x:2,y:1,overwatch:false,morale:100}]});
 s=order(s,{type:'weapon',slot:'medical'});assert.ok(actBattle(s,{type:'charge',unitId:'p',targetId:'e'}).lastError);assert.ok(actBattle(s,{type:'useItem',unitId:'p',targetId:'e'}).lastError);
 s=order(s,{type:'weapon',slot:'blade'});const before=s.units[0].ap;s=order(s,{type:'useItem',targetId:'e'});
 assert.ok(s.units[1].hp<100);assert.equal(s.units[0].ap,before-actionCosts(s,s.units[0]).melee);
});
test('unbandaged bleeding continues in exploration and critical wounds do not recover from tactical rest',()=>{
 let s=field([{id:'p',x:1,y:1},{id:'ally',x:2,y:1,hp:10,bleeding:0}],{exploration:true,enemies:[]});
 s=endTurn(s);assert.equal(s.units[1].hp,10);assert.equal(s.units[1].unconscious,true);
 s.units[1].bleeding=2;s=endTurn(s);assert.equal(s.units[1].hp,0);assert.equal(s.units[1].bleeding,0);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('exploration movement accumulates time for every completed tile',()=>{
 const s=field([{id:'p',x:1,y:1}],{exploration:true,enemies:[]});
 assert.equal(order(s,{type:'move',x:2,y:1}).elapsedSeconds,3);
 assert.equal(order(s,{type:'move',x:5,y:1}).elapsedSeconds,12);
 assert.equal(order(s,{type:'move',x:5,y:1,movement:'run'}).elapsedSeconds,4);
});
test('new fields round-trip and malformed wound, stance or remembered-contact data are rejected',()=>{
 const s=field();s.units[0].activeSlot='medical';s.units[0].stance='crouched';
 const n=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.equal(n.units[0].activeSlot,'medical');
 for(const change of [{bandaged:101},{shock:21},{carriedAP:21},{experienceLevel:20},{lastKnownEnemy:{x:0,y:0,turn:99}}]){const corrupt=structuredClone(s);Object.assign(corrupt.units[0],change);assert.throws(()=>validateBattleSnapshot(corrupt));}
});
