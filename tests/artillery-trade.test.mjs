import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {advanceMerchants} from '../game/equipment.js';
import {artilleryTradePreview} from '../game/artillery-trade.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import {legacyMerchantGun} from './artillery-legacy-custody-fixture.mjs';
import {order} from './local-contract-fixture.mjs';
const save=s=>decodeSave(encodeSave(s)).campaign;
// An exact finite depot fixture isolates old saved custody; real transport is
// covered separately. No shop supplies this piece.
const fixture=()=>{const s=initialCampaign();s.artilleryDepots={retiro:[{id:'recovered-gun',type:'swivel',side:'player',loaded:false,ammo:2,reloadProgress:.4}]};return save(s);};
const sell={type:'sellArtillery',sector:'retiro',gunId:'recovered-gun'};
const buy={...sell,type:'purchaseUsedArtillery'};
test('closed sale and buyback preserve exact depot custody, unfinished loading and both saved balances',()=>{
 let s=fixture();const gun=structuredClone(s.artilleryDepots.retiro[0]),count=ownedArtilleryCount(s);
 assertTradeRejected(s,sell);assertTradeRejected(s,buy);s=save(s);assert.equal(ownedArtilleryCount(s),count);assert.deepEqual(s.artilleryDepots.retiro,[gun]);
 s=order(s,{type:'configureArtillery',types:[`depot:${gun.id}`]});s.sectors.buenos_aires.owner='royalist';s=order(s,{type:'attack',sector:'buenos_aires'});assert.ok(s.pendingBattle.artillery.some(g=>g.id===gun.id&&g.ammo===2&&g.reloadProgress===.4));
});
test('commerce stays closed for remote, unavailable, unsafe and unaffordable old orders',()=>{
 for(const alter of [s=>s.merchants.retiro.cash=0,s=>s.squads[0].location='buenos_aires',s=>s.sectors.retiro.owner='royalist',s=>s.artilleryDepots.retiro=[],s=>s.enemyGroups.push({target:'retiro',status:'stationed'})]){
  const s=fixture();alter(s);assertTradeRejected(s,sell);assertTradeRejected(s,buy);
 }
 const s=fixture();assert.equal(artilleryTradePreview(s,{sector:'cordoba',gunId:sell.gunId},isSupplied).valid,false);
 const merchant=legacyMerchantGun(s,{artilleryId:sell.gunId});merchant.resources.treasury=0;assertTradeRejected(merchant,buy);assertTradeRejected(merchant,{...buy,sector:'cordoba'});
});
test('merchant-owned old saves reject duplicate custody and invalid cargo while older absent records remain valid',()=>{
 const merchant=save(legacyMerchantGun(fixture(),{artilleryId:sell.gunId}));
 assertTradeRejected(merchant,buy);
 for(const alter of [s=>s.artilleryDepots.retiro.push(structuredClone(s.artilleryMerchants.retiro.guns[0])),s=>s.artilleryMerchants.retiro.guns[0].ammo=-1,s=>s.artilleryMerchants.retiro.guns[0].loaded=true,s=>s.artilleryMerchants.retiro.guns[0].x=2,s=>s.artilleryMerchants.retiro.guns={}]){const s=structuredClone(merchant);alter(s);assert.throws(()=>save(s));}
 assert.deepEqual(save(initialCampaign()),initialCampaign());
});
test('clock refresh retains finite historical merchant guns and closure preserves full capacities',()=>{
 const s=fixture();Object.assign(s.artilleryDepots.retiro[0],{loaded:true,reloadProgress:undefined});
 const merchant=save(legacyMerchantGun(s,{artilleryId:sell.gunId})),gun=structuredClone(merchant.artilleryMerchants.retiro.guns[0]),cash=merchant.merchants.retiro.cash;
 for(let hour=0;hour<24;hour++)advanceMerchants(merchant,isSupplied);
 assert.deepEqual(save(merchant).artilleryMerchants.retiro.guns,[gun]);assert.equal(merchant.merchants.retiro.cash,cash);
 const fullShop=fixture();fullShop.artilleryMerchants={retiro:{guns:Array.from({length:100},(_,i)=>({...gun,id:`shop-${i}`}))}};assertTradeRejected(fullShop,sell);
 const fullDepot=structuredClone(merchant);fullDepot.artilleryDepots.retiro=Array.from({length:2000},(_,i)=>({...gun,id:`depot-${i}`}));assertTradeRejected(fullDepot,buy);
});
