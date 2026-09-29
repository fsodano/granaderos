import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,bladeFor,weaponFor,hasFirearm,carriedWeight,actionCosts,WEAPONS} from '../game/tactical.js';
import {BUTTSTOCK} from '../game/unarmed-combat.js';
import {weaponRecord} from '../game/weapon-definition.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {order,saved,tactical} from './local-contract-fixture.mjs';
import {buttstockField} from './buttstock-fixture.mjs';
const fixture=(extra={})=>createBattle([{id:'p',x:1,y:1,weapon:1800,...extra}],{width:10,height:8,enemies:[{id:'e',x:2,y:1,weapon:1800,morale:100,patrol:false},{id:'far',x:9,y:7,patrol:false}],seed:45});

test('all nine held firearm families strike with their stock and preserve each loaded or jammed mechanism',()=>{
 for(const weapon of Object.keys(WEAPONS).map(Number))for(const condition of [{loaded:WEAPONS[weapon].capacity,condition:100,jammed:false},{loaded:0,reloadProgress:.4,condition:37,jammed:true}]){
  const b=fixture({weapon,...condition}),before=structuredClone(b),record=weaponRecord(b.units[0]),weight=carriedWeight(b.units[0]);
  const n=actBattle(b,{type:'melee',unitId:'p',targetId:'e'});
  assert.equal(n.lastError,null);assert.equal(n.units[0].ap,84);assert.equal(n.units[1].hp,82);assert.deepEqual(bladeFor(n.units[0]),BUTTSTOCK);assert.equal(hasFirearm(n.units[0]),true);assert.equal(weaponFor(n.units[0]).id,weapon);assert.deepEqual(weaponRecord(n.units[0]),record);assert.equal(n.units[0].ammo,b.units[0].ammo);assert.equal(carriedWeight(n.units[0]),weight);assert.deepEqual(n.units[0].inventory,b.units[0].inventory);assert.deepEqual(b,before);assert.ok(validateBattleSnapshot(n));
 }
});
test('stock range, AP, bayonet brace and charge failures leave all resources and the random stream unchanged',()=>{
 for(const [change,type]of [[b=>b.units[1].x=3,'melee'],[b=>b.units[0].ap=15,'melee'],[()=>{},'brace'],[()=>{},'charge']]){
  const b=fixture();change(b);const n=actBattle(b,{type,unitId:'p',targetId:'e'});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.equal(n.seed,b.seed);assert.equal(n.elapsedSeconds,b.elapsedSeconds);
 }
 const b=fixture(),controls=orderDescriptors(b,b.units[0]);assert.equal(controls.find(d=>d.id==='charge').disabled,true);assert.equal(controls.find(d=>d.id==='melee').label,'Golpear con la culata');assert.equal(controls.find(d=>d.id==='melee').pa,16);
});
test('selecting an owned secondary permits its real charge while empty hands use their separate action',()=>{
 let b=fixture({blade:1809});const gun=weaponRecord(b.units[0]),weight=carriedWeight(b.units[0]);b=actBattle(b,{type:'weapon',unitId:'p',slot:'blade'});assert.equal(b.lastError,null);assert.equal(bladeFor(b.units[0]).id,1809);assert.equal(orderDescriptors(b,b.units[0]).find(d=>d.id==='charge').disabled,false);
 const charged=actBattle(b,{type:'charge',unitId:'p',targetId:'e'});assert.equal(charged.lastError,null);assert.ok(charged.units[1].hp<b.units[1].hp);assert.deepEqual(weaponRecord(charged.units[0]),gun);
 b=actBattle(b,{type:'weapon',unitId:'p',slot:'unarmed'});assert.equal(b.lastError,null);assert.equal(bladeFor(b.units[0]).id,0);assert.equal(actionCosts(b,b.units[0]).melee,12);assert.equal(carriedWeight(b.units[0]),weight);
 b=actBattle(b,{type:'weapon',unitId:'p',slot:'primary'});assert.equal(b.lastError,null);assert.deepEqual(bladeFor(b.units[0]),BUTTSTOCK);assert.deepEqual(weaponRecord(b.units[0]),gun);
});
test('an autonomous empty gun uses actual stock contact and reloads at distance instead of ordering an unsupported charge',()=>{
 const make=x=>createBattle([{id:'p',x:1,y:1,hp:500,maxHp:500,weapon:0,ammo:0,loaded:0,morale:100}],{width:10,height:8,tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x,y:1,weapon:1800,blade:0,loaded:0,ammo:1,patrol:false,morale:100}],seed:45});
 let b=make(2),n=endTurn(b);assert.equal(n.units[1].loaded,0);assert.equal(n.units[1].ammo,1);assert.equal(n.units[1].ap,4);assert.equal(n.units[0].hp,382);assert.equal(n.units[0].bleeding,10);assert.equal(n.log.filter(t=>t.includes('18 de daño')).length,6);assert.equal(n.units[1].braced,false);assert.equal(n.lastError,null);
 b=make(5);n=endTurn(b);assert.equal(n.lastError,null);assert.equal(n.units[1].ammo,0);assert.ok(n.log.some(t=>t.includes('recarga')));assert.ok(!n.log.some(t=>t.includes('ejecuta una carga')));assert.ok(validateBattleSnapshot(n));
});
test('an actual paid hire can stock-strike with an authored gun, save, retreat and return with the same gun and secondary',()=>{
 let p=buttstockField(),u=p.battle.units.find(u=>u.id==='110'),target=p.battle.units.find(u=>u.id===p.target);const targetId=target.id,hp=target.hp,record=weaponRecord(u),secondary=weaponRecord(u,'blade'),weight=carriedWeight(u);
 p=tactical(p,{type:'melee',unitId:'110',targetId});u=p.battle.units.find(u=>u.id==='110');target=p.battle.units.find(u=>u.id===targetId);assert.ok(target.hp<hp);assert.ok(target.hp>=hp-18);assert.equal(u.ap,84);assert.deepEqual(weaponRecord(u),record);assert.deepEqual(weaponRecord(u,'blade'),secondary);assert.equal(carriedWeight(u),weight);p=saved(p);
 let campaign=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});campaign=order(saved({campaign}).campaign,{type:'attack',sector:'buenos_aires'});p=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires)});u=p.battle.units.find(u=>u.id==='110');assert.deepEqual(weaponRecord(u),record);assert.deepEqual(weaponRecord(u,'blade'),secondary);assert.equal(bladeFor(u).id,-1);assert.equal(weaponFor(u).name,'Fusil de Acosta');assert.equal(weaponFor(u).art,'/art/weapon-1801.png');
});
