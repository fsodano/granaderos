import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_AMMUNITION_MARKET,validateAmmunitionMarket,ammunitionMarketRules} from '../game/ammunition-market-rules.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,deploymentCost,rosterFor} from '../game/campaign.js';
import {ammunitionOrderQuote,restockAmmunitionShops,prepareCampaignAmmunition,syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {ammoCount} from '../game/ammo-types.js';
import {withCarriedAmmo,assertTradeRejected} from './commerce-gear-fixture.mjs';
const profile=()=>structuredClone(DEFAULT_AMMUNITION_MARKET);
const content=()=>{const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.rules.cartridgePrice=3;d.ammunitionMarket={defaults:profile(),locations:{}};return d;};
const hire=d=>order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'month'});
const buy=(s,n,key='ammoMusket',direction='buy')=>order(s,{type:'ammunition',operativeId:110,family:key,quantity:n,direction});

test('optional supplier rules preserve old package identity and strictly validate all profiles',()=>{
 const old=defaultContentPackage();assert.equal(old.ammunitionMarket,undefined);assert.deepEqual(parseContentPackage(JSON.stringify(old)),old);
 const d=content();assert.deepEqual(validateAmmunitionMarket(d.ammunitionMarket),[]);assert.deepEqual(parseContentPackage(JSON.stringify(d)),d);
 for(const mutate of [m=>m.extra=1,m=>m.locations=[],m=>m.defaults.enabled=1,m=>m.defaults.automaticPurchase='yes',m=>m.defaults.restockHours=0,m=>m.defaults.restockHours=721,m=>m.defaults.restockHours=1.5,m=>delete m.defaults.families.ammoShot,m=>m.defaults.families.foo={},m=>m.defaults.families.ammoRifle.initial=61,m=>m.defaults.families.ammoRifle.capacity=-1,m=>m.defaults.families.ammoRifle.replenish=.5,m=>m.defaults.families.ammoRifle.price='3',m=>m.locations.uspallata=profile(),m=>m.locations['cell-27-27']=profile(),m=>m.locations.mendoza={...profile(),extra:1}]){const bad=structuredClone(d);mutate(bad.ammunitionMarket);assert.ok(validateAmmunitionMarket(bad.ammunitionMarket).length);assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(8,bad));}
});

test('saved supplier configuration remains pinned while public purchases and automatic deployment buying remain disabled',()=>{
 const d=content(),local=profile();local.families.ammoMusket={initial:7,capacity:12,replenish:2,price:5};d.ammunitionMarket.locations.retiro=local;
 let state=hire(d),cash=state.resources.treasury;d.ammunitionMarket.locations.retiro.families.ammoMusket.price=999;const shops=structuredClone(state.ammunitionShops);
 assert.equal(deploymentCost(state),0);assertTradeRejected(state,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:2,direction:'buy'});
 const pair=visit(saved({campaign:state}).campaign);assert.equal(pair.battle.units[0].loaded+pair.battle.units[0].ammo,10);assert.equal(pair.campaign.resources.treasury,cash);state=leave(pair);assert.deepEqual(state.ammunitionShops,shops);assert.deepEqual(saved({campaign:state}).campaign,state);
 assert.equal(ammunitionMarketRules(state,'retiro').families.ammoMusket.price,5);assert.equal(ammunitionMarketRules(state,'mendoza').families.ammoMusket.price,null);
 const operative=rosterFor(state).find(row=>row.id===110);assert.equal(ammunitionOrderQuote(state,operative,'ammoRifle',1,'buy',true).unitPrice,3,'unused catalog quote remains deterministic');
});

test('an initially empty saved supplier remains empty through ordinary elapsed time and restoration',()=>{
 const d=content();d.ammunitionMarket.defaults.restockHours=2;d.ammunitionMarket.defaults.families.ammoMusket={initial:0,capacity:5,replenish:3,price:0};
 let state=hire(d),shops=structuredClone(state.ammunitionShops),cash=state.resources.treasury;state=order(state,{type:'wait',hours:6});state=saved({campaign:state}).campaign;assert.deepEqual(state.ammunitionShops,shops);assert.equal(state.resources.treasury,cash);
 assertTradeRejected(state,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:2,direction:'buy'});
 const before=structuredClone(state.ammunitionShops);restockAmmunitionShops(state,()=>false);assert.deepEqual(state.ammunitionShops,before);
 for(const mutate of [s=>delete s.ammunitionShops.retiro,s=>s.ammunitionShops.retiro.restockHours=2,s=>s.ammunitionShops.retiro.stock.ammoMusket=6]){const bad=structuredClone(state);mutate(bad);assert.throws(()=>saved({campaign:bad}));}
});

test('manual-only and disabled saved suppliers preserve finite owned storage and never buy extra deployment rounds',()=>{
 for(const enabled of [true,false]){
  const d=content();d.ammunitionMarket.defaults.automaticPurchase=false;d.ammunitionMarket.defaults.enabled=enabled;
  let state=withCarriedAmmo(hire(d),110,'ammoMusket',4),cash=state.resources.treasury;assert.equal(deploymentCost(state),0);assert.equal(ammoCount(state.operativeState[110],'ammoMusket'),13);
  state=buy(state,2,'ammoMusket','store');state=buy(state,1,'ammoMusket','take');assert.equal(ammoCount(state.operativeState[110],'ammoMusket'),12);assert.equal(state.ammunitionStores.retiro.ammoMusket,1);
  assertTradeRejected(state,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:1,direction:'buy'});
  const prepared=prepareCampaignAmmunition(state,rosterFor(state),[110],{supplied:true});assert.equal(prepared.cost,0);assert.equal(prepared.allocation[110].loaded,1);assert.equal(prepared.allocation[110].ammo,12);assert.equal(state.resources.treasury,cash);assert.deepEqual(saved({campaign:state}).campaign,state);
 }
});

test('retained local supplier limits remain independent saved configuration without a live replenishment clock',()=>{
 const d=content();d.ammunitionMarket.locations.retiro=profile();d.ammunitionMarket.locations.retiro.restockHours=1;d.ammunitionMarket.locations.retiro.families.ammoRifle={initial:0,capacity:0,replenish:100,price:0};d.ammunitionMarket.locations.retiro.families.ammoMusket.replenish=0;
 let state=hire(d),shops=structuredClone(state.ammunitionShops);state=order(state,{type:'wait',hours:24});assert.deepEqual(state.ammunitionShops,shops);assert.equal(state.ammunitionShops.retiro.stock.ammoRifle,0);assert.equal(state.ammunitionShops.retiro.stock.ammoMusket,180);assert.deepEqual(saved({campaign:state}).campaign,state);
});
