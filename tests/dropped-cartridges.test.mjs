import {AMMO_KEYS} from '../game/ammo-types.js';
import {setReserve} from './typed-ammo-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
import {enterSector} from '../game/world.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,groundSupplyPickupPreview,supplyDropPreview} from '../game/tactical.js';
import {returnAmmunition} from '../game/ammunition.js';
import {cartridgePrice} from '../game/campaign-rules.js';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {saved,tactical,leave,visit,order} from './local-contract-fixture.mjs';
const actor=p=>p.battle.units.find(u=>u.id==='110');
const roundStock=b=>b.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.ammo+u.loaded,0);
const physical=b=>({units:b.units,ground:b.groundItems,elapsed:b.elapsedSeconds,seed:b.seed});
const field=(exploration=false)=>createBattle([{id:'a',x:1,y:1,loaded:1,ammo:9}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:7,y:7,patrol:false}]});

test('cartridge bundles preserve exact stock and charges through repeated drop, partial pickup, saves and campaign return',()=>{
 let p=supplyCareField();const price=cartridgePrice(p.campaign),treasury=p.campaign.resources.treasury,total=roundStock(p.battle),loaded=actor(p).loaded;
 p=tactical(p,{type:'dropSupply',unitId:'110',item:'ammoMusket',count:4});const groundId=p.battle.groundItems.find(g=>g.type==='ammoMusket').id;
 assert.equal(actor(p).loaded,loaded);assert.equal(actor(p).ammo,5);assert.equal(roundStock(p.battle),total-4);
 let s=leave(saved(p));assert.equal(s.resources.treasury,treasury+(total-4)*price);assert.equal(s.sectorStates.retiro.groundItems.find(g=>g.id===groundId).count,4);
 for(const quantity of [1,3]){
  const before=s.resources.treasury;p=visit(saved({campaign:s}).campaign);p=tactical(p,{type:'loot',unitId:'110',groundId,count:quantity});
  assert.equal(actor(p).ammo,9+quantity);s=leave(saved(p));assert.equal(s.resources.treasury,before+quantity*price);
 }
 const before=s.resources.treasury;p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.groundItems.find(g=>g.id===groundId).count,0);
 const denied=actBattle(p.battle,{type:'loot',unitId:'110',groundId,count:1});assert.ok(denied.lastError);assert.deepEqual(physical(denied),physical(p.battle));
 s=leave(p);assert.equal(s.resources.treasury,before);assert.ok(saved({campaign:s}));
});
test('picking up and dropping an old bundle again moves its custody without creating a refund or a second allowance',()=>{
 let p=supplyCareField();p=tactical(p,{type:'dropSupply',unitId:'110',item:'ammoMusket',count:4});let s=leave(saved(p)),money=s.resources.treasury;
 p=visit(saved({campaign:s}).campaign);const old=p.battle.groundItems.find(g=>g.type==='ammoMusket').id;
 p=tactical(p,{type:'loot',unitId:'110',groundId:old,count:4});p=tactical(p,{type:'dropSupply',unitId:'110',item:'ammoMusket',count:4});s=leave(saved(p));assert.equal(s.resources.treasury,money);
 p=visit(saved({campaign:s}).campaign);const bundles=p.battle.groundItems.filter(g=>g.type==='ammoMusket');assert.equal(bundles.reduce((n,g)=>n+g.count,0),4);assert.equal(bundles.find(g=>g.id===old).count,0);
 const current=bundles.find(g=>g.count>0);p=tactical(p,{type:'loot',unitId:'110',groundId:current.id,count:4});s=leave(saved(p));assert.equal(s.resources.treasury,money+4*cartridgePrice(s));
});
test('ground pickup allowance requires a prior finite source and cannot pay for new or duplicate bundles',()=>{
 const request={issuedCartridges:10,squad:[{id:110,ammo:9,loaded:1}],enemies:[]};
 const reports=[{id:'110',side:'player',hp:80,loaded:1,ammo:13}],snapshot={units:reports,groundItems:[{id:'old',type:'ammoMusket',count:0}]},previous={units:[],groundItems:[{id:'old',type:'ammoMusket',count:4}]};
 assert.equal(returnAmmunition(request,reports,snapshot),10);assert.equal(returnAmmunition(request,reports,snapshot,previous),14);
 previous.groundItems.push({...previous.groundItems[0]});assert.equal(returnAmmunition(request,reports,snapshot,previous),14);
 snapshot.groundItems[0].count=2;assert.equal(returnAmmunition(request,reports,snapshot,previous),12);
 snapshot.groundItems[0].count=8;assert.equal(returnAmmunition(request,reports,snapshot,previous),10);
 for(const type of AMMO_KEYS){previous.groundItems=[{id:'old',type,count:4}];snapshot.groundItems=[{id:'old',type,count:0}];assert.equal(returnAmmunition(request,reports,snapshot,previous),14);}
 previous.groundItems=[{id:'old',type:'ammoRifle',count:4}];snapshot.groundItems=[{id:'old',type:'ammoPistol',count:0}];assert.equal(returnAmmunition(request,reports,snapshot,previous),10);
 previous.groundItems=[{id:'old',type:'ammo',count:4}];snapshot.groundItems=[{id:'old',type:'ammoMusket',count:0}];assert.equal(returnAmmunition(request,reports,snapshot,previous),14);
 reports[0].hp=0;assert.equal(returnAmmunition(request,reports,snapshot,previous),0);
});
test('drop and pickup use ordinary action costs, loaded cartridges stay in the weapon, and invalid operations are atomic',()=>{
 for(const exploration of [false,true]){
  const b=field(exploration),n=actBattle(b,{type:'dropSupply',unitId:'a',item:'ammoMusket',count:3});assert.equal(n.lastError,null);assert.equal(n.units[0].loaded,1);assert.equal(n.units[0].ammo,6);assert.equal(n.units[0].ap,b.units[0].ap-(exploration?0:4));if(exploration)assert.equal(n.elapsedSeconds,b.elapsedSeconds+1);
  const g=n.groundItems[0],next=actBattle(n,{type:'loot',unitId:'a',groundId:g.id,count:2});assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].ammo,8);assert.equal(next.groundItems[0].count,1);assert.equal(next.units[0].ap,n.units[0].ap-(exploration?0:8));if(exploration)assert.equal(next.elapsedSeconds,n.elapsedSeconds+1);
 }
 for(const count of [0,-1,1.5,10,NaN,undefined,'2']){const b=field();assert.ok(supplyDropPreview(b,b.units[0],'ammoMusket',count).reason);const n=actBattle(b,{type:'dropSupply',unitId:'a',item:'ammoMusket',count});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 const b=field();setReserve(b.units[0],99999);b.groundItems=[{id:'oversized',type:'ammoMusket',count:3,x:1,y:2}];assert.ok(groundSupplyPickupPreview(b,b.units[0],'oversized',1).reason);const n=actBattle(b,{type:'loot',unitId:'a',groundId:'oversized',count:1});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));
});

