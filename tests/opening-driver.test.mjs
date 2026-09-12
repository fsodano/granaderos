import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,shotChance,actionCosts} from '../game/tactical.js';
import {combatOrder} from './opening-driver.mjs';
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

test('a commander with only a critical ally can stand and then search instead of changing posture forever',()=>{
 let s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'prone'},{id:'patient',x:2,y:1,hp:9,maxHp:100,bandaged:91}],{x:31,y:11});
 const first=combatOrder(s,s.units[0]);assert.deepEqual(first,{type:'stance',unitId:'57',stance:'standing'});
 s=apply(s,first);const second=combatOrder(s,s.units[0]);assert.equal(second.type,'move');
 const start={x:s.units[0].x,y:s.units[0].y},next=apply(s,second);assert.notDeepEqual({x:next.units[0].x,y:next.units[0].y},start);assert.equal(next.units[1].hp,9);
});

test('the commander still waits for able infantry and takes a firing posture at contact',()=>{
 let s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'standing'},{id:'p',x:2,y:1}],{x:31,y:11});
 assert.equal(combatOrder(s,s.units[0]),null);
 s=field([{id:'57',x:1,y:1,missionAlly:true,weapon:1808,stance:'standing'},{id:'patient',x:2,y:1,hp:9,maxHp:100,bandaged:91}],{x:4,y:2});
 const order=combatOrder(s,s.units[0]);assert.deepEqual(order,{type:'stance',unitId:'57',stance:'prone'});
});
