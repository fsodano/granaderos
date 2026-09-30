import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {selectPocket} from './pocket-render-fixture.mjs';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
import {tacticalGridLabel} from '../game/tactical-grid.js';
const matchesSave=m=>{const s=m.saved(),v=m.read();assert.deepEqual(playerKnownBattle(s.battle),v.battle);assert.deepEqual(playerKnownCampaign(s.campaign),v.campaign);return s;};
const change=async(m,selector,value)=>{const e=m.document.querySelector(selector);assert.ok(e,selector);Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));};

test('ordinary pocket and ground controls drop cartridges and collect an exact partial bundle under its owner',async t=>{
 const p=supplyCareField(),m=await mountCampaign(t,p);await m.click('Equipo');await selectPocket(m,'Cartuchos de mosquete');
 await change(m,'[aria-label="Cantidad de objetos"]',4);await m.click('Soltar aquí');
 let s=matchesSave(m),bundle=s.battle.groundItems.find(g=>g.kind==='ammunition'&&g.ammoType==='musket_75');assert.equal(bundle.count,4);assert.equal(s.battle.units.find(u=>u.id==='110').ammo,5);assert.equal(s.battle.units.find(u=>u.id==='110').loaded,1);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Listo');
 const marker=m.document.querySelector(`[data-ground-equipment][aria-label^="Equipo en ${tacticalGridLabel(bundle.x,bundle.y)} ·"]`);assert.ok(marker);
 const proto=m.dom.window.HTMLDialogElement.prototype;
 if(!proto.showModal){proto.showModal=function(){this.setAttribute('open','');};proto.close=function(){this.removeAttribute('open');};}
 await act(async()=>marker.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const dialog=m.document.querySelector('[aria-labelledby="loot-picker-title"]');assert.ok(dialog);assert.match(dialog.textContent,/Cartuchos de mosquete · 4/);
 await change(m,'[aria-label^="Cantidad 1: En el suelo · Cartuchos de mosquete"]',2);await m.click('Recoger selección');s=matchesSave(m);assert.equal(s.battle.groundItems.find(g=>g.id===bundle.id).count,2);assert.equal(s.battle.units.find(u=>u.id==='110').ammo,7);assert.equal(s.battle.units.find(u=>u.id==='110').loaded,1);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
