import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_AMMUNITION_MARKET,validateAmmunitionMarket,ammunitionMarketRules} from '../game/ammunition-market-rules.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,deploymentCost,rosterFor} from '../game/campaign.js';
import {ammunitionOrderQuote,restockAmmunitionShops,prepareCampaignAmmunition,syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {addAmmunition} from '../game/ammunition-types.js';
const profile=()=>structuredClone(DEFAULT_AMMUNITION_MARKET);
const content=()=>{const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.rules.cartridgePrice=3;d.ammunitionMarket={defaults:profile(),locations:{}};return d;};
const hire=d=>order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'month'});
const buy=(s,n,key='ammoMusket',direction='buy')=>order(s,{type:'ammunition',operativeId:110,family:key,quantity:n,direction});

test('optional supplier rules preserve old package identity and strictly validate all profiles',()=>{
 const old=defaultContentPackage();assert.equal(old.ammunitionMarket,undefined);assert.deepEqual(parseContentPackage(JSON.stringify(old)),old);
 const d=content();assert.deepEqual(validateAmmunitionMarket(d.ammunitionMarket),[]);assert.deepEqual(parseContentPackage(JSON.stringify(d)),d);
 for(const mutate of [m=>m.extra=1,m=>m.locations=[],m=>m.defaults.enabled=1,m=>m.defaults.automaticPurchase='yes',m=>m.defaults.restockHours=0,m=>m.defaults.restockHours=721,m=>m.defaults.restockHours=1.5,m=>delete m.defaults.families.ammoShot,m=>m.defaults.families.foo={},m=>m.defaults.families.ammoRifle.initial=61,m=>m.defaults.families.ammoRifle.capacity=-1,m=>m.defaults.families.ammoRifle.replenish=.5,m=>m.defaults.families.ammoRifle.price='3',m=>m.locations.uspallata=profile(),m=>m.locations['cell-27-27']=profile(),m=>m.locations.mendoza={...profile(),extra:1}]){const bad=structuredClone(d);mutate(bad.ammunitionMarket);assert.ok(validateAmmunitionMarket(bad.ammunitionMarket).length);assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(8,bad));}
});

test('local supplier prices and finite initial stock are pinned across purchases, deployment and saves',()=>{
 const d=content(),local=profile();local.families.ammoMusket={initial:7,capacity:12,replenish:2,price:5};d.ammunitionMarket.locations.retiro=local;
 let s=hire(d),cash=s.resources.treasury;d.ammunitionMarket.locations.retiro.families.ammoMusket.price=999;
 assert.equal(deploymentCost(s),35);s=buy(s,2);assert.equal(s.resources.treasury,cash-10);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,5);
 const p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.units[0].loaded+p.battle.units[0].ammo,7);assert.equal(p.campaign.resources.treasury,cash-35);s=leave(p);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,0);assert.equal(deploymentCost(s),0);assert.deepEqual(saved({campaign:s}).campaign,s);
 assert.equal(ammunitionMarketRules(s,'mendoza').families.ammoMusket.price,null);
 const op=rosterFor(s).find(o=>o.id===110);assert.equal(ammunitionOrderQuote(s,op,'ammoRifle',1,'buy',true).unitPrice,3);
});

test('an initially empty supplier replenishes after actual supplied hours and restore never refills it',()=>{
 const d=content();d.ammunitionMarket.defaults.restockHours=2;d.ammunitionMarket.defaults.families.ammoMusket={initial:0,capacity:5,replenish:3,price:0};
 let s=hire(d);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,0);s=order(s,{type:'wait',hours:1});assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,0);s=saved({campaign:s}).campaign;s=order(s,{type:'wait',hours:1});assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,3);
 const cash=s.resources.treasury;s=buy(s,2);assert.equal(s.resources.treasury,cash);s=saved({campaign:s}).campaign;assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,1);s=order(s,{type:'wait',hours:4});assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,5);assert.equal(s.ammunitionShops.mendoza.stock.ammoMusket,0);
 const before=structuredClone(s.ammunitionShops);restockAmmunitionShops(s,()=>false);assert.deepEqual(s.ammunitionShops,before);
 for(const mutate of [s=>delete s.ammunitionShops.retiro,s=>s.ammunitionShops.retiro.restockHours=2,s=>s.ammunitionShops.retiro.stock.ammoMusket=6]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>saved({campaign:bad}));}
});

test('manual-only suppliers load owned ammunition without buying it again; disabled suppliers preserve storage',()=>{
 const d=content();d.ammunitionMarket.defaults.automaticPurchase=false;let s=hire(d),cash=s.resources.treasury;assert.equal(deploymentCost(s),0);s=buy(s,4);const p=visit(s);assert.equal(p.battle.units[0].loaded,1);assert.equal(p.battle.units[0].ammo,3);s=leave(p);assert.equal(s.resources.treasury,cash-12);
 // A disabled destination remains a place to keep owned rounds, never a vendor.
 d.ammunitionMarket.defaults.enabled=false;let closed=hire(d);addAmmunition(closed.operativeState[110],'musket_75',4);syncCarriedAmmunition(closed.operativeState[110],rosterFor(closed).find(o=>o.id===110).weapon);
 closed=buy(closed,2,'ammoMusket','store');closed=buy(closed,1,'ammoMusket','take');const before=structuredClone(closed.ammunitionShops);restockAmmunitionShops(closed,()=>true);assert.deepEqual(closed.ammunitionShops,before);
 const rejected=dispatchCampaign(closed,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:1,direction:'buy'});assert.match(rejected.lastError,/proveedor habilitado/);assert.equal(rejected.resources.treasury,closed.resources.treasury);
 const prepared=prepareCampaignAmmunition(closed,rosterFor(closed),[110],{supplied:true});assert.equal(prepared.cost,0);assert.equal(prepared.allocation[110].loaded,1);assert.equal(prepared.allocation[110].ammo,2);assert.deepEqual(saved({campaign:closed}).campaign,closed);
});

test('local stock limits, replenish clocks and zero replenishment are independent',()=>{
 const d=content();d.ammunitionMarket.locations.retiro=profile();Object.assign(d.ammunitionMarket.locations.retiro,{restockHours:1});d.ammunitionMarket.locations.retiro.families.ammoRifle={initial:0,capacity:0,replenish:100,price:0};d.ammunitionMarket.locations.retiro.families.ammoMusket.replenish=0;
 let s=hire(d);s=buy(s,1);s=order(s,{type:'wait',hours:24});assert.equal(s.ammunitionShops.retiro.stock.ammoRifle,0);assert.equal(s.ammunitionShops.retiro.stock.ammoMusket,179);assert.equal(s.ammunitionShops.retiro.restockHours,0);assert.equal(s.ammunitionShops.mendoza.restockHours,0);assert.deepEqual(saved({campaign:s}).campaign,s);
});
