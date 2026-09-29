import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {selectPocket} from './pocket-render-fixture.mjs';
const change=async(m,selector,value)=>{const e=m.document.querySelector(selector);assert.ok(e,selector);Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));};

test('ordinary pocket and ground controls drop cartridges and collect an exact partial bundle under its owner',async t=>{
 const p=supplyCareField(),m=await mountCampaign(t,p);await m.click('Equipo y órdenes');await selectPocket(m,'Cartuchos de mosquete');
 await change(m,'[aria-label="Cantidad de suministros"]',4);await m.click('Dejar suministros en el suelo');
 let s=m.read(),bundle=s.battle.groundItems.find(g=>g.type==='ammoMusket');assert.equal(bundle.count,4);assert.equal(s.battle.units.find(u=>u.id==='110').ammo,5);assert.equal(s.battle.units.find(u=>u.id==='110').loaded,1);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Listo');assert.ok(m.document.querySelector(`[data-ground-item="${bundle.id}"]`));await m.click('Recoger equipo');
 await act(async()=>m.document.querySelector('[data-unit-id="110"]').dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const dialog=m.document.querySelector('[aria-label="Recoger suministros del suelo"]');assert.ok(dialog);assert.match(dialog.textContent,/Cartuchos de mosquete · 4/);
 await change(m,'[aria-label="Cantidad de suministros para recoger"]',2);await m.click('Recoger cantidad');s=m.read();assert.equal(s.battle.groundItems.find(g=>g.id===bundle.id).count,2);assert.equal(s.battle.units.find(u=>u.id==='110').ammo,7);assert.equal(s.battle.units.find(u=>u.id==='110').loaded,1);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
