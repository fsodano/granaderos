import test from 'node:test';
import assert from 'node:assert/strict';
import {actBattle,createBattle,lootPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {secondaryLootField,secondaryOrder,secondaryRetreat} from './secondary-loot-fixture.mjs';
import {saved,order} from './local-contract-fixture.mjs';
const physical=b=>({units:b.units,ground:b.groundItems,drops:b.droppedWeapons,seed:b.seed,elapsed:b.elapsedSeconds});
const fixture=(exploration=false)=>createBattle([{id:'p',x:1,y:1,ammo:0,loaded:1}],{width:8,height:8,exploration,enemies:[{id:'body',x:2,y:1,hp:0,ammo:5,loaded:1},...(exploration?[]:[{id:'guard',x:7,y:7,patrol:false}])]});
const ammoItem=body=>'inventory:'+Object.keys(body.inventory).find(key=>body.inventory[key].kind==='ammunition');
const take=(b,extra={})=>actBattle(b,{type:'loot',unitId:'p',targetId:'body',item:ammoItem(b.units[1]),count:2,...extra});

test('body collection rejects invalid quantities, mixed sources and blocked access without spending items or time',()=>{
 for(const [change,extra]of [[()=>{},{count:0}],[()=>{},{count:-1}],[()=>{},{count:null}],[()=>{},{count:1.5}],[()=>{},{count:Infinity}],[()=>{},{count:'2'}],[()=>{},{count:6}],[()=>{},{item:'loaded'}],[()=>{},{groundId:'bundle'}],[()=>{},{dropIndex:0}],[b=>b.units[0].ap=7,{}],[b=>b.units[1].fled=true,{}],[b=>b.units[1].departure=true,{}],[b=>b.units[1].hp=100,{}],[b=>{b.units[1].x=6;b.units[0].ap=8;},{}],[b=>{b.units[1].x=3;for(const t of b.tiles.filter(t=>t.x===2))Object.assign(t,{type:'wall',blocked:true});},{}],[()=>{},{item:'weapon',count:2}]]){
  const b=fixture();change(b);const n=take(b,extra);assert.ok(n.lastError,JSON.stringify({change:String(change),extra}));assert.deepEqual(physical(n),physical(b));
 }
});

test('partial recovery moves only the selected physical cartridges and keeps the body weapon loaded',()=>{
 for(const exploration of [false,true]){
  const b=fixture(exploration);if(exploration)b.units[0].ap=0;
  const action={targetId:'body',item:ammoItem(b.units[1]),count:2};assert.equal(lootPreview(b,b.units[0],action).valid,true);
  const n=take(b);assert.equal(n.lastError,null,n.lastError);assert.equal(n.units[0].ammo,2);assert.equal(n.units[1].ammo,3);assert.equal(n.units[1].loaded,1);assert.equal(Boolean(n.units[1].weaponDropped),false);
  assert.equal(n.units[0].ap,b.units[0].ap-(exploration?0:8));assert.equal(n.elapsedSeconds,b.elapsedSeconds+(exploration?1:6));assert.ok(validateBattleSnapshot(n));
 }
});

test('one overflowing object rejects a whole-body collection before moving weapons or supplies',()=>{
 const b=fixture();b.units[0].medkits=1000000;b.units[1].medkits=1;
 for(const item of ['all','medkits']){const n=take(b,{item,count:item==='all'?undefined:1});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
});

test('paid field recovery retains the exact body remainder and loaded gun through physical withdrawal and reentry',()=>{
 let p=secondaryLootField();const target=p.target,body=p.battle.units.find(u=>u.id===target),item=ammoItem(body),stack=body.inventory[item.slice(10)],type=stack.ammoType,ammo=stack.count,loaded=body.loaded;
 assert.ok(ammo>2);const initial=unitAmmunitionByType(p.battle.units.find(u=>u.id==='110'))[type]??0;
 p=secondaryOrder(p,{type:'loot',targetId:target,item,count:2});p={...saved(p),target};
 assert.equal(unitAmmunitionByType(p.battle.units.find(u=>u.id==='110'))[type],initial+2);
 assert.equal(p.battle.units.find(u=>u.id===target).inventory[item.slice(10)].count,ammo-2);
 p=secondaryRetreat(p);let c=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 c=saved({campaign:c}).campaign;c=order(c,{type:'attack',sector:'buenos_aires'});p=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.buenos_aires)});
 const retained=p.battle.units.find(u=>u.id===target||u.originalUnitId===target);assert.equal(retained.hp,0);assert.equal(retained.inventory[item.slice(10)].count,ammo-2);assert.equal(retained.loaded,loaded);assert.equal(Boolean(retained.weaponDropped),false);assert.ok(saved(p));
});
