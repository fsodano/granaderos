import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,shotChance,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const field=(extra={})=>createBattle([{id:'p',x:1,y:1,marksmanship:85,weapon:1800,blade:1810}],{
 width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),
 enemies:[{id:'e',x:5,y:1,morale:100,overwatch:false}],...extra,
});
const shoot=(s,hitLocation)=>actBattle(s,{type:'useItem',unitId:'p',targetId:'e',hitLocation});

test('location preview and fire use the same range penalty and leave torso unchanged',()=>{
 const s=field(),[a,t]=s.units;
 assert.equal(shotChance(s,a,t),shotChance(s,a,t,0,'torso'));
 assert.equal(shotChance(s,a,t,0,'head'),shotChance(s,a,t)-12);
 assert.equal(shotChance(s,a,t,0,'legs'),shotChance(s,a,t)-4);
 const torso=shoot(s,'torso'),head=shoot(s,'head');
 assert.equal(torso.lastError,null);assert.equal(head.lastError,null);
 assert.ok(head.units[1].hp<torso.units[1].hp);assert.equal(head.units[1].lastHitLocation,'head');
 assert.equal(torso.units[0].ap,head.units[0].ap);assert.equal(torso.seed,head.seed);
});
test('strong leg hits reduce breath and balance, unhorse a survivor, and require standing',()=>{
 const s=field({enemies:[{id:'e',x:5,y:1,morale:100,mounted:true}]}),torso=shoot(s,'torso'),legs=shoot(s,'legs'),target=legs.units[1];
 assert.equal(legs.lastError,null);assert.ok(target.hp>torso.units[1].hp);assert.ok(target.energy<torso.units[1].energy);
 assert.equal(target.knockedDown,true);assert.equal(target.mounted,false);assert.equal(target.stance,'prone');assert.equal(target.movementMode,'prone');assert.ok(target.ap<s.units[1].ap);
 assert.doesNotThrow(()=>validateBattleSnapshot(legs));
});
test('bad location orders are rejected before spending AP, ammunition, random draws or time',()=>{
 const s=field(),n=shoot(s,'eyes');assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
 const bad=structuredClone(s);bad.units[0].lastHitLocation='eyes';assert.throws(()=>validateBattleSnapshot(bad));
});
test('aimed body shots remain ordinary item actions inside a saved interrupt',()=>{
 let s=field({enemies:[{id:'e',x:7,y:1,weapon:1813,morale:100}]});s.units[0].ap=30;
 s=validateBattleSnapshot(endTurn(s));assert.equal(s.phase,'interrupt');
 const n=actBattle(s,{type:'useItem',unitId:'p',targetId:'e',hitLocation:'legs',aim:1});
 assert.equal(n.lastError,null);assert.equal(n.units[0].ap,12);assert.equal(n.phase,'interrupt');assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[1].lastHitLocation,'legs');assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('medical targeting ignores old firearm location settings',()=>{
 const s=field();Object.assign(s.units[0],{activeSlot:'medical',hp:80,bleeding:2,medical:80,medkits:2});
 const n=actBattle(s,{type:'useItem',unitId:'p',targetId:'p',hitLocation:'head'});
 assert.equal(n.lastError,null);assert.equal(n.units[0].hp,80);assert.equal(n.units[0].bleeding,0);assert.equal(n.units[0].medkits,1);
});
test('changing items invalidates the remembered firing target',()=>{
 const s=shoot(field(),'torso');assert.equal(s.units[0].lastTargetId,'e');
 const n=actBattle(s,{type:'weapon',unitId:'p',slot:'blade'});assert.equal(n.lastError,null);
 assert.equal(n.units[0].lastTargetId,undefined);assert.equal(n.units[0].lastShotPosition,undefined);
});
