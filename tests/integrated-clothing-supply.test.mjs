import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {advanceMerchants,validateEquipment} from '../game/equipment.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {issueInitialOutfit,PONCHO_PRICE,PONCHO_STOCK_CAP} from '../game/outfits.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const fresh=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const purchase={type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'};
const stock=s=>s.merchants.retiro.supplies.ponchos;
const save=s=>decodeSave(encodeSave(s)).campaign;

test('clothing purchases conserve cash and finite stock and persist in physical pockets',()=>{
 let s=fresh();const cash=s.resources.treasury,shop=s.merchants.retiro.cash;
 assert.equal(stock(s),PONCHO_STOCK_CAP);assert.equal(s.operativeState[110].outfit.outfit,'poncho');
 s=order(s,purchase);assert.equal(stock(s),PONCHO_STOCK_CAP-1);assert.equal(s.resources.treasury,cash-PONCHO_PRICE);assert.equal(s.merchants.retiro.cash,shop+PONCHO_PRICE);
 assert.equal(s.operativeState[110].inventory.outfit.count,1);assert.deepEqual(Object.keys(s.resources),['treasury']);
 const restored=save(s);assert.deepEqual(restored,s);assert.equal(sectorInventoryModel(restored,'retiro',rosterFor(restored),110).outfitPrice,PONCHO_PRICE);
});

test('unaffordable, unavailable, full and depleted clothing purchases leave all owners unchanged',()=>{
 for(const mutate of [s=>s.resources.treasury=0,s=>s.merchants.retiro.supplies.ponchos=0,s=>s.merchants.retiro.cash=1e9,s=>s.operativeState[110].asleep=true,s=>{s.operativeState[110].inventory={outfit:{kind:'outfit',outfit:'poncho',weight:2,condition:100,count:4}};}]){
  const s=fresh();mutate(s);const before=structuredClone(s),next=dispatchCampaign(s,purchase);
  assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},before);assert.deepEqual(s,before);
 }
});

test('old merchant saves add one finite clothing lot; current saves cannot refill missing stock',()=>{
 const old=fresh();delete old.clothingSupplyVersion;for(const shop of Object.values(old.merchants))delete shop.supplies.ponchos;
 old.operativeState[110].outfit=null;
 let migrated=save(old);assert.equal(stock(migrated),PONCHO_STOCK_CAP);assert.equal(migrated.operativeState[110].outfit,null);
 migrated=order(migrated,purchase);assert.equal(stock(save(save(migrated))),PONCHO_STOCK_CAP-1);
 for(const mutate of [s=>delete s.merchants.retiro.supplies.ponchos,s=>s.clothingSupplyVersion=null,s=>s.clothingSupplyVersion=2,s=>s.merchants.retiro.supplies.ponchos=-1,s=>s.merchants.retiro.supplies.ponchos=PONCHO_STOCK_CAP+1,s=>delete s.clothingSupplyVersion]){const bad=structuredClone(migrated);mutate(bad);assert.throws(()=>save(bad));}
});

test('restocking requires a supplied friendly sector and initial personal clothing is never reissued',()=>{
 const s=fresh();s.merchants.retiro.supplies.ponchos=0;
 for(let i=0;i<24;i++)advanceMerchants(s,()=>false);assert.equal(stock(s),0);
 for(let i=0;i<24;i++)advanceMerchants(s,()=>true);assert.equal(stock(s),1);
 s.operativeState[110].outfit=null;const before=structuredClone(s);issueInitialOutfit(s,110);assert.deepEqual(s,before);
 validateEquipment(s,rosterFor(s));assert.deepEqual(save(s),s);
});
