import {setReserve} from './typed-ammo-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,carriedWeight,supplyTransferPreview} from '../game/tactical.js';
import {returnAmmunition} from '../game/ammunition.js';
import {cartridgePrice} from '../game/campaign-rules.js';
import {order,saved} from './local-contract-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
const unit=(p,id)=>p.battle.units.find(u=>u.id===id);
const physical=b=>({units:b.units,ground:b.groundItems,drops:b.droppedWeapons,seed:b.seed,elapsed:b.elapsedSeconds});

test('actual paid soldiers share issued cartridges, the recipient fires and reloads, and the retreat retains the actual shared remainder',()=>{
 let p=secondaryLootField({companion:true});const total=p.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.loaded+u.ammo,0),mass=p.battle.units.reduce((n,u)=>n+carriedWeight(u),0),sourceAP=unit(p,'110').ap,receiverAP=unit(p,'111').ap;
 p=secondaryOrder(p,{type:'transferSupply',targetId:'111',item:'ammo',count:9});assert.equal(unit(p,'110').ammo,0);assert.equal(unit(p,'110').loaded,1);assert.equal(unit(p,'111').ammo,18);assert.equal(unit(p,'111').loaded,1);assert.equal(unit(p,'110').ap,sourceAP-4);assert.equal(unit(p,'111').ap,receiverAP);assert.ok(Math.abs(p.battle.units.reduce((n,u)=>n+carriedWeight(u),0)-mass)<1e-9);p={...saved(p),target:p.target};
 p=secondaryOrder(p,{type:'weapon',unitId:'111',slot:'primary'});p=secondaryOrder(p,{type:'fire',unitId:'111',targetId:p.battle.units.find(u=>u.side==='enemy'&&u.hp>0).id});assert.equal(unit(p,'111').loaded,0);assert.equal(unit(p,'111').ammo,18);p=secondaryOrder(p,{type:'reload',unitId:'111'});assert.equal(unit(p,'111').loaded,1);assert.equal(unit(p,'111').ammo,17);p={...saved(p),target:p.target};
 const money=p.campaign.resources.treasury,price=cartridgePrice(p.campaign);const c=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(c.resources.treasury,money);assert.equal([110,111].reduce((n,id)=>n+c.operativeState[id].ammo+c.operativeState[id].carriedLoaded,0),total-1);assert.equal(c.operativeState[111].ammo,17);assert.ok(saved({campaign:c}));
});
test('legacy shared refund accounting remains bounded, excludes dead holders and requires matching tactical evidence for redistribution',()=>{
 const request={issuedCartridges:20,squad:[{id:110,loaded:1,ammo:9},{id:111,loaded:1,ammo:9}],enemies:[]};const reports=[{id:'110',hp:80,loaded:1,ammo:0},{id:'111',hp:80,loaded:1,ammo:18}],snapshot={units:reports.map(r=>({...r,side:'player'}))};assert.equal(returnAmmunition(request,reports,snapshot),20);assert.equal(returnAmmunition(request,reports,null),11);
 reports[0].hp=0;snapshot.units[0].hp=0;assert.equal(returnAmmunition(request,reports,snapshot),19);assert.equal(returnAmmunition(request,reports,{units:[]}),10);
 const bad=structuredClone(reports);bad[1].ammo=19;assert.throws(()=>returnAmmunition(request,bad,snapshot),/no coincide/);snapshot.units[1].ammo=99;bad[1].ammo=99;assert.equal(returnAmmunition(request,bad,snapshot),20);assert.equal(returnAmmunition(request,[...bad,{id:'unknown',hp:80,ammo:100,loaded:1}],snapshot),20);
});
test('empty reserves, loaded-only sources, quantity overflow and excessive receiving totals cannot change cartridge custody',()=>{
 const fixture=()=>createBattle([{id:'sender',x:1,y:1,ammo:3,loaded:1},{id:'receiver',x:2,y:1,ammo:2,loaded:1}],{width:8,height:8,enemies:[{id:'guard',x:7,y:7,patrol:false}]});
 for(const [change,a]of [[b=>setReserve(b.units[0],0),{count:1}],[()=>{},{item:'loaded',count:1}],[()=>{},{count:4}],[()=>{},{count:1.5}],[b=>setReserve(b.units[1],99999),{count:1}],[b=>b.units[0].ap=3,{count:1}],[b=>b.units[1].x=6,{count:1}]]){const b=fixture();change(b);const action={type:'transferSupply',unitId:'sender',targetId:'receiver',item:'ammo',count:1,...a};assert.ok(supplyTransferPreview(b,b.units[0],b.units[1],action.item,action.count).reason);const n=actBattle(b,action);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(b));}
 const b=fixture();setReserve(b.units[1],99998);const n=actBattle(b,{type:'transferSupply',unitId:'sender',targetId:'receiver',item:'ammo',count:1});assert.match(n.lastError,/bolsillo/);assert.deepEqual(physical(n),physical(b));
});
test('exploration shares only loose cartridges for one second and cannot use the unsupported ground placement path',()=>{
 const b=createBattle([{id:'sender',x:1,y:1,ammo:3,loaded:1},{id:'receiver',x:2,y:1,ammo:0,loaded:1}],{width:8,height:8,enemies:[],exploration:true});b.units[0].ap=0;b.units[1].ap=0;const n=actBattle(b,{type:'transferSupply',unitId:'sender',targetId:'receiver',item:'ammo',count:3});assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds,b.elapsedSeconds+1);assert.equal(n.units[0].ammo,0);assert.equal(n.units[1].ammo,3);assert.equal(n.units[0].loaded,1);assert.equal(n.units[1].loaded,1);assert.equal(n.units[0].ap,0);assert.equal(n.units[1].ap,0);const rejected=actBattle(n,{type:'dropSupply',unitId:'receiver',item:'ammo',count:1});assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(n));
});
