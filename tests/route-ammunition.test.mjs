import {withStoredAmmo,assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_AMMUNITION_MARKET} from '../game/ammunition-market-rules.js';
import {ammoCount} from '../game/ammo-types.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {order,saved} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';

const hired=()=>{
 const content=defaultContentPackage();content.rules.startingTreasury=9000;content.rules.cartridgePrice=3;
 content.ammunitionMarket={defaults:structuredClone(DEFAULT_AMMUNITION_MARKET),locations:{}};content.ammunitionMarket.defaults.families.ammoMusket.initial=60;
 content.characters.find(c=>c.id==='person-110').arrivalHours=0;
 return order(initialCampaign(8,content),{type:'recruitCivic',id:110,term:'month'});
};

test('route supply takes only finite owned cartridges for the selected alternative load',()=>{
 let s=hired();s=order(s,{type:'unloadAmmunition',operativeId:110});s=order(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoShot'});
 s=withStoredAmmo(s,'retiro','ammoShot',10);
 const before=structuredClone(s),result=supplyRouteAmmunition(s,[110]);assert.deepEqual(s,before);s=result.campaign;
 assert.deepEqual(result.transactions.map(t=>[t.action.direction,t.action.quantity,t.cost]),[['take',10,0]]);
 assert.equal(s.resources.treasury,before.resources.treasury);assert.equal(s.ammunitionStores.retiro.ammoShot,0);
 assert.deepEqual(s.ammunitionShops,before.ammunitionShops);
 assert.equal(ammoCount(s.operativeState[110],'ammoShot'),10);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),10);
 assert.deepEqual(saved({campaign:s}).campaign,s);
 const again=supplyRouteAmmunition(s,[110]);assert.deepEqual(again.transactions,[]);assert.deepEqual(again.campaign,s);
});

test('route supply discovers the actual chest and conserves its finite selected load through deterministic saves',()=>{
 let s=hired();s=order(s,{type:'unloadAmmunition',operativeId:110});s=order(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoShot'});
 const before=structuredClone(s),events=[],result=supplyRouteAmmunition(s,[110],{target:12,report:event=>events.push(event)});
 assert.deepEqual(s,before);s=result.campaign;assert.equal(ammoCount(s.operativeState[110],'ammoShot'),12);
 assert.equal(s.resources.treasury,before.resources.treasury);assert.deepEqual(s.ammunitionShops,before.ammunitionShops);
 const chest=s.sectorStates.retiro.props.find(prop=>prop.id===FINITE_SECTOR_CACHES.retiro.chest);
 assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents.find(row=>row.ammoType==='shot_16').count,8);
 assert.ok(events.some(event=>event.event==='ammunitionCacheDiscovered'));assert.equal(result.transactions.length,1);
 assert.equal(result.transactions[0].action.type,'sectorInventory');assert.equal(result.transactions[0].sourceKind,'container');
 assert.deepEqual(supplyRouteAmmunition(saved({campaign:before}).campaign,[110],{target:12}),result);
 assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('route supply cannot give a remote soldier cartridges or invent exhausted cache ammunition',()=>{
 let s=hired();const before=structuredClone(s);
 assert.throws(()=>supplyRouteAmmunition(s,[111]),/combatiente no está disponible/);assert.deepEqual(s,before);
 s=order(s,{type:'unloadAmmunition',operativeId:110});s=order(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoShot'});
 s=supplyRouteAmmunition(s,[110],{target:20}).campaign;
 s=order(s,{type:'ammunition',operativeId:110,family:'ammoShot',quantity:20,direction:'store'});
 const depleted=structuredClone(s),events=[];assert.throws(()=>supplyRouteAmmunition(s,[110],{target:21,report:event=>events.push(event)}),/Finite ammunition shortage.*1 ammoShot/);
 assert.deepEqual(s,depleted);assert.equal(events.at(-1).event,'ammunitionShortage');assert.equal(events.at(-1).remaining,1);
 assertTradeRejected(s,{type:'ammunition',operativeId:110,family:'ammoShot',quantity:1,direction:'buy'});
 s=order(s,{type:'travel',sector:'cell-27-27'});
 const remote=structuredClone(s);assert.throws(()=>supplyRouteAmmunition(s,[110]),/sector debe estar bajo tu control/);assert.deepEqual(s,remote);
});
