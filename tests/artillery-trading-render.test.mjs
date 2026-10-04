import test from 'node:test';import assert from 'node:assert/strict';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {depotTradeGun} from './artillery-trading-fixture.mjs';
import {saved} from './local-contract-fixture.mjs';

test('an isolated legacy sale callback cannot change an actual depot gun, its partial work or either balance',async t=>{
 const s=depotTradeGun();s.artilleryDepots.buenos_aires[0].reloadProgress=.4;const m=await mountLegacyArmory(t,saved({campaign:s})),before=m.saved().campaign,gun=before.artilleryDepots.buenos_aires[0];
 const panel=m.document.querySelector(`[data-artillery-sale="${gun.id}"]`);assert.match(panel.textContent,/Recarga 40% · 6 en reserva/);assert.match(panel.textContent,/160 pesos/);
 await m.click('Vender pieza');assert.match(m.read().campaign.lastError,/comercio de equipo no está disponible/);assert.deepEqual(m.saved().campaign,before);assert.equal(m.document.querySelector(`[data-artillery-repurchase="${gun.id}"]`),null);
});
test('the isolated legacy sale widget still describes a cash-poor historical merchant without a transaction',async t=>{
 const s=depotTradeGun();s.merchants.buenos_aires.cash=159;const m=await mountLegacyArmory(t,saved({campaign:s})),before=m.saved().campaign,panel=m.document.querySelector('[data-artillery-sale]');
 assert.equal(panel.querySelector('button').disabled,true);assert.match(panel.textContent,/El taller no tiene suficientes pesos/);await m.click('Vender pieza');assert.deepEqual(m.saved().campaign,before);
});
test('a saved merchant-owned offer retains its authored quote but the isolated buyback callback is publicly blocked',async t=>{
 const {defaultContentPackage}=await import('../game/content-package.js'),{DEFAULT_ARTILLERY_TRADING}=await import('../game/artillery-trading-rules.js');const d=defaultContentPackage();d.artilleryTrading={...DEFAULT_ARTILLERY_TRADING,initialCash:2000,buyPercent:25,resalePercent:70,buyingOverrides:{buenos_aires:29}};
 const s=depotTradeGun(d),gun=s.artilleryDepots.buenos_aires.shift();
 // Explicit old-save custody: one gun belongs to the merchant, not the depot.
 s.artilleryMerchants??={};s.artilleryMerchants.buenos_aires={guns:[gun]};const m=await mountLegacyArmory(t,saved({campaign:s})),before=m.saved().campaign,panel=m.document.querySelector('[aria-label="Comercio de artillería"]');
 assert.match(panel.textContent,/2000 pesos/);assert.match(panel.textContent,/Paga el 29%/);assert.match(panel.textContent,/recomprar al 70%/);assert.match(m.document.querySelector(`[data-artillery-repurchase="${gun.id}"]`).textContent,/280 pesos/);
 await m.click('Recomprar pieza');assert.match(m.read().campaign.lastError,/comercio de equipo no está disponible/);assert.deepEqual(m.saved().campaign,before);
});
