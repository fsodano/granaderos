import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,actionCosts,reloadPlan} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {WEAPONS} from '../game/data.js';
import {addAmmunition,ammunitionByType,totalReserveAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
function field(patch={}){
 const s=createBattle([{id:'p',x:8,y:3,facing:6,hp:250,maxHp:250,loaded:0,experienceLevel:1}],{width:24,height:10,seed:45,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:2,y:3,facing:2,weapon:1805,weaponInstanceId:'main',loaded:0,ammo:3,condition:100,marksmanship:100,experienceLevel:1,offHand:{weapon:1808,count:1,weight:1.3,loaded:0,condition:100,jammed:false,instanceId:'second'},patrol:false,...patch}]});
 const u=enemy(s),count=patch.ammo??3,main=Math.min(count,Math.max(0,WEAPONS[u.weapon].capacity-u.loaded));
 // Keep the same finite total, with actual compatible loads for each gun.
 setTestAmmunition(u,main);if(count-main)addAmmunition(u,weaponAmmoType(u.offHand.weapon),count-main);syncUnitAmmunition(u);
 u.ap=patch.ap??100;return s;
}
const enemy=s=>s.units.find(u=>u.id==='e');
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));

test('AI maintenance can reload the main pistol when completing both would exceed its current AP',()=>{
 const s=field({ap:86}),u=enemy(s),before=structuredClone(s),plan=reloadPlan(u,s);assert.equal(plan.offhandPending,true);assert.equal(plan.pa,32);assert.equal(actionCosts(s,u).reload,32);
 assert.deepEqual(chooseEnemyAction(s,u),{type:'reload',unitId:'e'});assert.deepEqual(chooseEnemyAction(s,u),chooseEnemyAction(s,{...u,leftHandItem:null}));assert.deepEqual(s,before);
});

test('a real enemy turn reloads both held pistols with finite reserve and then pays a separate paired shot',()=>{
 const s=field(),before=structuredClone(s);assert.deepEqual(chooseEnemyAction(s,enemy(s)),{type:'reload',unitId:'e'});assert.equal(actionCosts(s,enemy(s)).reload,87);
 assert.deepEqual(ammunitionByType(enemy(s)),{pistol_69:1,pistol_54:2});
 const next=endTurn(s),u=enemy(next);assert.equal(next.lastError,null);assert.equal(u.loaded,0);assert.equal(u.offHand.loaded,1);assert.equal(totalReserveAmmunition(u),0);assert.equal(u.ap,2);assert.equal(u.condition,99);assert.equal(u.offHand.condition,99);assert.equal(u.weaponInstanceId,'main');assert.equal(u.offHand.instanceId,'second');assert.ok(next.units[0].hp<250);assert.equal(next.elapsedSeconds,6);assert.ok(next.log.some(line=>line.includes('recarga ambas pistolas (87 PA)')));
 assert.deepEqual(next,endTurn(restore(s)));assert.doesNotThrow(()=>restore(next));assert.deepEqual(s,before);
});

test('AI continues paid partial main loading without spending a cartridge or touching the second gun',()=>{
 const s=field({ap:10,reloadProgress:.5}),u=enemy(s);assert.equal(actionCosts(s,u).reload,16);assert.deepEqual(chooseEnemyAction(s,u),{type:'reload',unitId:'e'});
 const next=endTurn(s),v=enemy(next);assert.equal(next.lastError,null);assert.equal(v.loaded,0);assert.equal(v.reloadProgress,.8125);assert.equal(totalReserveAmmunition(v),3);assert.equal(v.ap,0);assert.deepEqual(v.offHand,u.offHand);assert.deepEqual(next,endTurn(restore(s)));assert.doesNotThrow(()=>restore(next));
});

test('a loaded primary retains its firing priority while a jammed primary still requires reprime',()=>{
 const loaded=field({loaded:1,ap:20}),u=enemy(loaded);assert.equal(reloadPlan(u,loaded).hands[0].hand,'offhand');assert.equal(chooseEnemyAction(loaded,u).type,'fire');assert.deepEqual(chooseEnemyAction(loaded,u),chooseEnemyAction(loaded,{...u,leftHandItem:null}));
 const jammed=field({jammed:true,priming:1});assert.deepEqual(chooseEnemyAction(jammed,enemy(jammed)),{type:'reprime',unitId:'e'});
});
