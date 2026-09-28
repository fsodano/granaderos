import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {depotTradeGun} from './artillery-trading-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
const armory=async m=>{await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');assert.ok(summary);await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));};

test('mounted production commerce sells and repurchases the actual depot gun without replacing its partial load',async t=>{
 const s=depotTradeGun();s.artilleryDepots.buenos_aires[0].reloadProgress=.4;const gun=structuredClone(s.artilleryDepots.buenos_aires[0]);const m=await mountCampaign(t,visit(saved({campaign:s}).campaign));await armory(m);const before=m.saved().campaign,panel=m.document.querySelector(`[data-artillery-sale="${gun.id}"]`);assert.match(panel.textContent,/Recarga 40% · 6 en reserva/);assert.match(panel.textContent,/160 pesos/);const sell=panel.querySelector('button');await m.click('Vender pieza');
 const sold=saved({campaign:m.saved().campaign}).campaign;assert.equal(sold.resources.treasury,before.resources.treasury+160);assert.equal(sold.artilleryMerchants.buenos_aires.cash,1040);assert.equal(sold.artilleryDepots.buenos_aires.length,0);const stock=m.document.querySelector(`[data-artillery-repurchase="${gun.id}"]`);assert.match(stock.textContent,/Recarga 40% · 6 en reserva/);assert.match(stock.textContent,/320 pesos/);
 await act(async()=>sell.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.deepEqual(m.saved().campaign,sold);await m.click('Recomprar pieza');const bought=saved({campaign:m.saved().campaign}).campaign;assert.equal(bought.resources.treasury,before.resources.treasury-160);assert.equal(bought.artilleryMerchants.buenos_aires.cash,1360);assert.equal(bought.artilleryMerchants.buenos_aires.guns.length,0);for(const key of ['id','type','side','ammo','loaded','reloadProgress','facing'])assert.deepEqual(bought.artilleryDepots.buenos_aires[0][key],gun[key]);assert.equal(m.document.querySelector(`[data-artillery-repurchase="${gun.id}"]`),null);assert.match(m.document.querySelector(`[data-stored-artillery-id="${gun.id}"]`).textContent,/Recarga 40% · 6 en reserva/);
});

test('mounted finite merchant funds reject a sale without changing the gun or either balance',async t=>{
 const s=depotTradeGun();s.artilleryMerchants={buenos_aires:{cash:159,guns:[]}};const m=await mountCampaign(t,visit(saved({campaign:s}).campaign));await armory(m);const before=m.saved().campaign,panel=m.document.querySelector('[data-artillery-sale]');assert.equal(panel.querySelector('button').disabled,true);assert.match(panel.textContent,/El taller no tiene suficientes pesos/);await m.click('Vender pieza');assert.deepEqual(m.saved().campaign,before);
});
