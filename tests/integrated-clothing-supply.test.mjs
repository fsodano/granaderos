import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {advanceMerchants,validateEquipment} from '../game/equipment.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {issueInitialOutfit,makeOutfit,PONCHO_PRICE,PONCHO_STOCK_CAP} from '../game/outfits.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const fresh=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const purchase={type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'};
const stock=s=>s.merchants.retiro.supplies.ponchos;
const save=s=>decodeSave(encodeSave(s)).campaign;

test('finite owned clothing stays in physical pockets while shop issuance rejects atomically',()=>{
 let s=fresh();const cash=s.resources.treasury,merchant=structuredClone(s.merchants);
 assert.equal(stock(s),PONCHO_STOCK_CAP);assert.equal(s.operativeState[110].outfit.outfit,'poncho');assertTradeRejected(s,purchase);
 // This subsystem save owns one spare poncho in addition to its worn outfit.
 s.operativeState[110].inventory.outfit=makeOutfit();
 assert.equal(s.resources.treasury,cash);assert.deepEqual(s.merchants,merchant);assert.equal(s.operativeState[110].inventory.outfit.count,1);assert.deepEqual(Object.keys(s.resources),['treasury']);
 const restored=save(s);assert.deepEqual(restored,s);assert.equal(sectorInventoryModel(restored,'retiro',rosterFor(restored),110).outfitPrice,PONCHO_PRICE);

});

test('closed clothing issuance for poor, unavailable, full and depleted actors leave all owners unchanged',()=>{
 for(const mutate of [s=>s.resources.treasury=0,s=>s.merchants.retiro.supplies.ponchos=0,s=>s.merchants.retiro.cash=1e9,s=>s.operativeState[110].asleep=true,s=>{s.operativeState[110].inventory={outfit:{kind:'outfit',outfit:'poncho',weight:2,condition:100,count:4}};}]){
  const s=fresh();mutate(s);const before=structuredClone(s),next=dispatchCampaign(s,purchase);
  assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},before);assert.deepEqual(s,before);
 }
});

test('old merchant saves add one finite clothing lot; current saves cannot refill missing stock',()=>{
 const old=fresh();delete old.clothingSupplyVersion;for(const shop of Object.values(old.merchants))delete shop.supplies.ponchos;
 old.operativeState[110].outfit=null;
 let migrated=save(old);assert.equal(stock(migrated),PONCHO_STOCK_CAP);assert.equal(migrated.operativeState[110].outfit,null);
 assertTradeRejected(migrated,purchase);assert.equal(stock(save(save(migrated))),PONCHO_STOCK_CAP);
 for(const mutate of [s=>delete s.merchants.retiro.supplies.ponchos,s=>s.clothingSupplyVersion=null,s=>s.clothingSupplyVersion=2,s=>s.merchants.retiro.supplies.ponchos=-1,s=>s.merchants.retiro.supplies.ponchos=PONCHO_STOCK_CAP+1,s=>delete s.clothingSupplyVersion]){const bad=structuredClone(migrated);mutate(bad);assert.throws(()=>save(bad));}
});

test('legacy clothing stocks never restock and initial personal clothing is never reissued',()=>{
 let s=fresh();s.merchants.retiro.supplies.ponchos=0;
 s=order(s,{type:'wait',hours:24});assert.equal(stock(s),0);
 s.operativeState[110].outfit=null;const before=structuredClone(s);issueInitialOutfit(s,110);assert.deepEqual(s,before);
 validateEquipment(s,rosterFor(s));assert.deepEqual(save(s),s);
});