test('combat retreat leaves unrefunded cartridges, and a later actual assault can recover and return that same finite stock',()=>{
 let p=secondaryLootField(),price=cartridgePrice(p.campaign),before=p.campaign.resources.treasury,issued=roundStock(p.battle);
 p=secondaryOrder(p,{type:'dropSupply',item:'ammoMusket',count:4});const id=p.battle.groundItems.find(g=>g.type==='ammoMusket').id;
 let s=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(s.resources.treasury,before+(issued-4)*price);
 s=order(saved({campaign:s}).campaign,{type:'attack',sector:'buenos_aires'});
 // Deployment advances the campaign clock and can collect ordinary sector income.
 // Compare the return with the treasury after those events and the new issue.
 const treasury=s.resources.treasury,newIssue=s.pendingBattle.issuedCartridges;
 p={campaign:s,battle:enterSector(s.pendingBattle,s.sectorStates.buenos_aires)};assert.equal(p.battle.groundItems.find(g=>g.id===id).count,4);
 p=secondaryOrder(p,{type:'loot',groundId:id,count:4});s=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(s.resources.treasury,treasury+(newIssue+4)*price);assert.equal(s.sectorStates.buenos_aires.groundItems.find(g=>g.id===id).count,0);assert.ok(saved({campaign:s}));
});
