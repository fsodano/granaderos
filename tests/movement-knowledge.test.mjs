import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const field=()=>createBattle([{id:'p',x:5,y:2,facing:2}],{
 width:12,height:6,seed:45,
 tiles:Array.from({length:72},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
 enemies:[{id:'hidden',x:1,y:2,overwatch:false,patrol:false}]
});

test('movement follows the observed route and stops before an unseen occupied destination',()=>{
 const s=field(),before=structuredClone(s);
 assert.equal(canSee(s,s.units[0],s.units[1]),false);
 const n=actBattle(s,{type:'move',unitId:'p',x:1,y:2});
 assert.equal(n.lastError,null);assert.equal(n.units[0].x,2);assert.equal(n.units[0].y,2);
 assert.ok(n.units[0].ap<s.units[0].ap);assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[1].x,1);assert.deepEqual(s,before);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
 assert.deepEqual(n,actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{type:'move',unitId:'p',x:1,y:2}));
});

test('a known occupied destination remains an atomic invalid order',()=>{
 const s=field();s.units[0].facing=6;
 assert.equal(canSee(s,s.units[0],s.units[1]),true);
 const n=actBattle(s,{type:'move',unitId:'p',x:1,y:2});
 assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,0);
});

test('hidden occupancy on an intermediate cell stops the route instead of secretly detouring',()=>{
 const s=field();s.units[1].x=2;
 assert.equal(canSee(s,s.units[0],s.units[1]),false);
 const n=actBattle(s,{type:'move',unitId:'p',x:0,y:2});
 assert.equal(n.lastError,null);assert.equal(n.units[0].x,3);assert.equal(n.units[0].y,2);
 assert.ok(n.units[0].ap<s.units[0].ap);assert.equal(n.units[1].x,2);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('shared player sight retains a known obstruction even when the mover faces away',()=>{
 const s=field();s.units.push({...structuredClone(s.units[0]),id:'spotter',x:0,y:2,facing:2});
 assert.equal(canSee(s,s.units[0],s.units[1]),false);assert.equal(canSee(s,s.units[2],s.units[1]),true);
 const n=actBattle(s,{type:'move',unitId:'p',x:1,y:2});
 assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,0);
});

test('an unseen civilian blocks actual passage without rejecting the distant plan',()=>{
 const s=field();s.units[1].x=10;s.units[1].y=5;
 s.npcs=[{id:'civilian',name:'Vecino',x:1,y:2,hp:100,maxHp:100,civilianHealthVersion:1}];
 assert.equal(canSee(s,s.units[0],s.npcs[0]),false);
 const n=actBattle(s,{type:'move',unitId:'p',x:1,y:2});
 assert.equal(n.lastError,null);assert.equal(n.units[0].x,2);assert.deepEqual(n.npcs,s.npcs);
 assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
