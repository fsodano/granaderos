import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {AMMO_TYPES,ammoCount} from '../game/ammo-types.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {order,visit,saved} from './local-contract-fixture.mjs';

test('mounted armory buys, stores and retrieves a selected family with exact paid stock and saved ownership',async t=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.rules.cartridgePrice=3;
 const m=await mountCampaign(t,visit(order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'})));
 await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');
 const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');assert.ok(summary);await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const panel=()=>m.document.querySelector('[aria-label="Munición y depósito"]');assert.ok(panel());
 const family=panel().querySelector('select');await act(async()=>{family.value='ammoPistol';family.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});
 assert.equal(panel().querySelector('img').getAttribute('src'),AMMO_TYPES.ammoPistol.art);
 const before=m.saved().campaign,money=before.resources.treasury;
 await m.click('Comprar · 30 pesos');let s=m.saved().campaign;assert.equal(s.resources.treasury,money-30);assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),10);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),9);
 await m.click('Guardar en este sector');s=m.saved().campaign;assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),0);assert.equal(s.ammunitionStores.retiro.ammoPistol,10);assert.equal(s.resources.treasury,money-30);assert.match(panel().textContent,/10 guardados/);
 await m.click('Retirar del depósito');s=m.saved().campaign;assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),10);assert.equal(s.ammunitionStores.retiro.ammoPistol,0);assert.equal(s.resources.treasury,money-30);assert.deepEqual(saved({campaign:s}).campaign,s);
 assert.equal([...panel().querySelectorAll('button')].find(b=>b.textContent==='Retirar del depósito').disabled,true);
 assert.equal(s.ammunitionShops.retiro.stock.ammoPistol,before.ammunitionShops.retiro.stock.ammoPistol-10);
});
