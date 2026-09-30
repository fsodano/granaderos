import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,weaponFor} from '../game/tactical.js';
import {pointProjectileFlight} from '../game/projectile-cover.js';
import {grenadeBlastExposure} from '../game/grenade-flight.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field(actor={},npcs=[],extra={}){
 const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1800,loaded:1,condition:100,marksmanship:100,strength:100,...actor}],{
  width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'listener',name:'Escucha',x:6,y:3,facing:2,hp:20,overwatch:false,patrol:false},{id:'reserve',x:14,y:8,facing:2,overwatch:false,patrol:false}],npcs,...extra,
 });
 for(const unit of s.units)unit.ap=100;
 assert.equal(canSee(s,s.units[1],s.units[0]),false);return s;
}
function issue(s,action){const next=actBattle(s,{unitId:'p',...action});assert.equal(next.lastError,null,next.lastError);return next;}
function heardBeforeIncapacity(s,next,kind){
 const before=s.units[1],listener=next.units.find(u=>u.id===before.id);
 assert.equal(before.lastHeardNoise,undefined);assert.ok(listener.hp<15||listener.unconscious,'the impact incapacitates the listener');
 assert.equal(listener.lastHeardNoise?.kind,kind);assert.equal(listener.lastHeardNoise.sourceId,undefined);assert.equal(listener.lastHeardNoise.targetId,undefined);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
}

test('single and paired firearms record the initiating anonymous shot before it incapacitates the listener',()=>{
 for(const paired of [false,true])for(const type of ['fire','firePoint']){
  const s=field(paired?{weapon:1805,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:100,jammed:false,instanceId:'second'}}:{});
  if(paired)s.seed=127;
  const action=type==='fire'?{type,targetId:'listener',aim:4}:{type,x:6,y:3,aim:4};
  const next=issue(s,action);heardBeforeIncapacity(s,next,'fire');assert.equal(next.units[0].loaded,0);
  if(paired)assert.equal(next.units[0].offHand.loaded,1);
 }
});

test('a civilian remains in the initiating bullet path, then takes cover after the hit',()=>{
 const s=field({},[{id:'civil',name:'Vecino',x:4,y:3,hp:100,energy:100,stance:'standing'}]);
 const flight=pointProjectileFlight(s,s.units[0],{x:7,y:3},weaponFor(s.units[0]));assert.equal(flight.victimKind,'npc');
 const next=issue(s,{type:'firePoint',x:7,y:3,aim:4}),npc=next.npcs[0];
 assert.ok(npc.hp<100&&npc.hp>15);assert.equal(next.units[1].hp,s.units[1].hp);assert.equal(npc.ai.activity,'hiding');assert.equal(npc.stance,'prone');
 assert.equal(next.units[1].lastHeardNoise?.kind,'fire');
});

test('solid shot and canister preserve launch hearing for a casualty and still apply civilian impacts',()=>{
 for(const mode of ['solid','canister']){
  const s=field({x:1,y:2,explosives:75},[{id:'civil',name:'Vecino',x:7,y:3,hp:100,energy:100}],{artillery:[{id:'gun',type:'swivel',side:'player',x:2,y:3,facing:0,loaded:true,ammo:2}]});
  const next=issue(s,{type:'artillery',artilleryId:'gun',x:10,y:3,mode});heardBeforeIncapacity(s,next,'explosion');
  assert.ok(next.npcs[0].hp<100);assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,2);
 }
});

test('the grenade detonation is heard before blast incapacity and civilian cover follows the same blast',()=>{
 const s=field({activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack()}},[{id:'civil',name:'Vecino',x:6,y:4,hp:100,energy:100,stance:'standing'}]);
 const multiplier=grenadeBlastExposure(s,{x:6,y:3},s.npcs[0],3).multiplier;
 const next=issue(s,{type:'throwGrenade',x:6,y:3});heardBeforeIncapacity(s,next,'explosion');
 assert.equal(next.npcs[0].hp,100-Math.round(55*multiplier));assert.equal(next.npcs[0].stance,'prone');assert.equal(next.units[0].inventory.grenade,undefined);
});

test('a failed ignition creates neither a gunshot memory nor civilian fear',()=>{
 const s=field({condition:0},[{id:'civil',name:'Vecino',x:4,y:3,hp:100,energy:100,stance:'standing'}],{weather:{rain:100,humidity:100}});
 const next=issue(s,{type:'firePoint',x:7,y:3,aim:4});
 assert.equal(next.units[0].jammed,true);assert.equal(next.units[0].loaded,1);assert.equal(next.units[1].lastHeardNoise,undefined);
 assert.deepEqual(next.npcs,s.npcs);
});
