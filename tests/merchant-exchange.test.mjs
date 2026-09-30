import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {merchantExchangeOffers,merchantExchangePreview} from '../game/merchant-exchange.js';
import {decodeSave,encodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
function basket(s,choices){const offers=merchantExchangeOffers(s,isSupplied);return {type:'exchangeEquipment',sector:s.location,lines:choices.map(([key,quantity=1])=>{const offer=offers.find(o=>o.key===key);assert.ok(offer,key);return {key,quantity,receipt:offer.receipt};})};}
function stocked(){let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803,quantity:3});s=order(s,{type:'sellEquipment',instanceId:s.armoryItems[0].id});return s;}
test('a cashless exchange swaps exact used weapons when neither separate transaction is affordable',()=>{
 let s=stocked();s.resources.treasury=0;s.merchants.retiro.cash=0;const offered=structuredClone(s.armoryItems),received=structuredClone(s.merchants.retiro.usedItems[0]);
 const a=basket(s,[...offered.map(i=>[`sell:weapon:${i.id}`]),[`buy:weapon:${received.id}`]]),before=structuredClone(s),plan=merchantExchangePreview(s,a,isSupplied);
 assert.equal(plan.valid,true);assert.equal(plan.sales,144);assert.equal(plan.purchases,144);assert.equal(plan.net,0);assert.deepEqual(s,before);
 assert.ok(dispatchCampaign(s,{type:'sellEquipment',instanceId:offered[0].id}).lastError);assert.ok(dispatchCampaign(s,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:received.id}).lastError);
 s=save(order(s,a));assert.deepEqual(s.armoryItems,[received]);assert.deepEqual(s.merchants.retiro.usedItems,offered);assert.equal(s.resources.treasury,0);assert.equal(s.merchants.retiro.cash,0);
 const repeated=dispatchCampaign(s,a);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},s);
});
test('a weapon offsets a new purchase and only the final difference is required',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803});const id=s.armoryItems[0].id,stock=s.merchants.retiro.stock[1804];s.resources.treasury=27;s.merchants.retiro.cash=0;
 const a=basket(s,[[`sell:weapon:${id}`],['buy:new:1804']]);const bad=dispatchCampaign(s,a);assert.match(bad.lastError,/diferencia/);assert.deepEqual({...bad,lastError:null},s);
 s.resources.treasury=28;s=save(order(s,a));assert.equal(s.resources.treasury,0);assert.equal(s.merchants.retiro.cash,28);assert.equal(s.merchants.retiro.stock[1804],stock-1);assert.equal(s.armoryItems[0].item,1804);assert.equal(s.merchants.retiro.usedItems[0].id,id);
});
test('artillery can fund a multiple-item purchase with exact retained loading and a net cash payout',()=>{
 let s=initialCampaign();const gun={id:'barter-piece',type:'field8',side:'player',loaded:false,ammo:1,reloadProgress:.6};s.artilleryStores={retiro:[gun]};s.resources.treasury=0;s.merchants.retiro.cash=120;
 const a=basket(s,[[`sell:artillery:stored:${gun.id}`],['buy:new:1809',2]]);assert.equal(merchantExchangePreview(s,a,isSupplied).net,-120);
 s=save(order(s,a));assert.equal(s.resources.treasury,120);assert.equal(s.merchants.retiro.cash,0);assert.deepEqual(s.merchants.retiro.usedArtillery,[gun]);assert.equal(s.armoryItems.filter(i=>i.item===1809).length,2);assert.deepEqual(s.artilleryStores.retiro,[]);
});
test('changed, duplicated, unavailable and remote offers reject the whole exchange without partial trades',()=>{
 const base=stocked(),id=base.armoryItems[0].id,a=basket(base,[[`sell:weapon:${id}`],['buy:new:1804']]);
 for(const edit of [a=>a.lines.push({...a.lines[0]}),a=>a.lines[1].quantity=99,a=>a.lines[1].receipt='forged',a=>a.sector='cordoba',a=>a.lines=[],a=>a.lines[0].key='buy:new:1802']){const copy=structuredClone(a);edit(copy);const bad=dispatchCampaign(base,copy);assert.ok(bad.lastError);assert.deepEqual({...bad,lastError:null},base);}
 for(const change of [s=>s.armoryItems[0].condition=35,s=>s.merchants.retiro.stock[1804]--,s=>s.pendingBattle={id:'busy'},s=>s.sectors.retiro.owner='royalist']){const s=structuredClone(base);change(s);const bad=dispatchCampaign(s,a);assert.ok(bad.lastError);assert.deepEqual({...bad,lastError:null},s);}
});
test('full merchant storage can exchange outgoing used stock for an offered weapon without a temporary capacity refusal',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803});const id=s.armoryItems[0].id;
 s.merchants.retiro.usedItems=Array.from({length:1000},(_,i)=>({id:`armory-${i+2}`,item:1803,condition:100,jammed:false}));s.nextArmoryItemId=1002;s=save(s);
 const a=basket(s,[[`sell:weapon:${id}`],['buy:weapon:armory-2']]);s=save(order(s,a));assert.equal(s.merchants.retiro.usedItems.length,1000);assert.equal(s.armoryItems.length,1);assert.equal(s.armoryItems[0].id,'armory-2');
});
test('multiple undeployed cannons materialize once per exchanged piece',()=>{
 let s=initialCampaign();s.resources.cannons=2;s.armory.swivel=2;s.merchants.retiro.cash=300;
 const a=basket(s,[['sell:artillery:stock:swivel',2],['buy:new:1813']]);s=save(order(s,a));assert.equal(s.resources.cannons,0);assert.equal(s.armory.swivel,0);assert.equal(s.merchants.retiro.usedArtillery.length,2);assert.notEqual(s.merchants.retiro.usedArtillery[0].id,s.merchants.retiro.usedArtillery[1].id);assert.ok(s.merchants.retiro.usedArtillery.every(g=>g.loaded&&g.ammo===6));
});
test('a fitted loaded musket retains its exact metadata and does not replenish campaign ammunition during exchange',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803});const item=s.armoryItems[0];Object.assign(item,{item:1800,condition:50,jammed:true,loaded:1,instanceId:'barter-musket',fittings:{bayonet:{weapon:1811,condition:25,instanceId:'barter-bayonet',fittingPattern:'india_socket'}}});s.armory[1803]=0;s.armory[1800]=1;s=save(s);
 const exact=structuredClone(s.armoryItems[0]),ammo=s.resources.cartridges;s=save(order(s,basket(s,[[`sell:weapon:${item.id}`],['buy:new:1813']])));assert.deepEqual(s.merchants.retiro.usedItems,[exact]);assert.equal(s.resources.cartridges,ammo);
});
test('insufficient merchant change and lost artillery crew reject all offered goods',()=>{
 let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803});s.merchants.retiro.cash=31;const a=basket(s,[[`sell:weapon:${s.armoryItems[0].id}`],['buy:new:1813']]);const bad=dispatchCampaign(s,a);assert.match(bad.lastError,/comerciante.*diferencia/);assert.deepEqual({...bad,lastError:null},s);
 s.sectorStates.retiro={units:[],artillery:[{id:'crew-gun',type:'field8',side:'player',loaded:true,ammo:2,x:3,y:3}]};const b=basket(s,[[`sell:weapon:${s.armoryItems[0].id}`],['sell:artillery:deployed:crew-gun']]);s.operativeState[s.squad[0]].hp=10;const noCrew=dispatchCampaign(s,b);assert.match(noCrew.lastError,/artilleros/);assert.deepEqual({...noCrew,lastError:null},s);
});
