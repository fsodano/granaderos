import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee} from '../game/tactical.js';
import {searchOrder} from '../game/autonomous-orders.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(militia={},enemy={})=>createBattle([{id:'m',militia:true,x:2,y:4,facing:2,weapon:1800,loaded:1,ammo:3,condition:44,weaponReady:true,...militia}],{width:32,height:12,seed:127,exploration:true,tiles:Array.from({length:384},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:27,y:4,facing:6,patrol:false,marksmanship:0,overwatch:false,...enemy}]});
const position=u=>({x:u.x,y:u.y});
test('militia scout one tile during exploration without AP or ammunition costs',()=>{
 const b=field(),before=structuredClone(b),m=b.units[0],n=actBattle(b,{type:'ambient'}),u=n.units[0];
 assert.equal(n.lastError,null);assert.equal(n.mode,'exploration');assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,b.turn);assert.equal(u.ap,m.ap);assert.ok(Math.hypot(u.x-m.x,u.y-m.y)>0);assert.ok(Math.hypot(u.x-m.x,u.y-m.y)<=Math.SQRT2);assert.ok(u.energy<m.energy);assert.equal(u.weaponReady,undefined);
 for(const key of ['loaded','ammo','condition','inventory'])assert.deepEqual(u[key],m[key]);assert.deepEqual(b,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('a militia-only patrol establishes real visual contact and ambient movement then stops',()=>{
 let b=field(),ticks=0;assert.equal(canSee(b,...b.units),false);while(b.mode==='exploration'&&ticks++<60)b=actBattle(b,{type:'ambient'});
 assert.ok(ticks<60);assert.equal(b.mode,'combat');assert.equal(b.sectorCleared,false);assert.ok(canSee(b,b.units[0],b.units[1])||canSee(b,b.units[1],b.units[0]));assert.equal(b.log.filter(line=>line.includes('Contacto visual')).length,1);assert.ok(b.units[1].hp>0);
 const n=actBattle(b,{type:'ambient'});assert.deepEqual(n.units,b.units);assert.equal(n.elapsedSeconds,b.elapsedSeconds);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('anonymous search waypoints do not change when an unseen enemy changes position',()=>{
 const b=field(),hidden=structuredClone(b);hidden.units[1].x=30;hidden.units[1].y=10;
 const planned=s=>searchOrder({...s,mode:'combat'},{...s.units[0],ap:100},{changeStance:false});assert.ok(planned(b));assert.deepEqual(planned(hidden),planned(b));assert.deepEqual(position(actBattle(hidden,{type:'ambient'}).units[0]),position(actBattle(b,{type:'ambient'}).units[0]));
});
test('a saved patrol retains its cadence, energy and next contact exactly',()=>{
 let b=actBattle(field(),{type:'ambient'});let saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));for(let i=0;i<20;i++){b=actBattle(b,{type:'ambient'});saved=actBattle(saved,{type:'ambient'});assert.deepEqual(saved,b);if(b.mode==='combat')break;}
});
test('incapacitated or bound militia cannot scout and hired soldiers remain under manual control',()=>{
 for(const patch of [{knockedDown:true,stance:'prone',weaponReady:undefined},{entangled:true},{hp:14,weaponReady:undefined},{militia:false}]){const b=field(patch),n=actBattle(b,{type:'ambient'});assert.deepEqual(position(n.units[0]),position(b.units[0]));assert.equal(n.units[0].ap,b.units[0].ap);}
});
