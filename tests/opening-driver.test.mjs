import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,shotChance,actionCosts,canSee} from '../game/tactical.js';
import {combatOrder} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
const tiles=Array.from({length:384},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}));
const field=(players,enemy={})=>createBattle(players,{width:32,height:12,tiles,seed:45,enemies:[{id:'e',x:5,y:1,weapon:1813,patrol:false,hp:200,maxHp:200,...enemy}]});
const apply=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null);return n;};

test('the opening driver keeps hit chance while declining aim that adds no benefit',()=>{
 const s=field([{id:'p',x:1,y:1,weapon:1808,stance:'prone',facing:2,marksmanship:100}]),u=s.units[0],target=s.units[1],copy=structuredClone(s);
 assert.equal(shotChance(s,u,target,0),shotChance(s,u,target,4));
 const order=combatOrder(s,u);assert.equal(order.type,'fire');assert.equal(order.aim,0);assert.deepEqual(s,copy);
 const next=apply(s,order);assert.equal(next.units[0].ap,u.ap-actionCosts(s,u,target).fire);assert.equal(next.units[0].loaded,u.loaded-1);
});

test('the opening driver budgets turning before extra aim',()=>{
 const s=field([{id:'p',x:1,y:1,weapon:1808,stance:'prone',facing:2,marksmanship:40}],{x:1,y:5}),u=s.units[0],target=s.units[1];u.ap=22;
 const costs=actionCosts(s,u,target);assert.equal(costs.fire,16);assert.equal(costs.aim,3);
 const order=combatOrder(s,u);assert.equal(order.type,'fire');assert.equal(order.aim,2);
 const next=apply(s,order);assert.equal(next.units[0].ap,0);assert.equal(next.units[0].facing,4);
});

test('a commander with no dressings and only a critical ally can stand and then search',()=>{
 let s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'prone',medkits:0},{id:'patient',x:2,y:1,hp:9,maxHp:100,bandaged:91}],{x:31,y:11});
 const first=combatOrder(s,s.units[0]);assert.deepEqual(first,{type:'stance',unitId:'57',stance:'standing'});
 s=apply(s,first);const second=combatOrder(s,s.units[0]);assert.equal(second.type,'move');assert.equal(second.tacticalLevel,0,'reconnaissance retains its intended ground floor');
 const start={x:s.units[0].x,y:s.units[0].y},next=apply(s,second);assert.notDeepEqual({x:next.units[0].x,y:next.units[0].y},start);assert.equal(next.units[1].hp,9);
});

test('the opening driver treats a critical ally after equipping medical supplies and then restores its gun',()=>{
 let s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'prone',medical:60,medkits:2},{id:'patient',x:2,y:1,hp:1,maxHp:100,bandaged:99,bleeding:0}],{x:31,y:11});
 s.units[0].ap=100;
 const orders=[];
 for(let i=0;i<4;i++){const order=combatOrder(s,s.units[0]);orders.push(order);s=apply(s,order);}
 assert.deepEqual(orders.map(order=>order.type),['weapon','useItem','useItem','weapon']);
 assert.deepEqual(orders.filter(order=>order.type==='weapon').map(order=>order.slot),['medical','primary']);
 assert.equal(s.units[1].hp,15);assert.equal(s.units[1].bleeding,0);assert.equal(s.units[1].unconscious,false);assert.equal(s.units[1].ap,0);
 assert.equal(s.units[0].medkits,0);assert.equal(s.units[0].ap,42);
});

test('the commander still waits for able infantry and takes a firing posture at contact',()=>{
 let s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'standing'},{id:'p',x:2,y:1}],{x:31,y:11});
 assert.equal(combatOrder(s,s.units[0]),null);
 s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'standing'},{id:'patient',x:2,y:1,hp:9,maxHp:100,bandaged:91}],{x:4,y:2});
 const order=combatOrder(s,s.units[0]);assert.deepEqual(order,{type:'stance',unitId:'57',stance:'prone'});
});


test('the opening driver does not prescribe adjacent medical use across a visible roof edge',()=>{
 const s=createBattle([{id:'medic',x:1,y:1,medical:70,medkits:2,activeSlot:'medical'},{id:'patient',x:2,y:1,tacticalLevel:1,hp:60,maxHp:100,bleeding:5}],{width:32,height:12,tiles,seed:45,upperSurfaces:[{id:'roof',x:2,y:1,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0}],enemies:[{id:'e',x:31,y:11,patrol:false}]});
 const before=structuredClone(s),order=combatOrder(s,s.units[0]);
 assert.deepEqual(order,{type:'weapon',unitId:'medic',slot:'primary'});
 assert.deepEqual(s,before);const next=apply(s,order);
 assert.equal(next.units[1].bleeding,s.units[1].bleeding);assert.equal(next.units[0].medkits,2);
});

test('the route controller does not reprime a stowed firearm while a blade is held',()=>{
 const s=field([{id:'p',x:1,y:1,weapon:1800,blade:1811,activeSlot:'blade',jammed:true}],{x:31,y:11});
 const u=s.units[0],before=structuredClone(s);assert.equal(u.jammed,true);assert.equal(u.activeSlot,'blade');
 const order=combatOrder(s,u);assert.notEqual(order?.type,'reprime');assert.deepEqual(s,before);
 if(order)apply(s,order);
});

test('a roof defender fires at a visible ground target instead of repeatedly lowering behind the roof edge',()=>{
 const upperSurfaces=Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const s=createBattle([{id:'p',x:5,y:4,tacticalLevel:1,weapon:1800,facing:0,marksmanship:90,medkits:0,stance:'standing'}],{width:32,height:12,tiles,upperSurfaces,seed:45,enemies:[{id:'e',x:5,y:2,weapon:1813,patrol:false,hp:200,maxHp:200,overwatch:false}]}),before=structuredClone(s),u=s.units[0],target=s.units[1];
 assert.equal(canSee(s,u,target),true);assert.equal(canSee(s,{...u,stance:'prone'},target),false);
 const order=cautiousCombatOrder(s,u);assert.equal(order.type,'fire');assert.deepEqual(s,before);
 const next=apply(s,order);assert.equal(next.units[0].stance,'standing');assert.equal(next.units[0].loaded,u.loaded-1);assert.ok(next.units[0].ap<u.ap);assert.ok(next.units[1].hp<target.hp);
 assert.deepEqual(apply(before,order),next,'the paid shot replays without a posture loop');
});

test('a cautious rifleman still lowers and fires when the prone shot remains visible',()=>{
 let s=field([{id:'p',x:1,y:1,weapon:1800,facing:2,marksmanship:90,medkits:0,stance:'standing'}],{x:5,y:1,overwatch:false});
 const first=cautiousCombatOrder(s,s.units[0]);assert.deepEqual(first,{type:'stance',unitId:'p',stance:'prone'});
 s=apply(s,first);const next=cautiousCombatOrder(s,s.units[0]);assert.equal(next.type,'fire');
 const fired=apply(s,next);assert.equal(fired.units[0].loaded,0);assert.ok(fired.units[0].ap<s.units[0].ap);
});
