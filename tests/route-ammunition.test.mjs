import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_AMMUNITION_MARKET} from '../game/ammunition-market-rules.js';
import {ammoCount} from '../game/ammo-types.js';
import {order,saved} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';

const hired=()=>{
 const content=defaultContentPackage();content.rules.startingTreasury=9000;content.rules.cartridgePrice=3;
 content.ammunitionMarket={defaults:structuredClone(DEFAULT_AMMUNITION_MARKET),locations:{}};content.ammunitionMarket.defaults.families.ammoMusket.initial=60;
 content.characters.find(c=>c.id==='person-110').arrivalHours=0;
 return order(initialCampaign(8,content),{type:'recruitCivic',id:110,term:'month'});
};

test('route supply takes owned cartridges first and buys only the selected alternative-load shortage',()=>{
 let s=hired();s=order(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoShot'});
 s=order(s,{type:'ammunition',operativeId:110,family:'ammoShot',quantity:4,direction:'buy'});
 s=order(s,{type:'ammunition',operativeId:110,family:'ammoShot',quantity:4,direction:'store'});
 const before=structuredClone(s),result=supplyRouteAmmunition(s,[110]);assert.deepEqual(s,before);s=result.campaign;
 assert.deepEqual(result.transactions.map(t=>[t.action.direction,t.action.quantity,t.cost]),[['take',4,0],['buy',6,18]]);
 assert.equal(s.resources.treasury,before.resources.treasury-18);assert.equal(s.ammunitionStores.retiro.ammoShot,0);
 assert.equal(s.ammunitionShops.retiro.stock.ammoShot,before.ammunitionShops.retiro.stock.ammoShot-6);
 assert.equal(ammoCount(s.operativeState[110],'ammoShot'),10);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),0);
 assert.deepEqual(saved({campaign:s}).campaign,s);
 const again=supplyRouteAmmunition(s,[110]);assert.deepEqual(again.transactions,[]);assert.deepEqual(again.campaign,s);
});

test('route supply cannot give a remote soldier cartridges or invent depleted merchant stock',()=>{
 let s=hired();const before=structuredClone(s);
 assert.throws(()=>supplyRouteAmmunition(s,[111]),/combatiente no está disponible/);assert.deepEqual(s,before);
 for(let i=0;i<3;i++){
  s=order(s,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:20,direction:'buy'});
  s=order(s,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:20,direction:'store'});
 }
 const depleted=structuredClone(s);assert.throws(()=>supplyRouteAmmunition(s,[110],{target:61}),/proveedor no tiene suficientes cartuchos/);assert.deepEqual(s,depleted);
 s=order(s,{type:'travel',sector:'cell-27-27'});
 const remote=structuredClone(s);assert.throws(()=>supplyRouteAmmunition(s,[110]),/sector debe estar bajo tu control/);assert.deepEqual(s,remote);
});
