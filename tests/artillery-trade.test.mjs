import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {advanceMerchants} from '../game/equipment.js';
import {artilleryTradePreview} from '../game/artillery-trade.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
const save=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
// An exact depot fixture isolates trading; paid transport is covered separately.
const fixture=()=>{const s=initialCampaign();s.artilleryDepots={retiro:[{id:'recovered-gun',type:'swivel',side:'player',loaded:false,ammo:2,reloadProgress:.4}]};return save(s);};
const sell={type:'sellArtillery',sector:'retiro',gunId:'recovered-gun'};
const buy={...sell,type:'purchaseUsedArtillery'};
test('selling and repurchasing preserves exact gun custody, loading, ammunition and saved payments',()=>{
 let s=fixture();const gun=structuredClone(s.artilleryDepots.retiro[0]),cash=s.resources.treasury,merchant=s.merchants.retiro.cash,count=ownedArtilleryCount(s);
 s=save(order(s,sell));assert.equal(s.resources.treasury,cash+160);assert.equal(s.merchants.retiro.cash,merchant-160);assert.equal(ownedArtilleryCount(s),count-1);assert.deepEqual(s.artilleryMerchants.retiro.guns,[gun]);assert.deepEqual(s.artilleryDepots.retiro,[]);
 const repeated=dispatchCampaign(s,sell);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},s);
 s=save(order(s,buy));assert.equal(s.resources.treasury,cash-160);assert.equal(s.merchants.retiro.cash,merchant+160);assert.equal(ownedArtilleryCount(s),count);assert.deepEqual(s.artilleryDepots.retiro,[gun]);assert.deepEqual(s.artilleryMerchants.retiro.guns,[]);
 s=order(s,{type:'configureArtillery',types:[`depot:${gun.id}`]});s.sectors.buenos_aires.owner='royalist';s=order(s,{type:'attack',sector:'buenos_aires'});assert.ok(s.pendingBattle.artillery.some(g=>g.id===gun.id&&g.ammo===2&&g.reloadProgress===.4));
});
test('trade rejects remote, unavailable, unsafe and unaffordable orders atomically',()=>{
 for(const alter of [s=>s.merchants.retiro.cash=0,s=>s.squads[0].location='buenos_aires',s=>s.sectors.retiro.owner='royalist',s=>s.artilleryDepots.retiro=[],s=>s.enemyGroups.push({target:'retiro',status:'stationed'})]){
  const s=fixture();alter(s);const n=dispatchCampaign(s,sell);assert.ok(n.lastError);assert.deepEqual({...n,lastError:s.lastError},s);
 }
 const s=fixture();assert.equal(artilleryTradePreview(s,{sector:'cordoba',gunId:sell.gunId},isSupplied).valid,false);
 const sold=order(s,sell);const remoteBuy=dispatchCampaign(sold,{...buy,sector:'cordoba'});assert.match(remoteBuy.lastError,/maestranza/);assert.deepEqual({...remoteBuy,lastError:null},sold);sold.resources.treasury=0;const n=dispatchCampaign(sold,buy);assert.match(n.lastError,/pesos/);assert.deepEqual({...n,lastError:null},sold);
});
test('merchant gun saves reject duplicate custody and invalid cargo while old saves remain valid',()=>{
 const sold=order(fixture(),sell);for(const alter of [s=>s.artilleryDepots.retiro.push(structuredClone(s.artilleryMerchants.retiro.guns[0])),s=>s.artilleryMerchants.retiro.guns[0].ammo=-1,s=>s.artilleryMerchants.retiro.guns[0].loaded=true,s=>s.artilleryMerchants.retiro.guns[0].x=2,s=>s.artilleryMerchants.retiro.guns={}]){const s=structuredClone(sold);alter(s);assert.throws(()=>save(s));}
 assert.deepEqual(save(initialCampaign()),initialCampaign());
});
test('shop refresh retains loaded guns and capacity limits reject transfers before payment',()=>{
 const s=fixture();Object.assign(s.artilleryDepots.retiro[0],{loaded:true,reloadProgress:undefined});
 const sold=save(order(s,sell)),gun=structuredClone(sold.artilleryMerchants.retiro.guns[0]);
 for(let hour=0;hour<24;hour++)advanceMerchants(sold,isSupplied);
 assert.deepEqual(save(sold).artilleryMerchants.retiro.guns,[gun]);
 const fullShop=fixture();fullShop.artilleryMerchants={retiro:{guns:[]}};fullShop.artilleryMerchants.retiro.guns=Array.from({length:100},(_,i)=>({...gun,id:`shop-${i}`}));
 const rejectedSale=dispatchCampaign(fullShop,sell);assert.match(rejectedSale.lastError,/más piezas/);assert.deepEqual({...rejectedSale,lastError:null},fullShop);
 const fullDepot=structuredClone(sold);fullDepot.artilleryDepots.retiro=Array.from({length:2000},(_,i)=>({...gun,id:`depot-${i}`}));
 const rejectedPurchase=dispatchCampaign(fullDepot,buy);assert.match(rejectedPurchase.lastError,/lleno/);assert.deepEqual({...rejectedPurchase,lastError:null},fullDepot);
});
